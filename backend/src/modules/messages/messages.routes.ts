import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const sendMessageSchema = z.object({
  booking_id: z.string().uuid(),
  receiver_id: z.string().optional(),
  content: z.string().min(1, 'Message cannot be empty'),
});

// Get User's Active Conversations
router.get('/conversations', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Get bookings that have messages involving user (excluding blocked relationships)
    const result = await query(
      `SELECT * FROM (
        SELECT DISTINCT ON (b.id)
          b.id AS booking_id,
          b.status AS booking_status,
          b.start_date,
          b.duration_days,
          b.total_price,
          i.title AS item_title,
          i.image_urls AS item_images,
          i.locality AS item_locality,
          CASE WHEN b.borrower_id = $1 THEN COALESCE(lender.id, b.lender_id) ELSE borrower.id END AS partner_id,
          CASE WHEN b.borrower_id = $1 THEN COALESCE(lender.name, 'Lender') ELSE COALESCE(borrower.name, 'Borrower') END AS partner_name,
          CASE WHEN b.borrower_id = $1 THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
          CASE WHEN b.borrower_id = $1 THEN lender.phone ELSE borrower.phone END AS partner_phone,
          m.content AS last_message,
          m.created_at AS last_message_at,
          b.created_at AS booking_created_at
        FROM bookings b
        JOIN items i ON b.item_id = i.id
        LEFT JOIN users borrower ON b.borrower_id = borrower.id
        LEFT JOIN users lender ON (b.lender_id = lender.id OR i.owner_id = lender.id)
        LEFT JOIN LATERAL (
          SELECT content, created_at FROM messages 
          WHERE booking_id = b.id 
          ORDER BY created_at DESC LIMIT 1
        ) m ON true
        WHERE (b.borrower_id = $1 OR b.lender_id = $1 OR i.owner_id = $1)
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $1 AND (ub.blocked_id = b.borrower_id OR ub.blocked_id = b.lender_id OR ub.blocked_id = i.owner_id))
               OR (ub.blocked_id = $1 AND (ub.blocker_id = b.borrower_id OR ub.blocker_id = b.lender_id OR ub.blocker_id = i.owner_id))
          )
        ORDER BY b.id, m.created_at DESC NULLS LAST
      ) convs
      ORDER BY COALESCE(convs.last_message_at, convs.booking_created_at) DESC`,
      [userId]
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Get Messages for a Booking
router.get('/:bookingId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    // Ensure user is part of the booking
    const bookingRes = await query(
      `SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1 AND (b.borrower_id = $2 OR b.lender_id = $2 OR i.owner_id = $2)`,
      [bookingId, userId]
    );

    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Conversation not found or access denied', 404);
    }

    const messagesRes = await query(
      `SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
        COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`,
      [bookingId]
    );

    return sendSuccess(res, {
      booking: bookingRes.rows[0],
      messages: messagesRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Send Message
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = sendMessageSchema.parse(req.body);
    const senderId = req.user!.id;

    // Verify booking membership & resolve lender
    const bookingRes = await query(
      `SELECT b.id, b.borrower_id, i.owner_id AS lender_id 
       FROM bookings b 
       JOIN items i ON b.item_id = i.id 
       WHERE b.id = $1`,
      [validated.booking_id]
    );

    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];
    if (booking.borrower_id !== senderId && booking.lender_id !== senderId) {
      return sendError(res, 'FORBIDDEN', 'Cannot send message to this booking', 403);
    }

    // 3NF: Automatically deduce receiver_id from the two booking parties if not supplied
    const targetReceiver = validated.receiver_id || (booking.borrower_id === senderId ? booking.lender_id : booking.borrower_id);

    // BLOCK CHECK: Prevent messages between users if either has blocked the other
    if (targetReceiver) {
      const blockCheck = await query(
        `SELECT 1 FROM user_blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [senderId, targetReceiver]
      );
      if (blockCheck.rows.length > 0) {
        return sendError(res, 'FORBIDDEN', 'Cannot send message. Communication between these users is blocked.', 403);
      }
    }

    const result = await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [validated.booking_id, senderId, targetReceiver, validated.content]
    );

    return sendSuccess(res, result.rows[0], 'Message sent');
  } catch (error) {
    next(error);
  }
});

export default router;
