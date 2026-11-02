import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { createNotification } from '../notifications/notifications.service';

const router = Router();

const createBookingSchema = z.object({
  item_id: z.string().uuid('Invalid item ID'),
  start_date: z.string().min(1, 'Start date is required'),
  start_time: z.string().optional(),
  end_date: z.string().optional(),
  end_time: z.string().optional(),
  duration_days: z.number().int().positive('Duration must be at least 1 day'),
  total_price: z.number().min(0).optional(),
  pickup_type: z.string().optional().default('LENDER_LOCATION'),
  pickup_locality: z.string().optional(),
  return_type: z.string().optional().default('LENDER_LOCATION'),
  return_locality: z.string().optional(),
  requires_delivery: z.boolean().optional().default(false),
  delivery_fee: z.number().min(0).optional().default(0),
  requires_pickup: z.boolean().optional().default(false),
  pickup_fee: z.number().min(0).optional().default(0),
  message: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'HANDED_OVER', 'COMPLETED', 'CANCELLED']),
});

const verifyCodeSchema = z.object({
  code: z.string().min(4, 'Verification code is required'),
});

const submitReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be between 1 and 5 stars').max(5, 'Rating must be between 1 and 5 stars'),
  comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').optional().default(''),
  review_type: z.enum(['OWNER_RENTAL', 'RENTER', 'COMMUNITY_LENDER']).optional(),
});

