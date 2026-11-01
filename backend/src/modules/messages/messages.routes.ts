import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const sendMessageSchema = z.object({
  booking_id: z.string().optional().nullable(),
  receiver_id: z.string().min(1, 'Receiver is required'),
  content: z.string().min(1, 'Message cannot be empty'),
});

const isUuid = (val: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// 1. Get User's Active Conversations (Both Bookings & Direct DMs)
router.get('/conversations', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Get bookings & direct messages (excluding blocked relationships)
    const result = await query(
      `WITH user_convs AS (
        -- 1. Rental Booking conversations
        SELECT 
          b.id::text AS conversation_id,
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
          b.created_at AS created_at
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

        UNION ALL

        -- 2. Direct DM conversations (booking_id IS NULL)
        SELECT
          'dm_' || partner.id AS conversation_id,
          NULL::uuid AS booking_id,
          'DIRECT_DM' AS booking_status,
          NULL::date AS start_date,
          NULL::integer AS duration_days,
          0 AS total_price,
          'Direct Chat' AS item_title,
          ARRAY[]::text[] AS item_images,
          partner.locality AS item_locality,
          partner.id AS partner_id,
          partner.name AS partner_name,
          partner.avatar_url AS partner_avatar,
          partner.phone AS partner_phone,
          dm.content AS last_message,
          dm.created_at AS last_message_at,
          dm.created_at AS created_at
        FROM (
          SELECT DISTINCT ON (
            CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
          )
            id,
            CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id,
            content,
            created_at
          FROM messages
          WHERE booking_id IS NULL AND (sender_id = $1 OR receiver_id = $1)
          ORDER BY CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END, created_at DESC
        ) dm
        JOIN users partner ON dm.partner_id = partner.id
        WHERE NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id = $1 AND ub.blocked_id = partner.id)
             OR (ub.blocked_id = $1 AND ub.blocker_id = partner.id)
        )
      )
      SELECT * FROM user_convs
      ORDER BY COALESCE(last_message_at, created_at) DESC`,
      [userId]
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// 2. Get Messages for a Booking OR a Direct Message (DM)
router.get('/:conversationId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.id;

    const isDm = conversationId.startsWith('dm_') || !isUuid(conversationId);
    const partnerId = isDm ? conversationId.replace(/^dm_/, '') : null;

    if (isDm && partnerId) {
      // Check block
      const blockCheck = await query(
        `SELECT 1 FROM user_blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [userId, partnerId]
      );
      if (blockCheck.rows.length > 0) {
        return sendError(res, 'FORBIDDEN', 'Communication with this user is blocked.', 403);
      }

      // Fetch partner info
      const partnerRes = await query(
        `SELECT id, name, avatar_url, locality, phone FROM users WHERE id = $1`,
        [partnerId]
      );
      const partnerData = partnerRes.rows[0] || {
        id: partnerId,
        name: 'Community Member',
        avatar_url: null,
        locality: 'Bengaluru',
      };

      // Fetch direct messages between them
      const messagesRes = await query(
        `SELECT 
          m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
          COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
         FROM messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE (m.booking_id IS NULL)
           AND ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
         ORDER BY m.created_at ASC`,
        [userId, partnerId]
      );

      return sendSuccess(res, {
        booking: null,
        partner: partnerData,
        messages: messagesRes.rows,
      });
    }

    // Otherwise, check booking by UUID
    const bookingRes = await query(
      `SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1 AND (b.borrower_id = $2 OR b.lender_id = $2 OR i.owner_id = $2)`,
      [conversationId, userId]
    );

    if (bookingRes.rows.length === 0) {
      // Check if conversationId was a user ID formatted as UUID
      const userRes = await query(`SELECT id, name, avatar_url, locality, phone FROM users WHERE id = $1`, [conversationId]);
      if (userRes.rows.length > 0) {
        const partner = userRes.rows[0];
        const messagesRes = await query(
          `SELECT 
            m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
            COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
           FROM messages m
           LEFT JOIN users u ON m.sender_id = u.id
           WHERE (m.booking_id IS NULL)
             AND ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
           ORDER BY m.created_at ASC`,
          [userId, partner.id]
        );
        return sendSuccess(res, {
          booking: null,
          partner,
          messages: messagesRes.rows,
        });
      }
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
      [conversationId]
    );

    return sendSuccess(res, {
      booking: bookingRes.rows[0],
      messages: messagesRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

// 3. Send Message (Booking Message OR Direct Message)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = sendMessageSchema.parse(req.body);
    const senderId = req.user!.id;

    let targetBookingId: string | null = null;
    let targetReceiverId = validated.receiver_id;

    if (validated.booking_id && isUuid(validated.booking_id)) {
      const bookingRes = await query(
        `SELECT b.id, b.borrower_id, i.owner_id AS lender_id 
         FROM bookings b 
         JOIN items i ON b.item_id = i.id 
         WHERE b.id = $1`,
        [validated.booking_id]
      );
      if (bookingRes.rows.length > 0) {
        const booking = bookingRes.rows[0];
        if (booking.borrower_id === senderId || booking.lender_id === senderId) {
          targetBookingId = booking.id;
          targetReceiverId = targetReceiverId || (booking.borrower_id === senderId ? booking.lender_id : booking.borrower_id);
        }
      }
    }

    if (!targetReceiverId) {
      return sendError(res, 'BAD_REQUEST', 'Recipient is required', 400);
    }

    // BLOCK CHECK: Prevent messages between users if either has blocked the other
    const blockCheck = await query(
      `SELECT 1 FROM user_blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [senderId, targetReceiverId]
    );
    if (blockCheck.rows.length > 0) {
      return sendError(res, 'FORBIDDEN', 'Cannot send message. Communication between these users is blocked.', 403);
    }

    const result = await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [targetBookingId, senderId, targetReceiverId, validated.content]
    );

    const inserted = result.rows[0];

    return sendSuccess(res, {
      ...inserted,
      sender_name: req.user!.name || 'You',
      sender_avatar: req.user!.avatar_url,
    }, 'Message sent');
  } catch (error) {
    next(error);
  }
});

export default router;
