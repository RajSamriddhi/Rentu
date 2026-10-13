"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
const sendMessageSchema = zod_1.z.object({
    booking_id: zod_1.z.string().uuid(),
    receiver_id: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1, 'Message cannot be empty'),
});
// Get User's Active Conversations
router.get('/conversations', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Get bookings that have messages involving user
        const result = await (0, db_1.query)(`SELECT DISTINCT ON (b.id)
        b.id AS booking_id,
        b.status AS booking_status,
        b.start_date,
        b.duration_days,
        b.total_price,
        i.title AS item_title,
        i.image_urls AS item_images,
        i.locality AS item_locality,
        CASE WHEN b.borrower_id = $1 THEN lender.id ELSE borrower.id END AS partner_id,
        CASE WHEN b.borrower_id = $1 THEN lender.name ELSE borrower.name END AS partner_name,
        CASE WHEN b.borrower_id = $1 THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
        CASE WHEN b.borrower_id = $1 THEN lender.phone ELSE borrower.phone END AS partner_phone,
        m.content AS last_message,
        m.created_at AS last_message_at
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      JOIN users borrower ON b.borrower_id = borrower.id
      JOIN users lender ON b.lender_id = lender.id
      LEFT JOIN LATERAL (
        SELECT content, created_at FROM messages 
        WHERE booking_id = b.id 
        ORDER BY created_at DESC LIMIT 1
      ) m ON true
      WHERE (b.borrower_id = $1 OR b.lender_id = $1)
      ORDER BY b.id, m.created_at DESC NULLS LAST`, [userId]);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Get Messages for a Booking
router.get('/:bookingId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const userId = req.user.id;
        // Ensure user is part of the booking
        const bookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1 AND (b.borrower_id = $2 OR b.lender_id = $2)`, [bookingId, userId]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Conversation not found or access denied', 404);
        }
        const messagesRes = await (0, db_1.query)(`SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
        u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`, [bookingId]);
        return (0, response_1.sendSuccess)(res, {
            booking: bookingRes.rows[0],
            messages: messagesRes.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// Send Message
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = sendMessageSchema.parse(req.body);
        const senderId = req.user.id;
        // Verify booking membership
        const bookingRes = await (0, db_1.query)(`SELECT id, borrower_id, lender_id FROM bookings WHERE id = $1`, [validated.booking_id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        if (booking.borrower_id !== senderId && booking.lender_id !== senderId) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Cannot send message to this booking', 403);
        }
        const result = await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [validated.booking_id, senderId, validated.receiver_id, validated.content]);
        return (0, response_1.sendSuccess)(res, result.rows[0], 'Message sent');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