// Create Booking Proposal ("Snag for the Weekend")
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = createBookingSchema.parse(req.body);
    const borrowerId = req.user!.id;

    // Fetch Item & Owner
    const itemRes = await query('SELECT id, owner_id, price_per_day, title, status, available_for_borrowing FROM items WHERE id = $1', [validated.item_id]);
    if (itemRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    const item = itemRes.rows[0];
    if (item.owner_id === borrowerId) {
      return sendError(res, 'BAD_REQUEST', 'You cannot borrow your own gear 😉', 400);
    }

    // Block check: borrower cannot book from owner if either has blocked the other
    const blockCheck = await query(
      `SELECT 1 FROM user_blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [borrowerId, item.owner_id]
    );
    if (blockCheck.rows.length > 0) {
      return sendError(res, 'FORBIDDEN', 'Cannot rent from this user due to a block.', 403);
    }

    // Determine concrete end date for rental period
    let finalEndDate = validated.end_date;
    if (!finalEndDate) {
      const sDate = new Date(validated.start_date);
      if (!isNaN(sDate.getTime())) {
        sDate.setDate(sDate.getDate() + Math.max(0, validated.duration_days - 1));
        finalEndDate = sDate.toISOString().split('T')[0];
      } else {
        finalEndDate = validated.start_date;
      }
    }

    // CALENDAR CONFLICT CHECK:
    // Prevent overlapping bookings if this product is already rented/handed over during these dates
    const overlapRes = await query(
      `SELECT 
        id, 
        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
        TO_CHAR(COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date
       FROM bookings 
       WHERE item_id = $1 
         AND status IN ('ACCEPTED', 'HANDED_OVER')
         AND (
           start_date <= $3::date 
           AND COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date) >= $2::date
         )
       LIMIT 1`,
      [item.id, validated.start_date, finalEndDate]
    );

    if (overlapRes.rows.length > 0) {
      const conflict = overlapRes.rows[0];
      return sendError(
        res,
        'CONFLICT',
        `This product is unavailable from ${conflict.start_date} to ${conflict.end_date} because it is already rented. Please pick different dates on the calendar.`,
        409
      );
    }

    // Check borrowing permission if requested total_price is 0
    if (validated.total_price === 0 && Number(item.price_per_day) > 0 && !item.available_for_borrowing) {
      return sendError(
        res, 
        'BAD_REQUEST', 
        'The owner has not made this item available for free borrowing. It is only available for paid rent.', 
        400
      );
    }

    const totalPrice = validated.total_price !== undefined 
      ? Number(validated.total_price) 
      : Number(item.price_per_day) * validated.duration_days;

    // Pre-generate 6-digit pickup handover verification code
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();

    const bookingRes = await query(
      `INSERT INTO bookings
        (item_id, borrower_id, lender_id, start_date, start_time, end_date, end_time, duration_days, total_price, pickup_type, pickup_locality, return_type, return_locality, requires_delivery, delivery_fee, requires_pickup, pickup_fee, status, message, pickup_code)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING', $18, $19)
       RETURNING *`,
      [
        item.id,
        borrowerId,
        item.owner_id,
        validated.start_date,
        validated.start_time || '10:00',
        finalEndDate,
        validated.end_time || '18:00',
        validated.duration_days,
        totalPrice,
        validated.pickup_type || 'LENDER_LOCATION',
        validated.pickup_locality || null,
        validated.return_type || 'LENDER_LOCATION',
        validated.return_locality || null,
        validated.requires_delivery ?? false,
        validated.delivery_fee ?? 0,
        validated.requires_pickup ?? false,
        validated.pickup_fee ?? 0,
        validated.message || `Hey! Would love to rent your ${item.title}.`,
        pickupCode,
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

    // Query borrower name for notifications
    const borrowerUserRes = await query('SELECT name FROM users WHERE id = $1', [borrowerId]);
    const borrowerName = borrowerUserRes.rows[0]?.name || 'A community member';

    // Notify Lender about the new rental request
    await createNotification({
      userId: item.owner_id,
      senderId: borrowerId,
      bookingId: booking.id,
      referenceId: booking.id,
      referenceType: 'BOOKING',
      type: 'BOOKING_PROPOSAL',
      title: 'Rental Request',
      body: `${borrowerName} requested to rent "${item.title}".`,
    });

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
        TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date, 
        b.start_time, 
        TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date, 
        b.end_time, 
        b.duration_days,
        b.pickup_type, b.pickup_locality, b.return_type, b.return_locality,
        b.requires_delivery, b.delivery_fee, b.requires_pickup, b.pickup_fee,
        COALESCE(b.total_price, b.duration_days * i.price_per_day) AS total_price, 
        b.status, b.message, b.pickup_code, b.return_code, b.handed_over_at, b.returned_at, b.completed_at, b.created_at,
        b.payment_status, b.payment_method,
        i.title AS item_title, i.image_urls AS item_images, i.category AS item_category,
        i.locality AS item_locality, i.price_per_day AS item_rate,
        COALESCE(b.pickup_locality, i.address_text, lender.address_text) AS pickup_address,
        COALESCE(b.return_locality, i.address_text, lender.address_text) AS return_address,
        lender.address_text AS lender_address,
        borrower.name AS borrower_name, borrower.avatar_url AS borrower_avatar, 
        borrower.phone AS borrower_phone, borrower.email AS borrower_email,
        lender.name AS lender_name, lender.avatar_url AS lender_avatar,
        lender.phone AS lender_phone, lender.email AS lender_email,
        rev.id AS user_review_id,
        rev.rating AS user_rating,
        rev.comment AS user_comment,
        rev.created_at AS user_reviewed_at
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      JOIN users borrower ON b.borrower_id = borrower.id
      JOIN users lender ON i.owner_id = lender.id
      LEFT JOIN reviews rev ON rev.booking_id = b.id AND rev.reviewer_id = $1
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

// Update Booking Status (Accept / Reject / Cancel)
router.patch('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);
    const userId = req.user!.id;

    const bookingRes = await query(
      `SELECT b.*, 
              TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
              TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str,
              i.title AS item_title, i.owner_id AS lender_id, lender.name AS lender_name, borrower.name AS borrower_name
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

    // Check authority: Lender can ACCEPT or REJECT. Borrower can CANCEL.
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

    // Generate pickup code if accepting and not already set
    let pickupCode = booking.pickup_code;
    if (status === 'ACCEPTED' && !pickupCode) {
      pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Update status
    const updateRes = await query(
      `UPDATE bookings 
       SET status = $1, 
           pickup_code = COALESCE(pickup_code, $2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, pickupCode, id]
    );

    const sDate = booking.start_date_str || booking.start_date;
    const eDate = booking.end_date_str || booking.end_date;

    // Sync item status & trigger lifecycle notifications
    if (status === 'ACCEPTED') {
      // Items remain AVAILABLE because rentals are date-specific (booked for particular days only)
      await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
      // Add notification chat message
      await query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, '🎉 Proposal accepted! Meet at the designated place for pickup. Verify handoff with the 6-digit code.')`,
        [id, booking.lender_id, booking.borrower_id]
      );

      // Notify Borrower: Proposal Accepted
      await createNotification({
        userId: booking.borrower_id,
        senderId: booking.lender_id,
        bookingId: id,
        referenceId: id,
        referenceType: 'BOOKING',
        type: 'BOOKING_ACCEPTED',
        title: 'Rental Accepted',
        body: `${booking.lender_name} accepted your request for "${booking.item_title}".`,
      });

    } else if (status === 'REJECTED') {
      await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);

      // Notify Borrower: Declined
      await createNotification({
        userId: booking.borrower_id,
        senderId: booking.lender_id,
        bookingId: id,
        referenceId: id,
        referenceType: 'BOOKING',
        type: 'BOOKING_REJECTED',
        title: 'Rental Request Declined',
        body: `${booking.lender_name} declined your request for "${booking.item_title}".`,
      });

    } else if (status === 'CANCELLED') {
      await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);

      const otherPartyId = isBorrower ? booking.lender_id : booking.borrower_id;
      const actorName = isBorrower ? (booking.borrower_name || 'Borrower') : (booking.lender_name || 'Owner');
      await createNotification({
        userId: otherPartyId,
        senderId: userId,
        bookingId: id,
        referenceId: id,
        referenceType: 'BOOKING',
        type: 'BOOKING_CANCELLED',
        title: 'Rental Cancelled',
        body: `${actorName} cancelled the rental for "${booking.item_title}".`,
      });
    }

    return sendSuccess(res, updateRes.rows[0], `Proposal updated to ${status}`);
  } catch (error) {
    next(error);
  }
});

