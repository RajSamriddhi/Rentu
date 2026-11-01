"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
const createBookingSchema = zod_1.z.object({
    item_id: zod_1.z.string().uuid('Invalid item ID'),
    start_date: zod_1.z.string().min(1, 'Start date is required'),
    start_time: zod_1.z.string().optional(),
    end_date: zod_1.z.string().optional(),
    end_time: zod_1.z.string().optional(),
    duration_days: zod_1.z.number().int().positive('Duration must be at least 1 day'),
    total_price: zod_1.z.number().min(0).optional(),
    pickup_type: zod_1.z.string().optional().default('LENDER_LOCATION'),
    pickup_locality: zod_1.z.string().optional(),
    return_type: zod_1.z.string().optional().default('LENDER_LOCATION'),
    return_locality: zod_1.z.string().optional(),
    requires_delivery: zod_1.z.boolean().optional().default(false),
    delivery_fee: zod_1.z.number().min(0).optional().default(0),
    requires_pickup: zod_1.z.boolean().optional().default(false),
    pickup_fee: zod_1.z.number().min(0).optional().default(0),
    message: zod_1.z.string().optional(),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'HANDED_OVER', 'COMPLETED', 'CANCELLED']),
});
const verifyCodeSchema = zod_1.z.object({
    code: zod_1.z.string().min(4, 'Verification code is required'),
});
const submitReviewSchema = zod_1.z.object({
    rating: zod_1.z.number().min(1).max(5),
    comment: zod_1.z.string().optional().default(''),
});
// Create Booking Proposal ("Snag for the Weekend")
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = createBookingSchema.parse(req.body);
        const borrowerId = req.user.id;
        // Fetch Item & Owner
        const itemRes = await (0, db_1.query)('SELECT id, owner_id, price_per_day, title, status, available_for_borrowing FROM items WHERE id = $1', [validated.item_id]);
        if (itemRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Item not found', 404);
        }
        const item = itemRes.rows[0];
        if (item.owner_id === borrowerId) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'You cannot borrow your own gear 😉', 400);
        }
        // Determine concrete end date for rental period
        let finalEndDate = validated.end_date;
        if (!finalEndDate) {
            const sDate = new Date(validated.start_date);
            if (!isNaN(sDate.getTime())) {
                sDate.setDate(sDate.getDate() + Math.max(0, validated.duration_days - 1));
                finalEndDate = sDate.toISOString().split('T')[0];
            }
            else {
                finalEndDate = validated.start_date;
            }
        }
        // CALENDAR CONFLICT CHECK:
        // Prevent overlapping bookings if this product is already rented/handed over during these dates
        const overlapRes = await (0, db_1.query)(`SELECT 
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
       LIMIT 1`, [item.id, validated.start_date, finalEndDate]);
        if (overlapRes.rows.length > 0) {
            const conflict = overlapRes.rows[0];
            return (0, response_1.sendError)(res, 'CONFLICT', `This product is unavailable from ${conflict.start_date} to ${conflict.end_date} because it is already rented. Please pick different dates on the calendar.`, 409);
        }
        // Check borrowing permission if requested total_price is 0
        if (validated.total_price === 0 && Number(item.price_per_day) > 0 && !item.available_for_borrowing) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'The owner has not made this item available for free borrowing. It is only available for paid rent.', 400);
        }
        const totalPrice = validated.total_price !== undefined
            ? Number(validated.total_price)
            : Number(item.price_per_day) * validated.duration_days;
        // Pre-generate 6-digit pickup handover verification code
        const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        const bookingRes = await (0, db_1.query)(`INSERT INTO bookings
        (item_id, borrower_id, lender_id, start_date, start_time, end_date, end_time, duration_days, total_price, pickup_type, pickup_locality, return_type, return_locality, requires_delivery, delivery_fee, requires_pickup, pickup_fee, status, message, pickup_code)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING', $18, $19)
       RETURNING *`, [
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
        ]);
        const booking = bookingRes.rows[0];
        // Seed initial message if provided
        if (validated.message) {
            await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, $4)`, [booking.id, borrowerId, item.owner_id, validated.message]);
        }
        return (0, response_1.sendSuccess)(res, booking, 'Proposal sent to lender! You will be notified when they accept.', 201);
    }
    catch (error) {
        next(error);
    }
});
// Get User's Bookings (as Borrower and Lender)
router.get('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { role } = req.query; // 'borrower' | 'lender' | all
        let sql = `
      SELECT 
        b.id, b.item_id, b.borrower_id, i.owner_id AS lender_id, 
        b.start_date, b.start_time, b.end_date, b.end_time, b.duration_days,
        b.pickup_type, b.pickup_locality, b.return_type, b.return_locality,
        b.requires_delivery, b.delivery_fee, b.requires_pickup, b.pickup_fee,
        COALESCE(b.total_price, b.duration_days * i.price_per_day) AS total_price, 
        b.status, b.message, b.pickup_code, b.return_code, b.handed_over_at, b.completed_at, b.created_at,
        i.title AS item_title, i.image_urls AS item_images, i.category AS item_category,
        i.locality AS item_locality, i.price_per_day AS item_rate,
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
        const params = [userId];
        if (role === 'borrower') {
            sql += ` AND b.borrower_id = $1`;
        }
        else if (role === 'lender') {
            sql += ` AND i.owner_id = $1`;
        }
        sql += ` ORDER BY b.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Update Booking Status (Accept / Reject / Cancel)
router.patch('/:id/status', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = updateStatusSchema.parse(req.body);
        const userId = req.user.id;
        const bookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.owner_id AS lender_id, lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users lender ON i.owner_id = lender.id
       JOIN users borrower ON b.borrower_id = borrower.id
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        // Check authority: Lender can ACCEPT or REJECT. Borrower can CANCEL.
        const isLender = booking.lender_id === userId;
        const isBorrower = booking.borrower_id === userId;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isLender && !isBorrower && !isAdmin) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied', 403);
        }
        if (status === 'ACCEPTED' || status === 'REJECTED') {
            if (!isLender && !isAdmin) {
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the gear owner can accept or reject proposals', 403);
            }
        }
        // Generate pickup code if accepting and not already set
        let pickupCode = booking.pickup_code;
        if (status === 'ACCEPTED' && !pickupCode) {
            pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        }
        // Update status
        const updateRes = await (0, db_1.query)(`UPDATE bookings 
       SET status = $1, 
           pickup_code = COALESCE(pickup_code, $2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`, [status, pickupCode, id]);
        // Sync item status if accepted or completed
        if (status === 'ACCEPTED') {
            await (0, db_1.query)(`UPDATE items SET status = 'RENTED' WHERE id = $1`, [booking.item_id]);
            // Add notification chat message
            await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, '🎉 Proposal accepted! Meet at the designated place for pickup. Verify handoff with the 6-digit code.')`, [id, booking.lender_id, booking.borrower_id]);
        }
        else if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'REJECTED') {
            await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
        }
        return (0, response_1.sendSuccess)(res, updateRes.rows[0], `Proposal updated to ${status}`);
    }
    catch (error) {
        next(error);
    }
});
// Step 3 of 4: Verify Handover (Receiving the product) using 6-Digit Code
router.post('/:id/verify-pickup', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { code } = verifyCodeSchema.parse(req.body);
        const userId = req.user.id;
        const bookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.owner_id AS lender_id
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        const isLender = booking.lender_id === userId;
        const isBorrower = booking.borrower_id === userId;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isLender && !isBorrower && !isAdmin) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied', 403);
        }
        if (booking.status !== 'ACCEPTED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot verify handover for booking with status ${booking.status}`, 400);
        }
        if (!booking.pickup_code || booking.pickup_code.trim() !== code.trim()) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Incorrect 6-digit handover code. Please check the code with the other party.', 400);
        }
        // Generate Return Code for the next stage (Receiving back the product)
        const returnCode = Math.floor(100000 + Math.random() * 900000).toString();
        const updateRes = await (0, db_1.query)(`UPDATE bookings 
       SET status = 'HANDED_OVER', 
           handed_over_at = CURRENT_TIMESTAMP, 
           return_code = $1, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, [returnCode, id]);
        // Keep item status as RENTED
        await (0, db_1.query)(`UPDATE items SET status = 'RENTED' WHERE id = $1`, [booking.item_id]);
        // Send chat system message
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, '🤝 Product received & handed over successfully! The rental is now active. When returning, exchange the 6-digit return code.')`, [id, userId, isBorrower ? booking.lender_id : booking.borrower_id]);
        return (0, response_1.sendSuccess)(res, updateRes.rows[0], 'Product accepted & handed over successfully! Rental is now in use.');
    }
    catch (error) {
        next(error);
    }
});
// Step 4 of 4: Verify Return (Receiving back the product) using 6-Digit Code
router.post('/:id/verify-return', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { code } = verifyCodeSchema.parse(req.body);
        const userId = req.user.id;
        const bookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.owner_id AS lender_id
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        const isLender = booking.lender_id === userId;
        const isBorrower = booking.borrower_id === userId;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isLender && !isBorrower && !isAdmin) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied', 403);
        }
        if (booking.status !== 'HANDED_OVER') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot verify return for booking with status ${booking.status}`, 400);
        }
        if (!booking.return_code || booking.return_code.trim() !== code.trim()) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Incorrect 6-digit return code. Please check the code with the other party.', 400);
        }
        const updateRes = await (0, db_1.query)(`UPDATE bookings 
       SET status = 'COMPLETED', 
           completed_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`, [id]);
        // Release item back to AVAILABLE
        await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
        // Send chat system message
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, '🎉 Product returned to owner! The whole rental process is completed. Please leave reviews and feedback for each other (open for the next 3 days).')`, [id, userId, isBorrower ? booking.lender_id : booking.borrower_id]);
        return (0, response_1.sendSuccess)(res, updateRes.rows[0], 'Product returned successfully! You can now leave a review.');
    }
    catch (error) {
        next(error);
    }
});
// Submit Review & Feedback (Available for at most 3 days after completion)
router.post('/:id/review', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rating, comment } = submitReviewSchema.parse(req.body);
        const userId = req.user.id;
        const bookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.owner_id AS lender_id
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        const isLender = booking.lender_id === userId;
        const isBorrower = booking.borrower_id === userId;
        if (!isLender && !isBorrower) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only participants of this rental can leave reviews', 403);
        }
        if (booking.status !== 'COMPLETED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Reviews can only be submitted after the product is returned and completed', 400);
        }
        // Check 3-day window (at most 3 days after completion)
        const completedAt = new Date(booking.completed_at || booking.updated_at);
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        if (Date.now() - completedAt.getTime() > threeDaysMs) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Review period has expired. Reviews are available for at most 3 days after completion.', 400);
        }
        const revieweeId = isBorrower ? booking.lender_id : booking.borrower_id;
        // Check if user already reviewed
        const existing = await (0, db_1.query)(`SELECT id FROM reviews WHERE booking_id = $1 AND reviewer_id = $2`, [id, userId]);
        let reviewResult;
        if (existing.rows.length > 0) {
            reviewResult = await (0, db_1.query)(`UPDATE reviews 
         SET rating = $1, comment = $2, created_at = CURRENT_TIMESTAMP 
         WHERE booking_id = $3 AND reviewer_id = $4 
         RETURNING *`, [rating, comment || '', id, userId]);
        }
        else {
            reviewResult = await (0, db_1.query)(`INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`, [id, userId, revieweeId, rating, comment || '']);
        }
        // Update reviewee rating & trust score in users table
        await (0, db_1.query)(`UPDATE users 
       SET rating = (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE reviewee_id = $1),
           trust_score = LEAST(100, COALESCE(trust_score, 95) + 1)
       WHERE id = $1`, [revieweeId]).catch(() => { });
        return (0, response_1.sendSuccess)(res, reviewResult.rows[0], 'Thank you! Your review and feedback has been recorded.');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
