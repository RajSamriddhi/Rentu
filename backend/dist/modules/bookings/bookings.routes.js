"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const notifications_service_1 = require("../notifications/notifications.service");
const user_1 = require("../../utils/user");
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
    timezone_offset_minutes: zod_1.z.number().optional(),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'HANDED_OVER', 'COMPLETED', 'CANCELLED']),
    timezone_offset_minutes: zod_1.z.number().optional(),
});
function parseToUtcTimestamp(dateStr, timeStr, tzOffsetMinutes) {
    const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
    const cleanTime = (timeStr && timeStr.trim() && timeStr.slice(0, 5) !== '00:00') ? timeStr.slice(0, 5) : '10:00';
    const [hour, minute] = cleanTime.split(':').map(Number);
    if (typeof tzOffsetMinutes === 'number') {
        const localUtcMs = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
        return localUtcMs + (tzOffsetMinutes * 60000);
    }
    const d = new Date(`${dateStr.slice(0, 10)}T${cleanTime}:00`);
    return d.getTime();
}
/**
 * Automatically checks and cancels any ACCEPTED booking whose 1-hour pickup handover
 * window has expired without pickup verification code entry.
 */
async function checkAndAutoCancelExpiredBookings() {
    try {
        const expiredRes = await (0, db_1.query)(`
      SELECT b.id, b.item_id, b.borrower_id, b.lender_id, b.status,
             TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str, 
             b.start_time, i.title AS item_title,
             lender.name AS lender_name, borrower.name AS borrower_name
      FROM bookings b
      LEFT JOIN items i ON b.item_id = i.id
      LEFT JOIN users lender ON (i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid)
      LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
      WHERE (b.status = 'ACCEPTED' AND b.handed_over_at IS NULL)
         OR (b.status = 'PENDING')
    `);
        const now = Date.now();
        for (const row of expiredRes.rows) {
            const sDate = row.start_date_str;
            if (!sDate)
                continue;
            const sTime = (row.start_time && row.start_time.trim() && row.start_time.slice(0, 5) !== '00:00') ? row.start_time.slice(0, 5) : '10:00';
            const startTimestamp = parseToUtcTimestamp(sDate, sTime, -330);
            // Case 1: PENDING booking proposals whose scheduled start time has arrived without being accepted
            if (row.status === 'PENDING' && now > startTimestamp) {
                await (0, db_1.query)(`UPDATE bookings 
           SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1 AND status = 'PENDING'`, [row.id]);
                await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [row.item_id]);
                await (0, db_1.query)(`UPDATE messages 
           SET proposal_data = jsonb_set(
             COALESCE(proposal_data, '{}'::jsonb),
             '{status}',
             '"CANCELLED"'::jsonb
           )
           WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [row.id]).catch(() => { });
                await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
           VALUES ($1, $2, $3, 'Rental request automatically cancelled because the scheduled start time arrived without being accepted.', 'SYSTEM')`, [row.id, row.lender_id, row.borrower_id]).catch(() => { });
                await (0, notifications_service_1.createNotification)({
                    userId: row.borrower_id,
                    bookingId: row.id,
                    referenceId: row.id,
                    referenceType: 'BOOKING',
                    type: 'BOOKING_CANCELLED',
                    title: 'Request Auto-Cancelled',
                    body: `Your rental request for "${row.item_title}" was automatically cancelled because its scheduled start time passed without being accepted.`,
                }).catch(() => { });
                await (0, notifications_service_1.createNotification)({
                    userId: row.lender_id,
                    bookingId: row.id,
                    referenceId: row.id,
                    referenceType: 'BOOKING',
                    type: 'BOOKING_CANCELLED',
                    title: 'Request Expired & Cancelled',
                    body: `Rental request for "${row.item_title}" was automatically cancelled because its scheduled start time passed.`,
                }).catch(() => { });
                continue;
            }
            // Case 2: ACCEPTED booking whose 1-hour pickup window expired without code entry
            const oneHourAfterStart = startTimestamp + (60 * 60 * 1000);
            if (row.status === 'ACCEPTED' && now > oneHourAfterStart) {
                // Auto cancel this booking because code was not provided within 1 hour of scheduled start time
                await (0, db_1.query)(`UPDATE bookings 
           SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1 AND status = 'ACCEPTED' AND handed_over_at IS NULL`, [row.id]);
                await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [row.item_id]);
                await (0, db_1.query)(`UPDATE messages 
           SET proposal_data = jsonb_set(
             COALESCE(proposal_data, '{}'::jsonb),
             '{status}',
             '"CANCELLED"'::jsonb
           )
           WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [row.id]).catch(() => { });
                await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
           VALUES ($1, $2, $3, 'Rental request automatically cancelled because the pickup handover code was not verified within 1 hour of the scheduled start time.', 'SYSTEM')`, [row.id, row.lender_id, row.borrower_id]).catch(() => { });
                await (0, notifications_service_1.createNotification)({
                    userId: row.borrower_id,
                    bookingId: row.id,
                    referenceId: row.id,
                    referenceType: 'BOOKING',
                    type: 'BOOKING_CANCELLED',
                    title: 'Rental Auto-Cancelled',
                    body: `Rental for "${row.item_title}" was automatically cancelled because the pickup code was not verified within 1 hour of the pickup start time.`,
                }).catch(() => { });
                await (0, notifications_service_1.createNotification)({
                    userId: row.lender_id,
                    bookingId: row.id,
                    referenceId: row.id,
                    referenceType: 'BOOKING',
                    type: 'BOOKING_CANCELLED',
                    title: 'Rental Auto-Cancelled',
                    body: `Rental for "${row.item_title}" was automatically cancelled because the pickup code was not verified within 1 hour of the pickup start time.`,
                }).catch(() => { });
            }
        }
    }
    catch (err) {
        console.warn('checkAndAutoCancelExpiredBookings notice:', err);
    }
}
const verifyCodeSchema = zod_1.z.object({
    code: zod_1.z.string().min(4, 'Verification code is required'),
});
const submitReviewSchema = zod_1.z.object({
    rating: zod_1.z.number().int().min(1, 'Rating must be between 1 and 5 stars').max(5, 'Rating must be between 1 and 5 stars'),
    comment: zod_1.z.string().max(1000, 'Comment cannot exceed 1000 characters').optional().default(''),
    review_type: zod_1.z.enum(['OWNER_RENTAL', 'RENTER', 'COMMUNITY_LENDER']).optional(),
});
// Create Booking Proposal ("Snag for the Weekend")
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = createBookingSchema.parse(req.body);
        const borrowerId = req.user.id;
        // Fetch Item & Owner
        const itemRes = await (0, db_1.query)(`SELECT id, owner_id, price_per_day, title, status, available_for_borrowing, 
              offers_delivery, delivery_fee, offers_pickup, pickup_fee, locality, image_urls, category
       FROM items WHERE id = $1`, [validated.item_id]);
        if (itemRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Item not found', 404);
        }
        const item = itemRes.rows[0];
        // Status check: do not permit booking an item that is not AVAILABLE
        if (item.status && item.status !== 'AVAILABLE') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This item is currently unavailable for rent or borrowing.', 400);
        }
        if (item.owner_id === borrowerId) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'You cannot borrow your own gear.', 400);
        }
        // Block check: borrower cannot book from owner if either has blocked the other
        const blockCheck = await (0, db_1.query)(`SELECT 1 FROM user_blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`, [borrowerId, item.owner_id]);
        if (blockCheck.rows.length > 0) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Cannot rent from this user due to a block.', 403);
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
        // PAST TIME VALIDATION:
        // Reject any booking where the scheduled start time or return time has already passed
        const tzOffset = typeof validated.timezone_offset_minutes === 'number'
            ? validated.timezone_offset_minutes
            : -330; // Default IST UTC+5:30
        const startTimestamp = parseToUtcTimestamp(validated.start_date, validated.start_time, tzOffset);
        // Allow 2-minute buffer for network transit and clock differences
        const currentTimestampWithGrace = Date.now() - (2 * 60 * 1000);
        if (startTimestamp < currentTimestampWithGrace) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot book in the past. The selected start time (${validated.start_date} ${validated.start_time || ''}) has already passed. Please select an upcoming date and time.`, 400);
        }
        const endTimestamp = parseToUtcTimestamp(finalEndDate, validated.end_time || '18:00', tzOffset);
        if (endTimestamp <= startTimestamp) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Rental return time must be strictly after the pickup start time.', 400);
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
        const itemRate = Number(item.price_per_day || 0);
        const isFreeBorrow = itemRate <= 0 || item.available_for_borrowing;
        if (validated.total_price === 0 && itemRate > 0 && !item.available_for_borrowing) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'The owner has not made this item available for free borrowing. It is only available for paid rent.', 400);
        }
        // ADDRESS CHECK:
        // Borrower must have set their address (address_text or saved_locations) before placing a rental order
        const borrowerRes = await (0, db_1.query)('SELECT id, address_text, locality, saved_locations FROM users WHERE id = $1', [borrowerId]);
        const borrower = borrowerRes.rows[0];
        const hasAddressText = borrower?.address_text && borrower.address_text.trim() && borrower.address_text.trim() !== 'Bengaluru, India';
        const hasSavedLocations = Array.isArray(borrower?.saved_locations) && borrower.saved_locations.some((loc) => loc && (loc.building_flat_house?.trim() || loc.street_road_landmark?.trim()));
        if (!hasAddressText && !hasSavedLocations) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Address required: Please set your address in your profile before requesting to rent or order items.', 400);
        }
        // SERVER-SIDE CALCULATION OF DURATION AND TOTAL PRICE:
        // Do not blindly trust client-supplied totals or fees
        const sDateObj = new Date(validated.start_date);
        const eDateObj = new Date(finalEndDate);
        const dayDiff = Math.max(1, Math.round((eDateObj.getTime() - sDateObj.getTime()) / (1000 * 60 * 60 * 24)));
        const durationDays = validated.duration_days ? Math.max(1, validated.duration_days) : dayDiff;
        const baseCost = isFreeBorrow || itemRate <= 0 ? 0 : itemRate * durationDays;
        let deliveryFee = 0;
        if (validated.requires_delivery) {
            if (!item.offers_delivery) {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'The owner does not offer delivery for this item.', 400);
            }
            deliveryFee = Number(item.delivery_fee || 0);
        }
        let pickupFee = 0;
        if (validated.requires_pickup) {
            if (!item.offers_pickup) {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'The owner does not offer collection/pickup for this item.', 400);
            }
            pickupFee = Number(item.pickup_fee || 0);
        }
        const calculatedTotalPrice = baseCost + deliveryFee + pickupFee;
        // Pre-generate 6-digit pickup handover verification code
        const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        // Seed structured PROPOSAL message into the unified conversation with full item and rental terms
        const proposalData = {
            type: 'RENTAL_REQUEST',
            item_id: item.id,
            item_title: item.title,
            title: item.title,
            item_images: item.image_urls || [],
            image_url: (Array.isArray(item.image_urls) && item.image_urls.length > 0) ? item.image_urls[0] : (item.image_url || ''),
            category: item.category,
            price_per_day: itemRate,
            total_price: calculatedTotalPrice,
            duration_days: durationDays,
            start_date: validated.start_date,
            start_time: validated.start_time || '10:00',
            end_date: finalEndDate,
            end_time: validated.end_time || '18:00',
            pickup_type: validated.pickup_type || 'LENDER_LOCATION',
            pickup_locality: validated.pickup_locality || item.locality || '',
            return_type: validated.return_type || 'LENDER_LOCATION',
            return_locality: validated.return_locality || item.locality || '',
            requires_delivery: validated.requires_delivery ?? false,
            delivery_fee: deliveryFee,
            requires_pickup: validated.requires_pickup ?? false,
            pickup_fee: pickupFee,
            status: 'PENDING',
            notes: validated.message || `Hey! I'd love to rent your ${item.title} for ${durationDays} days.`,
        };
        // Execute booking creation and proposal message in an atomic database transaction
        const client = await db_1.pool.connect();
        let booking;
        try {
            await client.query('BEGIN');
            const bookingRes = await client.query(`INSERT INTO bookings
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
                durationDays,
                calculatedTotalPrice,
                validated.pickup_type || 'LENDER_LOCATION',
                validated.pickup_locality || null,
                validated.return_type || 'LENDER_LOCATION',
                validated.return_locality || null,
                validated.requires_delivery ?? false,
                deliveryFee,
                validated.requires_pickup ?? false,
                pickupFee,
                validated.message || `Hey! Would love to rent your ${item.title}.`,
                pickupCode,
            ]);
            booking = bookingRes.rows[0];
            const fullProposalData = {
                ...proposalData,
                booking_id: booking.id,
            };
            await client.query(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type, proposal_data, is_delivered, is_read)
         VALUES ($1, $2, $3, $4, 'PROPOSAL', $5, false, false)`, [
                booking.id,
                borrowerId,
                item.owner_id,
                validated.message || `Rental request for ${item.title} (${durationDays} days)`,
                JSON.stringify(fullProposalData),
            ]);
            await client.query('COMMIT');
        }
        catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        }
        finally {
            client.release();
        }
        // Query borrower name for notifications
        const borrowerUserRes = await (0, db_1.query)('SELECT name FROM users WHERE id = $1', [borrowerId]);
        const borrowerName = borrowerUserRes.rows[0]?.name || 'A community member';
        // Notify Lender about the new rental request
        await (0, notifications_service_1.createNotification)({
            userId: item.owner_id,
            senderId: borrowerId,
            bookingId: booking.id,
            referenceId: booking.id,
            referenceType: 'BOOKING',
            type: 'BOOKING_PROPOSAL',
            title: 'Rental Request',
            body: `${borrowerName} requested to rent "${item.title}".`,
        }).catch((err) => console.warn('Failed to dispatch booking proposal notification:', err));
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
        // Check and auto-cancel any bookings where 1 hour has elapsed after start time without pickup verification
        await checkAndAutoCancelExpiredBookings();
        const myIds = await (0, user_1.resolveUserIds)(userId, req.user?.email);
        let sql = `
      SELECT 
        b.id, b.item_id, b.borrower_id, COALESCE(b.lender_id, i.owner_id) AS lender_id, 
        TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date, 
        b.start_time, 
        TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date, 
        b.end_time, 
        b.duration_days,
        b.pickup_type, b.pickup_locality, b.return_type, b.return_locality,
        b.requires_delivery, b.delivery_fee, b.requires_pickup, b.pickup_fee,
        COALESCE(b.total_price, b.duration_days * COALESCE(i.price_per_day, 0)) AS total_price, 
        b.status, b.message, 
        CASE WHEN b.borrower_id = ANY($1::text[]) THEN b.pickup_code ELSE NULL END AS pickup_code, 
        CASE WHEN b.lender_id = ANY($1::text[]) OR i.owner_id = ANY($1::text[]) THEN b.return_code ELSE NULL END AS return_code, 
        b.handed_over_at, b.returned_at, b.completed_at, b.created_at,
        b.payment_status, b.payment_method,
        COALESCE(i.title, 'Rented Gear') AS item_title, 
        COALESCE(i.image_urls, ARRAY[]::text[]) AS item_images, 
        COALESCE(i.category, 'Other') AS item_category,
        COALESCE(i.locality, b.pickup_locality, 'Local Hub') AS item_locality, 
        COALESCE(i.price_per_day, 0) AS item_rate,
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
      LEFT JOIN items i ON b.item_id = i.id
      LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
      LEFT JOIN users lender ON (
        b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid OR
        i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid
      )
      LEFT JOIN reviews rev ON rev.booking_id = b.id AND rev.reviewer_id = ANY($1::text[])
      WHERE (
        b.borrower_id = ANY($1::text[]) 
        OR b.lender_id = ANY($1::text[]) 
        OR i.owner_id = ANY($1::text[])
      )
    `;
        const params = [myIds];
        if (role === 'borrower') {
            sql += ` AND b.borrower_id = ANY($1::text[])`;
        }
        else if (role === 'lender') {
            sql += ` AND (b.lender_id = ANY($1::text[]) OR i.owner_id = ANY($1::text[]))`;
        }
        sql += ` ORDER BY b.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        // Enforce pickup code visibility:
        // Never reveal the pickup verification code to the borrower before the scheduled pickup time
        const currentMs = Date.now();
        for (const b of result.rows) {
            if (b.status === 'ACCEPTED' && b.pickup_code) {
                const sDate = b.start_date;
                const sTime = (b.start_time && b.start_time.trim() && b.start_time.slice(0, 5) !== '00:00') ? b.start_time.slice(0, 5) : '10:00';
                const startMs = parseToUtcTimestamp(sDate, sTime, -330);
                // Unlock 5 minutes before scheduled start time for the meetup
                if (currentMs < startMs - (5 * 60 * 1000)) {
                    b.pickup_code = null;
                }
            }
        }
        // Also query pending proposals from messages so custom gear requests, lend offers, and booking proposals appear in Booking Requests
        const proposalsRes = await (0, db_1.query)(`SELECT 
        m.id, m.sender_id, m.receiver_id, m.content, m.message_type, m.proposal_data, m.created_at, m.booking_id,
        sender.id::text AS sender_user_id, sender.name AS sender_name, sender.avatar_url AS sender_avatar, sender.phone AS sender_phone, sender.email AS sender_email, sender.locality AS sender_locality, sender.address_text AS sender_address,
        receiver.id::text AS receiver_user_id, receiver.name AS receiver_name, receiver.avatar_url AS receiver_avatar, receiver.phone AS receiver_phone, receiver.email AS receiver_email, receiver.locality AS receiver_locality, receiver.address_text AS receiver_address
      FROM messages m
      LEFT JOIN users sender ON (m.sender_id = sender.id::text OR m.sender_id = sender.firebase_uid)
      LEFT JOIN users receiver ON (m.receiver_id = receiver.id::text OR m.receiver_id = receiver.firebase_uid)
      WHERE m.message_type = 'PROPOSAL'
        AND (
          m.sender_id = ANY($1::text[]) 
          OR m.receiver_id = ANY($1::text[])
          OR (m.booking_id IS NOT NULL AND m.booking_id IN (
            SELECT b_sub.id FROM bookings b_sub 
            WHERE b_sub.borrower_id = ANY($1::text[]) 
               OR b_sub.lender_id = ANY($1::text[])
          ))
        )
        AND (
          (m.proposal_data->>'status') IS NULL 
          OR (m.proposal_data->>'status') = 'PENDING'
        )
      ORDER BY m.created_at DESC`, [myIds]);
        const existingBookingIds = new Set();
        for (const b of result.rows) {
            if (b.id)
                existingBookingIds.add(String(b.id));
        }
        const proposalBookings = [];
        for (const pRow of proposalsRes.rows) {
            try {
                const pData = typeof pRow.proposal_data === 'string' ? JSON.parse(pRow.proposal_data) : (pRow.proposal_data || {});
                // If this proposal already corresponds to a booking already retrieved, avoid duplicate
                if (pRow.booking_id && existingBookingIds.has(String(pRow.booking_id))) {
                    continue;
                }
                if (pData.booking_id && existingBookingIds.has(String(pData.booking_id))) {
                    continue;
                }
                const isOffer = pData.type === 'LISTING' || pData.is_lend_offer === true;
                // In listing / lend offer: sender is lender, receiver is borrower.
                // In borrow request / rental request: sender is borrower, receiver is lender.
                const lenderId = pData.lender_id || (isOffer ? pRow.sender_user_id : pRow.receiver_user_id) || (isOffer ? pRow.sender_id : pRow.receiver_id);
                const borrowerId = pData.borrower_id || (isOffer ? pRow.receiver_user_id : pRow.sender_user_id) || (isOffer ? pRow.receiver_id : pRow.sender_id);
                if (role === 'borrower' && !myIds.includes(String(borrowerId)))
                    continue;
                if (role === 'lender' && !myIds.includes(String(lenderId)))
                    continue;
                const durationDays = Math.max(1, Number(pData.duration_days) || 1);
                const totalPrice = Number(pData.total_price) || 0;
                const pricePerDay = Number(pData.price_per_day) || (durationDays > 0 ? Math.round(totalPrice / durationDays) : 0);
                const startDateStr = pData.start_date ? String(pData.start_date).slice(0, 10) : new Date(pRow.created_at).toISOString().slice(0, 10);
                let endDateStr = pData.end_date ? String(pData.end_date).slice(0, 10) : '';
                if (!endDateStr) {
                    const s = new Date(startDateStr);
                    if (!isNaN(s.getTime())) {
                        s.setDate(s.getDate() + Math.max(0, durationDays - 1));
                        endDateStr = s.toISOString().slice(0, 10);
                    }
                    else {
                        endDateStr = startDateStr;
                    }
                }
                const isDelivery = pData.delivery_option === 'LENDER_DELIVERY' || !!(pData.delivery_fee && Number(pData.delivery_fee) > 0) || !!pData.requires_delivery;
                const isPickup = pData.collection_option === 'LENDER_COLLECT' || !!(pData.collection_fee && Number(pData.collection_fee) > 0) || !!pData.requires_pickup;
                const borrowerName = isOffer ? (pRow.receiver_name || 'Borrower') : (pRow.sender_name || 'Borrower');
                const borrowerAvatar = isOffer ? pRow.receiver_avatar : pRow.sender_avatar;
                const borrowerPhone = isOffer ? pRow.receiver_phone : pRow.sender_phone;
                const borrowerEmail = isOffer ? pRow.receiver_email : pRow.sender_email;
                const lenderName = isOffer ? (pRow.sender_name || 'Lender') : (pRow.receiver_name || 'Lender');
                const lenderAvatar = isOffer ? pRow.sender_avatar : pRow.receiver_avatar;
                const lenderPhone = isOffer ? pRow.sender_phone : pRow.receiver_phone;
                const lenderEmail = isOffer ? pRow.sender_email : pRow.receiver_email;
                const locality = pData.delivery_location || pData.pickup_locality || (isOffer ? pRow.sender_locality : pRow.receiver_locality) || 'Local Hub';
                const address = pData.delivery_location || pData.pickup_locality || (isOffer ? pRow.sender_address : pRow.receiver_address) || locality;
                const itemTitle = pData.item_title || pData.title || 'Gear Rental Proposal';
                const itemImages = Array.isArray(pData.item_images) && pData.item_images.length > 0
                    ? pData.item_images
                    : (pData.image_url ? [pData.image_url] : []);
                const bookingId = pRow.booking_id || pData.booking_id || `proposal_${pRow.id}`;
                proposalBookings.push({
                    id: bookingId,
                    item_id: pData.request_id || pData.item_id || pRow.id,
                    borrower_id: borrowerId,
                    lender_id: lenderId,
                    start_date: startDateStr,
                    start_time: pData.start_time || '10:00',
                    end_date: endDateStr,
                    end_time: pData.end_time || '18:00',
                    duration_days: durationDays,
                    pickup_type: isDelivery ? 'OWNER_DELIVERY' : 'LENDER_LOCATION',
                    pickup_locality: locality,
                    return_type: isPickup ? 'OWNER_COLLECT' : 'LENDER_LOCATION',
                    return_locality: locality,
                    requires_delivery: isDelivery,
                    delivery_fee: Number(pData.delivery_fee) || 0,
                    requires_pickup: isPickup,
                    pickup_fee: Number(pData.collection_fee) || 0,
                    total_price: totalPrice,
                    status: 'PENDING',
                    message: pData.notes || pRow.content || '',
                    pickup_code: null,
                    return_code: null,
                    handed_over_at: null,
                    returned_at: null,
                    completed_at: null,
                    created_at: pRow.created_at,
                    payment_status: 'PENDING',
                    payment_method: null,
                    item_title: itemTitle,
                    item_images: itemImages,
                    item_category: pData.category || 'Other',
                    item_locality: locality,
                    item_rate: pricePerDay,
                    pickup_address: address,
                    return_address: address,
                    lender_address: isOffer ? pRow.sender_address : pRow.receiver_address,
                    borrower_name: borrowerName,
                    borrower_avatar: borrowerAvatar,
                    borrower_phone: borrowerPhone,
                    borrower_email: borrowerEmail,
                    lender_name: lenderName,
                    lender_avatar: lenderAvatar,
                    lender_phone: lenderPhone,
                    lender_email: lenderEmail,
                    user_review_id: null,
                    user_rating: null,
                    user_comment: null,
                    user_reviewed_at: null,
                    is_proposal: true,
                    proposal_message_id: pRow.id,
                    proposer_id: pRow.sender_id,
                    recipient_id: pRow.receiver_id,
                });
            }
            catch (e) {
                console.warn('Error parsing proposal message for bookings list:', e);
            }
        }
        const combined = [...proposalBookings, ...result.rows].sort((a, b) => {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            return timeB - timeA;
        });
        return (0, response_1.sendSuccess)(res, combined);
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
        if (id.startsWith('proposal_')) {
            const msgId = id.replace(/^proposal_/, '');
            const msgRes = await (0, db_1.query)(`SELECT * FROM messages WHERE id = $1`, [msgId]);
            if (msgRes.rows.length === 0) {
                return (0, response_1.sendError)(res, 'NOT_FOUND', 'Proposal message not found', 404);
            }
            const message = msgRes.rows[0];
            const myIds = await (0, user_1.resolveUserIds)(userId);
            const isSender = myIds.includes(String(message.sender_id));
            const isReceiver = myIds.includes(String(message.receiver_id));
            const isAdmin = req.user.role === 'ADMIN';
            if (!isSender && !isReceiver && !isAdmin) {
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied: You are not a participant in this agreement.', 403);
            }
            if (status === 'ACCEPTED' && !isReceiver && !isAdmin) {
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the intended recipient can accept this proposal.', 403);
            }
            const proposal = typeof message.proposal_data === 'string'
                ? JSON.parse(message.proposal_data)
                : (message.proposal_data || {});
            const targetStatus = status === 'CANCELLED' ? 'CANCELLED' : status === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED';
            const updatedProposal = { ...proposal, status: targetStatus };
            await (0, db_1.query)(`UPDATE messages SET proposal_data = $1 WHERE id = $2`, [JSON.stringify(updatedProposal), msgId]);
            return (0, response_1.sendSuccess)(res, { id, status: targetStatus }, `Proposal ${targetStatus.toLowerCase()}`);
        }
        const bookingRes = await (0, db_1.query)(`SELECT b.*, 
              TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
              TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str,
              COALESCE(i.title, 'Rented Gear') AS item_title, 
              COALESCE(b.lender_id, i.owner_id) AS lender_id, 
              i.owner_id AS item_owner_id,
              lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       LEFT JOIN items i ON b.item_id = i.id
       LEFT JOIN users lender ON (
         b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid OR
         i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid
       )
       LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        // State machine check: ensure valid status transition
        if (status === 'ACCEPTED') {
            if (booking.status !== 'PENDING') {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot accept booking. Current status is ${booking.status}.`, 400);
            }
        }
        else if (status === 'REJECTED') {
            if (booking.status !== 'PENDING') {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot reject booking. Current status is ${booking.status}.`, 400);
            }
        }
        else if (status === 'CANCELLED') {
            if (booking.status !== 'PENDING' && booking.status !== 'ACCEPTED') {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot cancel booking with current status "${booking.status}". Cancellation is only allowed before handover.`, 400);
            }
        }
        // Check authority: 
        // - Lender can ACCEPT or REJECT proposals.
        // - Both Renter (borrower) and Lender (owner) can CANCEL anytime before pickup handover verification (Stages 1 & 2).
        // - Once pickup handover verification code is verified (Stage 3+), cancellation is not permitted.
        const myIds = await (0, user_1.resolveUserIds)(userId);
        const isLender = myIds.includes(String(booking.lender_id)) || myIds.includes(String(booking.item_owner_id));
        const isBorrower = myIds.includes(String(booking.borrower_id));
        const isAdmin = req.user.role === 'ADMIN';
        if (!isLender && !isBorrower && !isAdmin) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied', 403);
        }
        if (status === 'ACCEPTED' || status === 'REJECTED') {
            if (!isLender && !isAdmin) {
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the gear owner can accept or reject proposals', 403);
            }
        }
        if (status === 'CANCELLED') {
            if (booking.status === 'HANDED_OVER' || booking.status === 'COMPLETED') {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Cancellation is not allowed after pickup handover verification. The rental is actively in use from Stage 3 onwards.', 400);
            }
        }
        const sDate = booking.start_date_str || booking.start_date;
        const eDate = booking.end_date_str || booking.end_date;
        // PAST TIME & CALENDAR OVERLAP CHECK ON ACCEPTANCE:
        let pickupCode = booking.pickup_code;
        let updateRes;
        let conflictingPendingList = [];
        if (status === 'ACCEPTED') {
            const tzOffset = typeof req.body.timezone_offset_minutes === 'number'
                ? req.body.timezone_offset_minutes
                : -330;
            const endTimestamp = parseToUtcTimestamp(eDate, booking.end_time || '18:00', tzOffset);
            if (endTimestamp < Date.now()) {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This booking request cannot be accepted because its scheduled rental time has already passed. Please ask the renter to send a request for upcoming dates.', 400);
            }
            const client = await db_1.pool.connect();
            try {
                await client.query('BEGIN');
                // ATOMIC LOCK: Lock the item row to prevent concurrent race conditions
                await client.query('SELECT id FROM items WHERE id = $1 FOR UPDATE', [booking.item_id]);
                // Overlap check against bookings already ACCEPTED or HANDED_OVER
                const conflictRes = await client.query(`SELECT id, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
                  TO_CHAR(COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date
           FROM bookings
           WHERE item_id = $1
             AND id != $2
             AND status IN ('ACCEPTED', 'HANDED_OVER')
             AND (
               start_date <= $4::date
               AND COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date) >= $3::date
             )
           LIMIT 1`, [booking.item_id, id, sDate, eDate]);
                if (conflictRes.rows.length > 0) {
                    await client.query('ROLLBACK');
                    const c = conflictRes.rows[0];
                    return (0, response_1.sendError)(res, 'CONFLICT', `Cannot accept booking: This item is already booked from ${c.start_date} to ${c.end_date}.`, 409);
                }
                // Auto-cancel any conflicting pending requests for this item during the same dates
                const conflictingPendingRes = await client.query(`SELECT id, borrower_id 
           FROM bookings
           WHERE item_id = $1
             AND id != $2
             AND status = 'PENDING'
             AND (
               start_date <= $4::date
               AND COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date) >= $3::date
             )`, [booking.item_id, id, sDate, eDate]);
                conflictingPendingList = conflictingPendingRes.rows;
                for (const conflicting of conflictingPendingList) {
                    await client.query(`UPDATE bookings SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [conflicting.id]);
                    await client.query(`UPDATE messages 
             SET proposal_data = jsonb_set(COALESCE(proposal_data, '{}'::jsonb), '{status}', '"CANCELLED"'::jsonb)
             WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [conflicting.id]).catch(() => { });
                }
                if (!pickupCode) {
                    pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
                }
                updateRes = await client.query(`UPDATE bookings 
           SET status = 'ACCEPTED', 
               pickup_code = COALESCE(pickup_code, $1),
               return_code = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`, [pickupCode, id]);
                await client.query('COMMIT');
            }
            catch (txErr) {
                await client.query('ROLLBACK');
                throw txErr;
            }
            finally {
                client.release();
            }
            // Non-blocking async notifications for cancelled pending requests
            for (const conflicting of conflictingPendingList) {
                (0, notifications_service_1.createNotification)({
                    userId: conflicting.borrower_id,
                    bookingId: conflicting.id,
                    referenceId: conflicting.id,
                    referenceType: 'BOOKING',
                    type: 'BOOKING_CANCELLED',
                    title: 'Request Auto-Cancelled',
                    body: `Your rental request for "${booking.item_title}" was cancelled because the owner accepted another booking for those dates.`,
                }).catch(() => { });
            }
        }
        else {
            updateRes = await (0, db_1.query)(`UPDATE bookings 
         SET status = $1, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`, [status, id]);
        }
        // Sync item status & trigger lifecycle notifications
        if (status === 'ACCEPTED') {
            // Items remain AVAILABLE because rentals are date-specific (booked for particular days only)
            await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
            // Sync proposal_data status in messages so proposal cards in chat are marked ACCEPTED
            await (0, db_1.query)(`UPDATE messages 
         SET proposal_data = jsonb_set(
           COALESCE(proposal_data, '{}'::jsonb),
           '{status}',
           '"ACCEPTED"'::jsonb
         )
         WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [id]).catch((err) => console.warn('Failed to sync message proposal_data status:', err));
            // Add notification chat message
            await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
         VALUES ($1, $2, $3, 'Proposal accepted. Meet at the designated place for pickup. Verify handoff with the 6-digit code.', 'SYSTEM')`, [id, booking.lender_id, booking.borrower_id]);
            // Notify Borrower: Proposal Accepted
            await (0, notifications_service_1.createNotification)({
                userId: booking.borrower_id,
                senderId: booking.lender_id,
                bookingId: id,
                referenceId: id,
                referenceType: 'BOOKING',
                type: 'BOOKING_ACCEPTED',
                title: 'Rental Accepted',
                body: `${booking.lender_name} accepted your request for "${booking.item_title}".`,
            });
        }
        else if (status === 'REJECTED') {
            await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
            // Sync proposal_data status in messages so proposal cards in chat are marked DECLINED
            await (0, db_1.query)(`UPDATE messages 
         SET proposal_data = jsonb_set(
           COALESCE(proposal_data, '{}'::jsonb),
           '{status}',
           '"DECLINED"'::jsonb
         )
         WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [id]).catch((err) => console.warn('Failed to sync message proposal_data status:', err));
            // Notify Borrower: Declined
            await (0, notifications_service_1.createNotification)({
                userId: booking.borrower_id,
                senderId: booking.lender_id,
                bookingId: id,
                referenceId: id,
                referenceType: 'BOOKING',
                type: 'BOOKING_REJECTED',
                title: 'Rental Request Declined',
                body: `${booking.lender_name} declined your request for "${booking.item_title}".`,
            });
        }
        else if (status === 'CANCELLED') {
            await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
            // Sync proposal_data status in messages so proposal cards in chat are marked CANCELLED
            await (0, db_1.query)(`UPDATE messages 
         SET proposal_data = jsonb_set(
           COALESCE(proposal_data, '{}'::jsonb),
           '{status}',
           '"CANCELLED"'::jsonb
         )
         WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [id]).catch((err) => console.warn('Failed to sync message proposal_data status:', err));
            const otherPartyId = isBorrower ? booking.lender_id : booking.borrower_id;
            const actorName = isBorrower ? (booking.borrower_name || 'Borrower') : (booking.lender_name || 'Owner');
            await (0, notifications_service_1.createNotification)({
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
        const safeBooking = { ...updateRes.rows[0] };
        if (safeBooking.borrower_id !== userId) {
            delete safeBooking.pickup_code;
        }
        else if (safeBooking.status === 'ACCEPTED' && safeBooking.pickup_code) {
            const sDate = safeBooking.start_date_str || safeBooking.start_date;
            const sTime = (safeBooking.start_time && safeBooking.start_time.trim() && safeBooking.start_time.slice(0, 5) !== '00:00') ? safeBooking.start_time.slice(0, 5) : '10:00';
            const startMs = parseToUtcTimestamp(String(sDate), sTime, -330);
            if (Date.now() < startMs - (5 * 60 * 1000)) {
                delete safeBooking.pickup_code;
            }
        }
        if (safeBooking.lender_id !== userId) {
            delete safeBooking.return_code;
        }
        return (0, response_1.sendSuccess)(res, safeBooking, `Proposal updated to ${status}`);
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
        const bookingRes = await (0, db_1.query)(`SELECT b.*, 
              TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
              TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str,
              COALESCE(i.title, 'Rented Gear') AS item_title, 
              COALESCE(b.lender_id, i.owner_id) AS lender_id, 
              i.owner_id AS item_owner_id,
              lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       LEFT JOIN items i ON b.item_id = i.id
       LEFT JOIN users lender ON (
         b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid OR
         i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid
       )
       LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        const myIds = await (0, user_1.resolveUserIds)(userId);
        const isLender = myIds.includes(String(booking.lender_id)) || myIds.includes(String(booking.item_owner_id));
        const isBorrower = myIds.includes(String(booking.borrower_id));
        const isAdmin = req.user.role === 'ADMIN';
        if (!isLender && !isAdmin) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the gear owner/lender can enter and verify the renter’s handover code to confirm pickup.', 403);
        }
        if (booking.status !== 'ACCEPTED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot verify handover for booking with status ${booking.status}`, 400);
        }
        // TIMING WINDOW CHECK:
        // Pickup code is not active until the scheduled pickup time arrives
        const tzOffset = typeof req.body.timezone_offset_minutes === 'number'
            ? req.body.timezone_offset_minutes
            : -330;
        const startTimestamp = parseToUtcTimestamp(booking.start_date_str || booking.start_date, booking.start_time || '10:00', tzOffset);
        // 1-Hour Verification Window Check:
        // If code was not provided within 1 hour of the scheduled start time, request cancels on its own.
        const oneHourAfterStart = startTimestamp + (60 * 60 * 1000);
        if (Date.now() > oneHourAfterStart) {
            await (0, db_1.query)(`UPDATE bookings SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
            await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'The 1-hour pickup handover window has expired. This rental request has been automatically cancelled.', 400);
        }
        // Allow 2-minute clock skew buffer
        if (Date.now() < startTimestamp - (2 * 60 * 1000)) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Pickup handover code is not active yet. It will unlock at the scheduled pickup time (${booking.start_date_str || booking.start_date} at ${booking.start_time || '10:00'}).`, 400);
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
        // Keep item status as AVAILABLE since item is rented only for agreed dates
        await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
        // Send chat system message
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
       VALUES ($1, $2, $3, 'Product received and handed over successfully. The rental is now active. When returning, exchange the 6-digit return code.', 'SYSTEM')`, [id, userId, isBorrower ? booking.lender_id : booking.borrower_id]);
        const sDate = booking.start_date_str || booking.start_date;
        const eDate = booking.end_date_str || booking.end_date;
        // 1. Notify Borrower: Gear Received
        await (0, notifications_service_1.createNotification)({
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
        await (0, notifications_service_1.createNotification)({
            userId: booking.lender_id,
            senderId: booking.borrower_id,
            bookingId: id,
            referenceId: id,
            referenceType: 'BOOKING',
            type: 'BOOKING_HANDED_OVER',
            title: 'Handover Completed',
            body: `${booking.borrower_name || 'Borrower'} received "${booking.item_title}".`,
        });
        const updatedRow = { ...updateRes.rows[0] };
        if (!isLender && !isAdmin) {
            updatedRow.return_code = null;
        }
        return (0, response_1.sendSuccess)(res, updatedRow, 'Product accepted & handed over successfully! Rental is now in use.');
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
        const bookingRes = await (0, db_1.query)(`SELECT b.*, 
              TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
              TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str,
              COALESCE(i.title, 'Rented Gear') AS item_title, 
              COALESCE(b.lender_id, i.owner_id) AS lender_id, 
              i.owner_id AS item_owner_id,
              lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       LEFT JOIN items i ON b.item_id = i.id
       LEFT JOIN users lender ON (
         b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid OR
         i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid
       )
       LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        const myIds = await (0, user_1.resolveUserIds)(userId);
        const isLender = myIds.includes(String(booking.lender_id)) || myIds.includes(String(booking.item_owner_id));
        const isBorrower = myIds.includes(String(booking.borrower_id));
        const isAdmin = req.user.role === 'ADMIN';
        if (!isBorrower && !isAdmin) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the renter can enter and verify the owner’s return code to complete the return.', 403);
        }
        if (booking.status !== 'HANDED_OVER') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot verify return for booking with status ${booking.status}`, 400);
        }
        // TIMING WINDOW CHECK:
        // Return code is not active until the scheduled return / delivery time arrives
        const tzOffset = typeof req.body.timezone_offset_minutes === 'number'
            ? req.body.timezone_offset_minutes
            : -330;
        const returnTimestamp = parseToUtcTimestamp(booking.end_date_str || booking.start_date_str, booking.end_time || '18:00', tzOffset);
        // Allow 2-minute clock skew buffer
        if (Date.now() < returnTimestamp - (2 * 60 * 1000)) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Return handover code is not active yet. It will unlock at the scheduled return time (${booking.end_date_str || booking.start_date_str} at ${booking.end_time || '18:00'}).`, 400);
        }
        if (!booking.return_code || booking.return_code.trim() !== code.trim()) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Incorrect 6-digit return code. Please check the code with the other party.', 400);
        }
        const isFree = Number(booking.total_price) === 0;
        const updateRes = await (0, db_1.query)(`UPDATE bookings 
       SET status = (CASE WHEN $2 = true THEN 'COMPLETED'::booking_status ELSE 'HANDED_OVER'::booking_status END),
           returned_at = CURRENT_TIMESTAMP,
           completed_at = (CASE WHEN $2 = true THEN CURRENT_TIMESTAMP ELSE NULL END),
           payment_status = (CASE WHEN $2 = true THEN 'CONFIRMED' ELSE 'PENDING' END),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`, [id, isFree]);
        // Release item back to AVAILABLE
        await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
        // Send chat system message
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'SYSTEM')`, [
            id,
            userId,
            isBorrower ? booking.lender_id : booking.borrower_id,
            isFree
                ? 'Product returned to owner. The rental process is completed. Please leave reviews for each other.'
                : 'Product returned to owner. Final payment confirmation is now active.'
        ]);
        return (0, response_1.sendSuccess)(res, updateRes.rows[0], isFree
            ? 'Product returned successfully! Whole process completed.'
            : 'Product return verified! Please proceed to payment settlement.');
    }
    catch (error) {
        next(error);
    }
});
// Stage 5: Renter marks payment as sent
router.post('/:id/submit-payment', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { payment_method = 'UPI' } = req.body;
        const userId = req.user.id;
        const bookingRes = await (0, db_1.query)(`SELECT * FROM bookings WHERE id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        if (!booking.returned_at && booking.status !== 'HANDED_OVER' && booking.status !== 'COMPLETED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Payment can only be submitted once the product has been handed over or returned.', 400);
        }
        const myIds = await (0, user_1.resolveUserIds)(userId);
        if (!myIds.includes(String(booking.borrower_id)) && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the renter can submit payment', 403);
        }
        const updateRes = await (0, db_1.query)(`UPDATE bookings 
       SET payment_status = 'SUBMITTED',
           payment_method = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, [payment_method, id]);
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
       VALUES ($1, $2, $3, 'Renter has sent the payment via ' || $4 || '. Owner, please verify and confirm receipt.', 'SYSTEM')`, [id, userId, booking.lender_id, payment_method]);
        return (0, response_1.sendSuccess)(res, updateRes.rows[0], 'Payment marked as sent! Waiting for owner verification.');
    }
    catch (error) {
        next(error);
    }
});
// Stage 5: Owner confirms payment received -> Marks whole process COMPLETED
router.post('/:id/confirm-payment', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const bookingRes = await (0, db_1.query)(`SELECT b.*, COALESCE(b.lender_id, i.owner_id) AS lender_id, b.item_id, i.title AS item_title
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        if (!booking.returned_at && booking.status !== 'HANDED_OVER' && booking.status !== 'COMPLETED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Payment can only be submitted once the product has been handed over or returned.', 400);
        }
        const myIds = await (0, user_1.resolveUserIds)(userId);
        if (!myIds.includes(String(booking.lender_id)) && !myIds.includes(String(booking.item_owner_id)) && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the owner can confirm receiving payment', 403);
        }
        const updateRes = await (0, db_1.query)(`UPDATE bookings 
       SET status = 'COMPLETED',
           completed_at = CURRENT_TIMESTAMP,
           payment_status = 'CONFIRMED',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`, [id]);
        // Release item back to AVAILABLE
        await (0, db_1.query)(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
       VALUES ($1, $2, $3, 'Product returned to owner. The rental process is completed. Please leave reviews and feedback for each other (open for the next 3 days).', 'SYSTEM')`, [id, userId, booking.borrower_id]);
        // Notify Borrower: Rental Completed
        await (0, notifications_service_1.createNotification)({
            userId: booking.borrower_id,
            senderId: booking.lender_id,
            bookingId: id,
            referenceId: id,
            referenceType: 'BOOKING',
            type: 'BOOKING_COMPLETED',
            title: 'Rental Completed',
            body: `${booking.lender_name || 'Owner'} confirmed the return of "${booking.item_title}".`,
        });
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
        const { rating, comment, review_type } = submitReviewSchema.parse(req.body);
        const userId = req.user.id;
        const bookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, COALESCE(b.lender_id, i.owner_id) AS lender_id, i.price_per_day
       FROM bookings b
       LEFT JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`, [id]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const booking = bookingRes.rows[0];
        // Resolve canonical user records for current user, borrower, and lender
        const [currentUserRes, borrowerRes, lenderRes] = await Promise.all([
            (0, db_1.query)('SELECT id, firebase_uid, name FROM users WHERE id = $1 OR firebase_uid = $1', [userId]),
            (0, db_1.query)('SELECT id, firebase_uid, name FROM users WHERE id = $1 OR firebase_uid = $1', [booking.borrower_id]),
            (0, db_1.query)('SELECT id, firebase_uid, name FROM users WHERE id = $1 OR firebase_uid = $1', [booking.lender_id]),
        ]);
        const currentUser = currentUserRes.rows[0];
        const borrowerUser = borrowerRes.rows[0];
        const lenderUser = lenderRes.rows[0];
        const currentId = currentUser?.id || userId;
        const currentFbUid = currentUser?.firebase_uid;
        const isLender = Boolean((lenderUser && (lenderUser.id === currentId || (currentFbUid && lenderUser.firebase_uid === currentFbUid))) ||
            booking.lender_id === userId ||
            (currentFbUid && booking.lender_id === currentFbUid));
        const isBorrower = Boolean((borrowerUser && (borrowerUser.id === currentId || (currentFbUid && borrowerUser.firebase_uid === currentFbUid))) ||
            booking.borrower_id === userId ||
            (currentFbUid && booking.borrower_id === currentFbUid));
        if (!isLender && !isBorrower) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only verified participants of this rental can leave reviews', 403);
        }
        const targetUser = isBorrower ? lenderUser : borrowerUser;
        const revieweeId = targetUser?.id || (isBorrower ? booking.lender_id : booking.borrower_id);
        const reviewerId = currentId;
        if (!revieweeId || revieweeId === reviewerId) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Self-reviews are strictly forbidden', 400);
        }
        if (booking.status !== 'COMPLETED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Reviews can only be submitted after the product is returned and completed', 400);
        }
        if (Number(booking.total_price) > 0 && booking.payment_status !== 'CONFIRMED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Reviews can only be submitted after rental payment has been confirmed by the owner', 400);
        }
        // Check 3-day window (at most 3 days after completion)
        const completedAt = new Date(booking.completed_at || booking.updated_at);
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        if (Date.now() - completedAt.getTime() > threeDaysMs) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Review period has expired. Reviews are available for at most 3 days after completion.', 400);
        }
        // Tamper-proof role-based review type:
        // 1) Borrower (renter) reviewing owner: OWNER_RENTAL (for paid rental) or COMMUNITY_LENDER (for free borrow)
        // 2) Owner reviewing borrower (renter): RENTER
        let resolvedReviewType;
        if (isBorrower) {
            const isFree = Number(booking.total_price || 0) <= 0 || Number(booking.price_per_day || 0) <= 0;
            resolvedReviewType = isFree ? 'COMMUNITY_LENDER' : 'OWNER_RENTAL';
        }
        else {
            resolvedReviewType = 'RENTER';
        }
        const reviewResult = await (0, db_1.query)(`INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment, review_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (booking_id, reviewer_id)
       DO UPDATE SET 
         rating = EXCLUDED.rating, 
         comment = EXCLUDED.comment, 
         review_type = EXCLUDED.review_type, 
         created_at = CURRENT_TIMESTAMP
       RETURNING *`, [id, reviewerId, revieweeId, rating, comment || '', resolvedReviewType]);
        // Recalculate review ratings and verified counts for reviewee
        await (0, db_1.query)(`
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
        WHERE reviewee_id IN (
          SELECT id FROM users WHERE id = $1 OR firebase_uid = $1
          UNION
          SELECT firebase_uid FROM users WHERE (id = $1 OR firebase_uid = $1) AND firebase_uid IS NOT NULL
        )
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
      WHERE users.id = $1 OR users.firebase_uid = $1
    `, [revieweeId]).catch((err) => {
            console.error('Failed to update ratings for reviewee:', err);
        });
        // Notify reviewee about new feedback
        const reviewerRes = await (0, db_1.query)('SELECT name FROM users WHERE id = $1', [reviewerId]);
        const reviewerName = reviewerRes.rows[0]?.name || req.user?.name || 'Your rental partner';
        await (0, notifications_service_1.createNotification)({
            userId: revieweeId,
            senderId: reviewerId,
            bookingId: id,
            referenceId: id,
            referenceType: 'BOOKING',
            type: 'BOOKING_REVIEW',
            title: 'New Review & Rating Received',
            body: `${reviewerName} left a ${rating}-star review for "${booking.item_title || 'rental gear'}".`,
        }).catch(() => { });
        return (0, response_1.sendSuccess)(res, reviewResult.rows[0], 'Thank you! Your review and feedback has been recorded.');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