// Step 3 of 4: Verify Handover (Receiving the product) using 6-Digit Code
router.post('/:id/verify-pickup', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { code } = verifyCodeSchema.parse(req.body);
    const userId = req.user!.id;

    const bookingRes = await query(
      `SELECT b.*, 
              TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
              TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str,
              i.title AS item_title, i.owner_id AS lender_id, lender.name AS lender_name, borrower.name AS borrower_name
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
    const isLender = booking.lender_id === userId;
    const isBorrower = booking.borrower_id === userId;
    const isAdmin = req.user!.role === 'ADMIN';

    if (!isLender && !isBorrower && !isAdmin) {
      return sendError(res, 'FORBIDDEN', 'Permission denied', 403);
    }

    if (booking.status !== 'ACCEPTED') {
      return sendError(res, 'BAD_REQUEST', `Cannot verify handover for booking with status ${booking.status}`, 400);
    }

    if (!booking.pickup_code || booking.pickup_code.trim() !== code.trim()) {
      return sendError(res, 'BAD_REQUEST', 'Incorrect 6-digit handover code. Please check the code with the other party.', 400);
    }

    // Generate Return Code for the next stage (Receiving back the product)
    const returnCode = Math.floor(100000 + Math.random() * 900000).toString();

    const updateRes = await query(
      `UPDATE bookings 
       SET status = 'HANDED_OVER', 
           handed_over_at = CURRENT_TIMESTAMP, 
           return_code = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [returnCode, id]
    );

    // Keep item status as AVAILABLE since item is rented only for agreed dates
    await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);

    // Send chat system message
    await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, '🤝 Product received & handed over successfully! The rental is now active. When returning, exchange the 6-digit return code.')`,
      [id, userId, isBorrower ? booking.lender_id : booking.borrower_id]
    );

    const sDate = booking.start_date_str || booking.start_date;
    const eDate = booking.end_date_str || booking.end_date;

    // 1. Notify Borrower: Gear Received
    await createNotification({
      userId: booking.borrower_id,
      senderId: booking.lender_id,
      bookingId: id,
      referenceId: id,
      referenceType: 'BOOKING',
      type: 'BOOKING_RECEIVED',
      title: 'Handover Completed',
      body: `${booking.lender_name || 'Owner'} handed over "${booking.item_title}" to you.`,
    });

    // 2. Notify Lender: Handover Verified
    await createNotification({
      userId: booking.lender_id,
      senderId: booking.borrower_id,
      bookingId: id,
      referenceId: id,
      referenceType: 'BOOKING',
      type: 'BOOKING_HANDED_OVER',
      title: 'Handover Completed',
      body: `${booking.borrower_name || 'Borrower'} received "${booking.item_title}".`,
    });

    return sendSuccess(res, updateRes.rows[0], 'Product accepted & handed over successfully! Rental is now in use.');
  } catch (error) {
    next(error);
  }
});

// Step 4 of 4: Verify Return (Receiving back the product) using 6-Digit Code
router.post('/:id/verify-return', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { code } = verifyCodeSchema.parse(req.body);
    const userId = req.user!.id;

    const bookingRes = await query(
      `SELECT b.*, 
              TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
              TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str,
              i.title AS item_title, i.owner_id AS lender_id, lender.name AS lender_name, borrower.name AS borrower_name
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
    const isLender = booking.lender_id === userId;
    const isBorrower = booking.borrower_id === userId;
    const isAdmin = req.user!.role === 'ADMIN';

    if (!isLender && !isBorrower && !isAdmin) {
      return sendError(res, 'FORBIDDEN', 'Permission denied', 403);
    }

    if (booking.status !== 'HANDED_OVER') {
      return sendError(res, 'BAD_REQUEST', `Cannot verify return for booking with status ${booking.status}`, 400);
    }

    if (!booking.return_code || booking.return_code.trim() !== code.trim()) {
      return sendError(res, 'BAD_REQUEST', 'Incorrect 6-digit return code. Please check the code with the other party.', 400);
    }

    const isFree = Number(booking.total_price) === 0;

    const updateRes = await query(
      `UPDATE bookings 
       SET status = CASE WHEN $2::boolean THEN 'COMPLETED'::booking_status ELSE status END,
           returned_at = CURRENT_TIMESTAMP,
           completed_at = CASE WHEN $2::boolean THEN CURRENT_TIMESTAMP ELSE completed_at END,
           payment_status = CASE WHEN $2::boolean THEN 'CONFIRMED' ELSE 'PENDING' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, isFree]
    );

    if (isFree) {
      // Release item back to AVAILABLE
      await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
    }

    // Send chat system message
    await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)`,
      [
        id, 
        userId, 
        isBorrower ? booking.lender_id : booking.borrower_id,
        isFree 
          ? '🎉 Product returned to owner! The whole rental process is completed. Please leave reviews for each other.'
          : '📦 Product returned to owner! Stage 5: Payment settlement is now active.'
      ]
    );

    return sendSuccess(
      res, 
      updateRes.rows[0], 
      isFree 
        ? 'Product returned successfully! Whole process completed.' 
        : 'Product return verified! Please proceed to payment settlement.'
    );
  } catch (error) {
    next(error);
  }
});

