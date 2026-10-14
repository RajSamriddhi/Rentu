import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const createBookingSchema = z.object({
  item_id: z.string().uuid('Invalid item ID'),
  start_date: z.string().min(1, 'Start date is required'),
  start_time: z.string().optional(),
  duration_days: z.number().int().positive('Duration must be at least 1 day'),
  message: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED']),
});

// Create Booking Proposal ("Snag for the Weekend")
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = createBookingSchema.parse(req.body);
    const borrowerId = req.user!.id;

    // Fetch Item & Owner
    const itemRes = await query('SELECT id, owner_id, price_per_day, title, status FROM items WHERE id = $1', [validated.item_id]);
    if (itemRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    const item = itemRes.rows[0];
    if (item.owner_id === borrowerId) {
      return sendError(res, 'BAD_REQUEST', 'You cannot borrow your own gear 😉', 400);
    }

    const totalPrice = Number(item.price_per_day) * validated.duration_days;

    const bookingRes = await query(
      `INSERT INTO bookings
        (item_id, borrower_id, lender_id, start_date, start_time, duration_days, total_price, status, message)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
       RETURNING *`,
      [
        item.id,
        borrowerId,
        item.owner_id,
        validated.start_date,
        validated.start_time || '10:00',
        validated.duration_days,
        totalPrice,
        validated.message || `Hey! Would love to rent your ${item.title}.`,
      ]
    );

    const booking = bookingRes.rows[0];

    // Seed initial message if provided
    if (validated.message) {
      await query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, $4)`,
        [booking.id, borrowerId, item.owner_id, validated.message]
      );
    }

    return sendSuccess(res, booking, 'Proposal sent to lender! You will be notified when they accept.', 201);
  } catch (error) {
    next(error);
  }
});

// Get User's Bookings (as Borrower and Lender)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { role } = req.query; // 'borrower' | 'lender' | all

    let sql = `
      SELECT 
        b.id, b.item_id, b.borrower_id, i.owner_id AS lender_id, 
        b.start_date, b.start_time, b.duration_days, 
        COALESCE(b.total_price, b.duration_days * i.price_per_day) AS total_price, 
        b.status, b.message, b.created_at,
        i.title AS item_title, i.image_urls AS item_images, i.category AS item_category,
        i.locality AS item_locality, i.price_per_day AS item_rate,
        borrower.name AS borrower_name, borrower.avatar_url AS borrower_avatar, 
        borrower.phone AS borrower_phone, borrower.email AS borrower_email,
        lender.name AS lender_name, lender.avatar_url AS lender_avatar,
        lender.phone AS lender_phone, lender.email AS lender_email
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      JOIN users borrower ON b.borrower_id = borrower.id
      JOIN users lender ON i.owner_id = lender.id
      WHERE (b.borrower_id = $1 OR i.owner_id = $1)
    `;
    const params: any[] = [userId];

    if (role === 'borrower') {
      sql += ` AND b.borrower_id = $1`;
    } else if (role === 'lender') {
      sql += ` AND i.owner_id = $1`;
    }

    sql += ` ORDER BY b.created_at DESC`;

    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Update Booking Status (Accept / Reject / Complete)
router.patch('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);
    const userId = req.user!.id;

    const bookingRes = await query(
      `SELECT b.*, i.title AS item_title, i.owner_id AS lender_id, lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users lender ON i.owner_id = lender.id
       JOIN users borrower ON b.borrower_id = borrower.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];

    // Check authority: Lender can ACCEPT or REJECT or COMPLETE. Borrower can CANCEL.
    const isLender = booking.lender_id === userId;
    const isBorrower = booking.borrower_id === userId;
    const isAdmin = req.user!.role === 'ADMIN';

    if (!isLender && !isBorrower && !isAdmin) {
      return sendError(res, 'FORBIDDEN', 'Permission denied', 403);
    }

    if (status === 'ACCEPTED' || status === 'REJECTED') {
      if (!isLender && !isAdmin) {
        return sendError(res, 'FORBIDDEN', 'Only the gear owner can accept or reject proposals', 403);
      }
    }

    // Update status
    const updateRes = await query(
      `UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    // Sync item status if accepted or completed
    if (status === 'ACCEPTED') {
      await query(`UPDATE items SET status = 'RENTED' WHERE id = $1`, [booking.item_id]);
      // Add notification chat message
      await query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, '🎉 Proposal accepted! You can now coordinate pickup/dropoff here.')`,
        [id, booking.lender_id, booking.borrower_id]
      );
    } else if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'REJECTED') {
      await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
    }

    return sendSuccess(res, updateRes.rows[0], `Proposal updated to ${status}`);
  } catch (error) {
    next(error);
  }
});

export default router;