// Stage 5: Renter marks payment as sent
router.post('/:id/submit-payment', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { payment_method = 'UPI' } = req.body;
    const userId = req.user!.id;

    const bookingRes = await query(`SELECT * FROM bookings WHERE id = $1`, [id]);
    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }
    const booking = bookingRes.rows[0];
    if (booking.borrower_id !== userId && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only the renter can submit payment', 403);
    }

    const updateRes = await query(
      `UPDATE bookings 
       SET payment_status = 'SUBMITTED',
           payment_method = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [payment_method, id]
    );

    await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, '💳 Renter has sent the payment via ' || $4 || '. Owner, please verify and confirm receipt.')`,
      [id, userId, booking.lender_id, payment_method]
    );

    return sendSuccess(res, updateRes.rows[0], 'Payment marked as sent! Waiting for owner verification.');
  } catch (error) {
    next(error);
  }
});

// Stage 5: Owner confirms payment received -> Marks whole process COMPLETED
router.post('/:id/confirm-payment', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const bookingRes = await query(
      `SELECT b.*, i.owner_id AS lender_id, b.item_id, i.title AS item_title
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`,
      [id]
    );
    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }
    const booking = bookingRes.rows[0];
    if (booking.lender_id !== userId && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only the owner can confirm receiving payment', 403);
    }

    const updateRes = await query(
      `UPDATE bookings 
       SET status = 'COMPLETED',
           completed_at = CURRENT_TIMESTAMP,
           payment_status = 'CONFIRMED',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Release item back to AVAILABLE
    await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);

    await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, '🎉 Product returned to owner! The whole rental process is completed. Please leave reviews and feedback for each other (open for the next 3 days).')`,
      [id, userId, booking.borrower_id]
    );

    // Notify Borrower: Rental Completed
    await createNotification({
      userId: booking.borrower_id,
      senderId: booking.lender_id,
      bookingId: id,
      referenceId: id,
      referenceType: 'BOOKING',
      type: 'BOOKING_COMPLETED',
      title: 'Rental Completed',
      body: `${booking.lender_name || 'Owner'} confirmed the return of "${booking.item_title}".`,
    });

    return sendSuccess(res, updateRes.rows[0], 'Product returned successfully! You can now leave a review.');
  } catch (error) {
    next(error);
  }
});

// Submit Review & Feedback (Available for at most 3 days after completion)
router.post('/:id/review', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { rating, comment, review_type } = submitReviewSchema.parse(req.body);
    const userId = req.user!.id;

    const bookingRes = await query(
      `SELECT b.*, i.title AS item_title, i.owner_id AS lender_id, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`,
      [id]
    );

    if (bookingRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookingRes.rows[0];
    const isLender = booking.lender_id === userId;
    const isBorrower = booking.borrower_id === userId;

    if (!isLender && !isBorrower) {
      return sendError(res, 'FORBIDDEN', 'Only verified participants of this rental can leave reviews', 403);
    }

    if (booking.lender_id === booking.borrower_id) {
      return sendError(res, 'BAD_REQUEST', 'Self-reviews are strictly forbidden', 400);
    }

    if (booking.status !== 'COMPLETED') {
      return sendError(res, 'BAD_REQUEST', 'Reviews can only be submitted after the product is returned and completed', 400);
    }

    // Check 3-day window (at most 3 days after completion)
    const completedAt = new Date(booking.completed_at || booking.updated_at);
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - completedAt.getTime() > threeDaysMs) {
      return sendError(res, 'BAD_REQUEST', 'Review period has expired. Reviews are available for at most 3 days after completion.', 400);
    }

    const revieweeId = isBorrower ? booking.lender_id : booking.borrower_id;
    if (!revieweeId || revieweeId === userId) {
      return sendError(res, 'BAD_REQUEST', 'You cannot review yourself', 400);
    }

    // Tamper-proof role-based review type:
    // 1) Borrower reviewing owner: OWNER_RENTAL (for paid rental) or COMMUNITY_LENDER (for ₹0 / free borrow)
    // 2) Owner reviewing borrower: RENTER
    let resolvedReviewType: 'OWNER_RENTAL' | 'RENTER' | 'COMMUNITY_LENDER';
    if (isBorrower) {
      const isFree = Number(booking.total_price || 0) <= 0 || Number(booking.price_per_day || 0) <= 0;
      resolvedReviewType = isFree ? 'COMMUNITY_LENDER' : 'OWNER_RENTAL';
    } else {
      resolvedReviewType = 'RENTER';
    }

    // Check if user already reviewed
    const existing = await query(
      `SELECT id FROM reviews WHERE booking_id = $1 AND reviewer_id = $2`,
      [id, userId]
    );

    let reviewResult;
    if (existing.rows.length > 0) {
      reviewResult = await query(
        `UPDATE reviews 
         SET rating = $1, comment = $2, review_type = $3, created_at = CURRENT_TIMESTAMP 
         WHERE booking_id = $4 AND reviewer_id = $5 
         RETURNING *`,
        [rating, comment || '', resolvedReviewType, id, userId]
      );
    } else {
      reviewResult = await query(
        `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment, review_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, userId, revieweeId, rating, comment || '', resolvedReviewType]
      );
    }

    // Recalculate 3 review ratings + overall trust rating (strictly dynamically computed from actual reviews table)
    await query(`
      WITH stats AS (
        SELECT 
          ROUND(COALESCE(AVG(CASE WHEN review_type = 'OWNER_RENTAL' THEN rating END), 0.00), 2) AS owner_rating,
          COUNT(CASE WHEN review_type = 'OWNER_RENTAL' THEN 1 END)::int AS owner_count,
          ROUND(COALESCE(AVG(CASE WHEN review_type = 'RENTER' THEN rating END), 0.00), 2) AS renter_rating,
          COUNT(CASE WHEN review_type = 'RENTER' THEN 1 END)::int AS renter_count,
          ROUND(COALESCE(AVG(CASE WHEN review_type = 'COMMUNITY_LENDER' THEN rating END), 0.00), 2) AS community_lender_rating,
          COUNT(CASE WHEN review_type = 'COMMUNITY_LENDER' THEN 1 END)::int AS community_lender_count,
          ROUND(COALESCE(AVG(rating), 0.00), 2) AS trust_rating,
          COUNT(*)::int AS total_reviews
        FROM reviews
        WHERE reviewee_id = $1
      )
      UPDATE users
      SET 
        owner_rating = stats.owner_rating,
        owner_reviews_count = stats.owner_count,
        renter_rating = stats.renter_rating,
        renter_reviews_count = stats.renter_count,
        community_lender_rating = stats.community_lender_rating,
        community_lender_reviews_count = stats.community_lender_count,
        trust_rating = stats.trust_rating,
        rating = stats.trust_rating,
        trust_score = CASE WHEN stats.total_reviews = 0 THEN 90 ELSE LEAST(100, GREATEST(80, 92 + stats.total_reviews)) END
      FROM stats
      WHERE users.id = $1
    `, [revieweeId]).catch((err) => {
      console.error('Failed to update ratings for reviewee:', err);
    });

    // Notify reviewee about new feedback
    const reviewerRes = await query('SELECT name FROM users WHERE id = $1', [userId]);
    const reviewerName = reviewerRes.rows[0]?.name || 'Your rental partner';

    await createNotification({
      userId: revieweeId,
      senderId: userId,
      bookingId: id,
      referenceId: id,
      referenceType: 'BOOKING',
      type: 'BOOKING_REVIEW',
      title: 'New Review & Rating Received ⭐',
      body: `${reviewerName} left a ${rating}-star review for the "${booking.item_title}" rental!`,
    });

    return sendSuccess(res, reviewResult.rows[0], 'Thank you! Your review and feedback has been recorded.');
  } catch (error) {
    next(error);
  }
});

export default router;
