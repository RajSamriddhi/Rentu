"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const user_1 = require("../../utils/user");
const notifications_service_1 = require("../notifications/notifications.service");
const router = (0, express_1.Router)();
const sendMessageSchema = zod_1.z.object({
    booking_id: zod_1.z.string().optional().nullable(),
    receiver_id: zod_1.z.string().min(1, 'Receiver is required'),
    content: zod_1.z.string().min(1, 'Message cannot be empty'),
    message_type: zod_1.z.string().optional(),
    proposal_data: zod_1.z.any().optional(),
});
const isUuid = (val) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};
function parseToUtcTimestamp(dateStr, timeStr, tzOffsetMinutes = -330) {
    const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
    const cleanTime = (timeStr && timeStr.trim() && timeStr.slice(0, 5) !== '00:00') ? timeStr.slice(0, 5) : '10:00';
    const [hour, minute] = cleanTime.split(':').map(Number);
    const localUtcMs = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
    return localUtcMs + (tzOffsetMinutes * 60000);
}
// 1. Get User's Active Conversations (Unified per Person)
router.get('/conversations', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Mark pending incoming messages as delivered to this user
        await (0, db_1.query)(`WITH me AS (
        SELECT id::text AS id_text, firebase_uid FROM users WHERE id::text = $1::text OR firebase_uid = $1::text LIMIT 1
      )
      UPDATE messages
      SET is_delivered = true,
          delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
      WHERE (is_delivered = false OR is_delivered IS NULL)
        AND receiver_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)`, [userId]).catch(() => { });
        // Get consolidated conversations: exactly ONE thread per partner user
        const result = await (0, db_1.query)(`WITH me AS (
        SELECT id::text AS id_text, firebase_uid FROM users WHERE id::text = $1::text OR firebase_uid = $1::text LIMIT 1
      ),
      my_ids AS (
        SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL
      ),
      interacted_partners AS (
        -- 1. From direct and booking messages
        SELECT 
          CASE 
            WHEN m.sender_id IN (SELECT id_text FROM my_ids) THEN m.receiver_id
            ELSE m.sender_id
          END AS partner_raw_id,
          m.created_at AS interaction_at
        FROM messages m
        WHERE m.sender_id IN (SELECT id_text FROM my_ids)
           OR m.receiver_id IN (SELECT id_text FROM my_ids)

        UNION ALL

        -- 2. From bookings
        SELECT 
          CASE 
            WHEN b.borrower_id IN (SELECT id_text FROM my_ids) THEN COALESCE(i.owner_id, b.lender_id)
            ELSE b.borrower_id
          END AS partner_raw_id,
          b.created_at AS interaction_at
        FROM bookings b
        JOIN items i ON b.item_id = i.id
        WHERE b.borrower_id IN (SELECT id_text FROM my_ids)
           OR b.lender_id IN (SELECT id_text FROM my_ids)
           OR i.owner_id IN (SELECT id_text FROM my_ids)
      ),
      distinct_partners AS (
        SELECT u.id AS partner_user_id, MAX(ip.interaction_at) AS latest_interaction
        FROM interacted_partners ip
        JOIN users u ON (ip.partner_raw_id = u.id::text OR ip.partner_raw_id = u.firebase_uid)
        WHERE u.id::text NOT IN (SELECT id_text FROM my_ids)
        GROUP BY u.id
      )
      SELECT
        'dm_' || partner.id::text AS conversation_id,
        latest_booking.id AS booking_id,
        COALESCE(latest_booking.status::text, 'DIRECT_DM') AS booking_status,
        latest_booking.start_date,
        latest_booking.duration_days,
        COALESCE(latest_booking.total_price, 0) AS total_price,
        COALESCE(latest_booking.item_title, 'Direct Chat') AS item_title,
        COALESCE(latest_booking.item_images, '[]'::jsonb) AS item_images,
        COALESCE(latest_booking.item_locality, partner.locality) AS item_locality,
        partner.id::text AS partner_id,
        partner.name AS partner_name,
        partner.username AS partner_username,
        partner.avatar_url AS partner_avatar,
        partner.phone AS partner_phone,
        partner.locality AS partner_locality,
        CASE 
          WHEN latest_msg.message_type = 'PROPOSAL' THEN 'Rental Proposal: ' || COALESCE(latest_booking.item_title, 'Gear')
          WHEN latest_msg.message_type = 'IMAGE' THEN 'Photo'
          WHEN latest_msg.message_type = 'LOCATION' THEN 'Shared Location'
          WHEN latest_msg.message_type = 'CONTACT' THEN 'Contact Card'
          WHEN latest_msg.message_type = 'DOCUMENT' THEN 'Document Note'
          ELSE COALESCE(latest_msg.content, 'Direct conversation')
        END AS last_message,
        COALESCE(latest_msg.created_at, dp.latest_interaction) AS last_message_at,
        dp.latest_interaction AS created_at,
        COALESCE(unread.unread_count, 0) AS unread_count
      FROM distinct_partners dp
      JOIN users partner ON dp.partner_user_id = partner.id
      LEFT JOIN LATERAL (
        SELECT 
          m.content, 
          m.message_type,
          m.proposal_data,
          m.created_at,
          m.is_read,
          m.is_delivered,
          m.sender_id
        FROM messages m
        WHERE (
          (m.sender_id IN (SELECT id_text FROM my_ids) AND (m.receiver_id = partner.id::text OR m.receiver_id = partner.firebase_uid))
          OR (m.receiver_id IN (SELECT id_text FROM my_ids) AND (m.sender_id = partner.id::text OR m.sender_id = partner.firebase_uid))
          OR (m.booking_id IN (
            SELECT b_sub.id FROM bookings b_sub 
            WHERE ((b_sub.borrower_id IN (SELECT id_text FROM my_ids) AND (b_sub.lender_id = partner.id::text OR b_sub.lender_id = partner.firebase_uid))
                OR (b_sub.borrower_id IN (partner.id::text, partner.firebase_uid) AND b_sub.lender_id IN (SELECT id_text FROM my_ids)))
          ))
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) latest_msg ON true
      LEFT JOIN LATERAL (
        SELECT 
          b.id,
          b.status,
          b.start_date,
          b.duration_days,
          b.total_price,
          i.title AS item_title,
          i.image_urls AS item_images,
          i.locality AS item_locality
        FROM bookings b
        JOIN items i ON b.item_id = i.id
        WHERE (
          (b.borrower_id IN (SELECT id_text FROM my_ids) AND (b.lender_id = partner.id::text OR b.lender_id = partner.firebase_uid OR i.owner_id = partner.id::text OR i.owner_id = partner.firebase_uid))
          OR ((b.borrower_id = partner.id::text OR b.borrower_id = partner.firebase_uid) AND (b.lender_id IN (SELECT id_text FROM my_ids) OR i.owner_id IN (SELECT id_text FROM my_ids)))
        )
        ORDER BY b.created_at DESC
        LIMIT 1
      ) latest_booking ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS unread_count
        FROM messages m
        WHERE (m.sender_id = partner.id::text OR m.sender_id = partner.firebase_uid)
          AND m.receiver_id IN (SELECT id_text FROM my_ids)
          AND (m.is_read = false OR m.is_read IS NULL)
      ) unread ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_id IN (SELECT id_text FROM my_ids) AND (ub.blocked_id = partner.id::text OR ub.blocked_id = partner.firebase_uid))
           OR (ub.blocked_id IN (SELECT id_text FROM my_ids) AND (ub.blocker_id = partner.id::text OR ub.blocker_id = partner.firebase_uid))
      )
      ORDER BY COALESCE(latest_msg.created_at, dp.latest_interaction) DESC`, [userId]);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// 1.1 Get Total Unread Messages Count
router.get('/unread-count', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await (0, db_1.query)(`WITH me AS (
        SELECT id::text AS id_text, firebase_uid FROM users WHERE id::text = $1::text OR firebase_uid = $1::text LIMIT 1
      ),
      my_ids AS (
        SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL
      )
      SELECT COUNT(*)::int AS unread_count
      FROM messages m
      WHERE (m.is_read = false OR m.is_read IS NULL)
        AND (m.message_type IS NULL OR m.message_type != 'SYSTEM')
        AND m.sender_id NOT IN (SELECT id_text FROM my_ids)
        AND (
          m.receiver_id IN (SELECT id_text FROM my_ids)
          OR (
            m.booking_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.id = m.booking_id
                AND ((b.borrower_id IN (SELECT id_text FROM my_ids) AND m.sender_id != b.borrower_id)
                  OR (b.lender_id IN (SELECT id_text FROM my_ids) AND m.sender_id != b.lender_id))
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id IN (SELECT id_text FROM my_ids) AND (ub.blocked_id = m.sender_id))
             OR (ub.blocked_id IN (SELECT id_text FROM my_ids) AND (ub.blocker_id = m.sender_id))
        )`, [userId]);
        return (0, response_1.sendSuccess)(res, { unread_count: result.rows[0]?.unread_count || 0 });
    }
    catch (error) {
        next(error);
    }
});
// 2. Get Messages for a User (Unified Thread between Me and Partner)
router.get('/:conversationId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        // Resolve my IDs
        const meRes = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
        const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean);
        let rawPartnerId = null;
        let fallbackBooking = null;
        if (conversationId.startsWith('dm_')) {
            rawPartnerId = conversationId.replace(/^dm_/, '');
        }
        else {
            // Check if conversationId is a direct user ID
            const userCheck = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [conversationId]);
            if (userCheck.rows.length > 0) {
                rawPartnerId = userCheck.rows[0].id;
            }
            else if (isUuid(conversationId)) {
                // Check if conversationId is a booking ID
                const bookingCheck = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day, i.owner_id AS item_owner_id
           FROM bookings b
           JOIN items i ON b.item_id = i.id
           WHERE b.id::text = $1`, [conversationId]);
                if (bookingCheck.rows.length > 0) {
                    const b = bookingCheck.rows[0];
                    fallbackBooking = b;
                    const isBorrower = myIds.includes(b.borrower_id);
                    rawPartnerId = isBorrower ? (b.lender_id || b.item_owner_id) : b.borrower_id;
                }
            }
        }
        if (!rawPartnerId) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Conversation partner not found', 404);
        }
        // Fetch partner user data
        const pRes = await (0, db_1.query)(`SELECT id::text, name, username, avatar_url, locality, phone, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [rawPartnerId]);
        const partnerData = pRes.rows[0] || {
            id: rawPartnerId,
            name: 'Community Member',
            avatar_url: null,
            locality: 'Bengaluru',
        };
        const pIds = [rawPartnerId, partnerData.id, partnerData.firebase_uid].filter(Boolean);
        // Block check
        const blockCheck = await (0, db_1.query)(`SELECT 1 FROM user_blocks 
       WHERE (blocker_id = ANY($1::text[]) AND blocked_id = ANY($2::text[]))
          OR (blocker_id = ANY($2::text[]) AND blocked_id = ANY($1::text[]))`, [myIds, pIds]);
        if (blockCheck.rows.length > 0) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Communication with this user is blocked.', 403);
        }
        // Mark unread messages sent to me by partner as READ & DELIVERED
        await (0, db_1.query)(`UPDATE messages
       SET is_read = true,
           read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
           is_delivered = true,
           delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
       WHERE (is_read = false OR is_read IS NULL)
         AND sender_id = ANY($2::text[])
         AND (
           receiver_id = ANY($1::text[])
           OR booking_id IN (
             SELECT b_sub.id FROM bookings b_sub 
             WHERE ((b_sub.borrower_id = ANY($1::text[]) AND b_sub.lender_id = ANY($2::text[]))
                 OR (b_sub.borrower_id = ANY($2::text[]) AND b_sub.lender_id = ANY($1::text[])))
           )
         )`, [myIds, pIds]).catch(() => { });
        // Retrofit older milestone notifications into SYSTEM message type
        await (0, db_1.query)(`UPDATE messages
       SET message_type = 'SYSTEM'
       WHERE (message_type IS NULL OR message_type = 'TEXT')
         AND (
           content LIKE 'Proposal accepted.%'
           OR content LIKE 'Product received and handed over%'
           OR content LIKE 'Product returned to owner%'
           OR content LIKE 'Renter has sent the payment via%'
         )`).catch(() => { });
        // Fetch unified messages between current user and this partner
        const messagesRes = await (0, db_1.query)(`SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.message_type, m.proposal_data, m.is_edited,
        COALESCE(m.is_delivered, false) AS is_delivered, m.delivered_at,
        COALESCE(m.is_read, false) AS is_read, m.read_at,
        m.created_at,
        COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar,
        b_linked.status AS linked_booking_status
       FROM messages m
       LEFT JOIN users u ON (m.sender_id = u.id::text OR m.sender_id = u.firebase_uid)
       LEFT JOIN bookings b_linked ON (m.booking_id = b_linked.id)
       WHERE (
         (m.sender_id = ANY($1::text[]) AND m.receiver_id = ANY($2::text[]))
         OR (m.sender_id = ANY($2::text[]) AND m.receiver_id = ANY($1::text[]))
         OR (m.booking_id IN (
           SELECT b_sub.id FROM bookings b_sub 
           WHERE ((b_sub.borrower_id = ANY($1::text[]) AND (b_sub.lender_id = ANY($2::text[]) OR b_sub.lender_id IS NULL))
               OR (b_sub.borrower_id = ANY($2::text[]) AND (b_sub.lender_id = ANY($1::text[]) OR b_sub.lender_id IS NULL)))
         ))
       )
       ORDER BY m.created_at ASC`, [myIds, pIds]);
        // Fetch latest active booking between them
        const latestBookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE (
         (b.borrower_id = ANY($1::text[]) AND (b.lender_id = ANY($2::text[]) OR i.owner_id = ANY($2::text[])))
         OR (b.borrower_id = ANY($2::text[]) AND (b.lender_id = ANY($1::text[]) OR i.owner_id = ANY($1::text[])))
       )
       ORDER BY b.created_at DESC
       LIMIT 1`, [myIds, pIds]);
        const activeBooking = latestBookingRes.rows[0] || fallbackBooking || null;
        if (activeBooking) {
            delete activeBooking.pickup_code;
            delete activeBooking.return_code;
        }
        // Map messages so proposal_data status stays strictly synchronized with live booking status
        const mappedMessages = messagesRes.rows.map((row) => {
            let content = row.content;
            if (content && typeof content === 'string') {
                content = content.replace(/\.?\s*Pickup Verification Code:\s*\d+\.?/gi, '.');
            }
            if (row.message_type === 'PROPOSAL' && row.proposal_data) {
                let pData = typeof row.proposal_data === 'string' ? JSON.parse(row.proposal_data) : { ...row.proposal_data };
                const bStatus = row.linked_booking_status || (activeBooking?.id && (row.booking_id === activeBooking.id || pData.booking_id === activeBooking.id) ? activeBooking.status : undefined);
                if (bStatus === 'ACCEPTED' || bStatus === 'HANDED_OVER' || bStatus === 'COMPLETED') {
                    pData.status = 'ACCEPTED';
                }
                else if (bStatus === 'REJECTED') {
                    pData.status = 'DECLINED';
                }
                else if (bStatus === 'CANCELLED') {
                    pData.status = 'CANCELLED';
                }
                // Never expose pickup_code or return_code in chat proposal_data
                delete pData.pickup_code;
                delete pData.return_code;
                return {
                    ...row,
                    content,
                    proposal_data: pData,
                };
            }
            return {
                ...row,
                content,
            };
        });
        return (0, response_1.sendSuccess)(res, {
            booking: activeBooking,
            partner: partnerData,
            messages: mappedMessages,
        });
    }
    catch (error) {
        next(error);
    }
});
// 2.1 Mark Conversation Messages as Read Explicitly
router.post('/:conversationId/read', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const isDm = conversationId.startsWith('dm_') || !isUuid(conversationId);
        let rawPartnerId = isDm ? conversationId.replace(/^dm_/, '') : null;
        const meRes = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
        const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean);
        if (!rawPartnerId && isUuid(conversationId)) {
            const bRes = await (0, db_1.query)(`SELECT borrower_id, lender_id FROM bookings WHERE id = $1`, [conversationId]);
            if (bRes.rows.length > 0) {
                const b = bRes.rows[0];
                rawPartnerId = myIds.includes(b.borrower_id) ? b.lender_id : b.borrower_id;
            }
        }
        if (rawPartnerId) {
            const pRes = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [rawPartnerId]);
            const pIds = [rawPartnerId, pRes.rows[0]?.id, pRes.rows[0]?.firebase_uid].filter(Boolean);
            await (0, db_1.query)(`UPDATE messages
         SET is_read = true,
             read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
             is_delivered = true,
             delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
         WHERE (is_read = false OR is_read IS NULL)
           AND sender_id = ANY($2::text[])
           AND (
             receiver_id = ANY($1::text[])
             OR booking_id IN (
               SELECT b_sub.id FROM bookings b_sub 
               WHERE ((b_sub.borrower_id = ANY($1::text[]) AND b_sub.lender_id = ANY($2::text[]))
                   OR (b_sub.borrower_id = ANY($2::text[]) AND b_sub.lender_id = ANY($1::text[])))
             )
           )`, [myIds, pIds]);
        }
        return (0, response_1.sendSuccess)(res, { marked_read: true });
    }
    catch (error) {
        next(error);
    }
});
// 3. Send Message (Booking Message OR Direct Message)
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = sendMessageSchema.parse(req.body);
        const senderId = req.user.id;
        let targetBookingId = null;
        let targetReceiverId = validated.receiver_id;
        if (validated.booking_id && isUuid(validated.booking_id)) {
            const bookingRes = await (0, db_1.query)(`SELECT b.id, b.borrower_id, i.owner_id AS lender_id 
         FROM bookings b 
         JOIN items i ON b.item_id = i.id 
         WHERE b.id = $1`, [validated.booking_id]);
            if (bookingRes.rows.length > 0) {
                const booking = bookingRes.rows[0];
                if (booking.borrower_id === senderId || booking.lender_id === senderId) {
                    targetBookingId = booking.id;
                    targetReceiverId = targetReceiverId || (booking.borrower_id === senderId ? booking.lender_id : booking.borrower_id);
                }
            }
        }
        if (!targetReceiverId) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Recipient is required', 400);
        }
        // BLOCK CHECK: Prevent messages between users if either has blocked the other
        const blockCheck = await (0, db_1.query)(`SELECT 1 FROM user_blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`, [senderId, targetReceiverId]);
        if (blockCheck.rows.length > 0) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Cannot send message. Communication between these users is blocked.', 403);
        }
        const result = await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type, proposal_data, is_delivered, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, false, false)
       RETURNING *`, [
            targetBookingId,
            senderId,
            targetReceiverId,
            validated.content,
            validated.message_type || 'TEXT',
            validated.proposal_data ? JSON.stringify(validated.proposal_data) : null,
        ]);
        const inserted = result.rows[0];
        return (0, response_1.sendSuccess)(res, {
            ...inserted,
            is_delivered: false,
            is_read: false,
            sender_name: req.user.name || 'You',
            sender_avatar: req.user?.avatar_url || null,
        }, 'Message sent');
    }
    catch (error) {
        next(error);
    }
});
// 4. Accept a Personal Listing / Request Proposal
router.post('/proposal/:messageId/accept', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.user.id;
        // Fetch the proposal message
        const msgRes = await (0, db_1.query)(`SELECT * FROM messages WHERE id = $1`, [messageId]);
        if (msgRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Proposal message not found', 404);
        }
        const message = msgRes.rows[0];
        const myIds = await (0, user_1.resolveUserIds)(currentUserId);
        if (!myIds.includes(String(message.receiver_id))) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the intended recipient can accept this agreement', 403);
        }
        const proposal = typeof message.proposal_data === 'string'
            ? JSON.parse(message.proposal_data)
            : (message.proposal_data || {});
        if (proposal.status === 'ACCEPTED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This agreement has already been accepted', 400);
        }
        const existingBookingId = message.booking_id || proposal.booking_id;
        if (existingBookingId && isUuid(existingBookingId)) {
            // Handle acceptance for a standard listing rental booking request
            const bRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.owner_id AS item_owner_id,
                TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
                TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str
         FROM bookings b
         JOIN items i ON b.item_id = i.id
         WHERE b.id = $1`, [existingBookingId]);
            if (bRes.rows.length > 0) {
                const existingBooking = bRes.rows[0];
                // State machine check: can only accept PENDING bookings
                if (existingBooking.status !== 'PENDING') {
                    return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot accept request. Current status is ${existingBooking.status}.`, 400);
                }
                // PAST TIME CHECK ON ACCEPTANCE:
                const sDate = existingBooking.start_date_str || existingBooking.start_date;
                const eDate = existingBooking.end_date_str || existingBooking.end_date;
                const endTimestamp = parseToUtcTimestamp(eDate, existingBooking.end_time || '18:00', -330);
                if (endTimestamp < Date.now()) {
                    return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This booking request cannot be accepted because its scheduled rental time has already passed.', 400);
                }
                // CALENDAR OVERLAP CHECK:
                const conflictRes = await (0, db_1.query)(`SELECT id, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
                  TO_CHAR(COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date
           FROM bookings
           WHERE item_id = $1
             AND id != $2
             AND status IN ('ACCEPTED', 'HANDED_OVER')
             AND (
               start_date <= $4::date
               AND COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date) >= $3::date
             )
           LIMIT 1`, [existingBooking.item_id, existingBookingId, sDate, eDate]);
                if (conflictRes.rows.length > 0) {
                    const c = conflictRes.rows[0];
                    return (0, response_1.sendError)(res, 'CONFLICT', `Cannot accept proposal: This item is already booked from ${c.start_date} to ${c.end_date}.`, 409);
                }
                // Auto-cancel any conflicting pending requests for this item during the same dates
                const conflictingPendingRes = await (0, db_1.query)(`SELECT id, borrower_id 
           FROM bookings
           WHERE item_id = $1
             AND id != $2
             AND status = 'PENDING'
             AND (
               start_date <= $4::date
               AND COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date) >= $3::date
             )`, [existingBooking.item_id, existingBookingId, sDate, eDate]);
                for (const conflicting of conflictingPendingRes.rows) {
                    await (0, db_1.query)(`UPDATE bookings SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [conflicting.id]);
                    await (0, db_1.query)(`UPDATE messages 
             SET proposal_data = jsonb_set(COALESCE(proposal_data, '{}'::jsonb), '{status}', '"CANCELLED"'::jsonb)
             WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [conflicting.id]).catch(() => { });
                    await (0, notifications_service_1.createNotification)({
                        userId: conflicting.borrower_id,
                        bookingId: conflicting.id,
                        referenceId: conflicting.id,
                        referenceType: 'BOOKING',
                        type: 'BOOKING_CANCELLED',
                        title: 'Request Auto-Cancelled',
                        body: `Your rental request was cancelled because the owner accepted another booking for those dates.`,
                    }).catch(() => { });
                }
                // Generate pickup handover verification code (return_code is strictly generated later upon verified handover)
                const pickupCode = existingBooking.pickup_code || Math.floor(100000 + Math.random() * 900000).toString();
                const updateRes = await (0, db_1.query)(`UPDATE bookings
           SET status = 'ACCEPTED',
               pickup_code = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`, [pickupCode, existingBookingId]);
                const updatedBooking = updateRes.rows[0];
                const updatedProposal = {
                    ...proposal,
                    status: 'ACCEPTED',
                    accepted_at: new Date().toISOString(),
                };
                await (0, db_1.query)(`UPDATE messages SET proposal_data = $1 WHERE id = $2`, [JSON.stringify(updatedProposal), messageId]);
                const itemTitle = existingBooking.item_title || proposal.item_title || 'Item';
                const totalPrice = updatedBooking.total_price || proposal.total_price || 0;
                const priceDisplay = Number(totalPrice) === 0 ? 'Free' : `₹${totalPrice}`;
                await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
           VALUES ($1, $2, $3, $4, 'SYSTEM')`, [
                    existingBookingId,
                    currentUserId,
                    message.sender_id,
                    `Request Accepted. Confirmed booking for "${itemTitle}" (${priceDisplay}). Handover is now live in Bookings.`,
                ]);
                await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
           VALUES ($1, $2, 'BOOKING_ACCEPTED', 'Rental Request Accepted', 'Your request for "' || $3 || '" was accepted. Handover is now active in Bookings.', $4, 'BOOKING')`, [message.sender_id, currentUserId, itemTitle, existingBookingId]).catch(() => { });
                // Never expose pickup_code or return_code in proposal_data response
                const safeProposal = { ...updatedProposal };
                delete safeProposal.pickup_code;
                delete safeProposal.return_code;
                const safeBooking = { ...updatedBooking };
                // Never expose pickup code or return code upon immediate acceptance before scheduled meetup time
                delete safeBooking.pickup_code;
                delete safeBooking.return_code;
                return (0, response_1.sendSuccess)(res, {
                    booking: safeBooking,
                    message_id: messageId,
                    proposal_data: safeProposal,
                }, 'Rental request accepted');
            }
        }
        // Determine lender and borrower based on proposal type for custom deals:
        // If proposal was created as LISTING or is a lend offer from owner: creator/lender is message.sender_id, recipient is borrower.
        // If proposal was created as REQUEST: creator is borrower, recipient is lender.
        const isOffer = proposal.type === 'LISTING' || proposal.is_lend_offer === true;
        const lenderId = isOffer ? message.sender_id : currentUserId;
        const borrowerId = isOffer ? currentUserId : message.sender_id;
        // Fetch canonical user records for lender and borrower
        const [lenderUserRes, borrowerUserRes] = await Promise.all([
            (0, db_1.query)(`SELECT id::text, locality, address_text FROM users WHERE id::text = $1 OR firebase_uid = $1`, [lenderId]),
            (0, db_1.query)(`SELECT id::text, locality, address_text FROM users WHERE id::text = $1 OR firebase_uid = $1`, [borrowerId]),
        ]);
        const lenderInfo = lenderUserRes.rows[0] || {};
        const borrowerInfo = borrowerUserRes.rows[0] || {};
        const canonicalLenderId = lenderInfo.id || lenderId;
        const canonicalBorrowerId = borrowerInfo.id || borrowerId;
        const startDate = proposal.start_date || new Date().toISOString().split('T')[0];
        const durationDays = Math.max(1, Number(proposal.duration_days) || 1);
        const pricePerDay = Number(proposal.price_per_day) || (Number(proposal.total_price) / durationDays) || 0;
        const totalPrice = Number(proposal.total_price) || (pricePerDay * durationDays);
        // 1. Create the item record for this custom listing so it shows in My Listings, reviews, calendar
        const itemTitle = proposal.title || 'Personal Agreement Item';
        const itemRes = await (0, db_1.query)(`INSERT INTO items (
        owner_id, title, description, category, price_per_day, max_duration_days, 
        image_urls, locality, address_text, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'AVAILABLE')
      RETURNING *`, [
            canonicalLenderId,
            itemTitle,
            proposal.description || proposal.notes || `Personal custom agreement via Rentu DM`,
            proposal.category || 'Other',
            pricePerDay,
            Math.max(durationDays, 3),
            proposal.image_url ? JSON.stringify([proposal.image_url]) : JSON.stringify([]),
            proposal.locality || lenderInfo.locality || 'Bangalore',
            proposal.address_text || proposal.delivery_location || lenderInfo.address_text || 'Local pickup',
        ]);
        const createdItem = itemRes.rows[0];
        // Calculate end date
        const sDate = new Date(startDate);
        const eDate = new Date(sDate);
        eDate.setDate(sDate.getDate() + durationDays);
        const endDateStr = proposal.end_date || eDate.toISOString().split('T')[0];
        // 2. Generate handover security code (6 digits) for pickup
        const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        // 3. Create the booking with status 'ACCEPTED'
        const bookingRes = await (0, db_1.query)(`INSERT INTO bookings (
        item_id, borrower_id, lender_id, start_date, duration_days, total_price,
        status, message, end_date, start_time, end_time, pickup_type, pickup_locality,
        return_type, return_locality, requires_delivery, delivery_fee, requires_pickup, pickup_fee,
        pickup_code, return_code
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACCEPTED', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NULL)
      RETURNING *`, [
            createdItem.id,
            canonicalBorrowerId,
            canonicalLenderId,
            startDate,
            durationDays,
            totalPrice,
            `Agreed personal deal in DM: ${proposal.notes || ''}`,
            endDateStr,
            proposal.start_time || '10:00:00',
            proposal.end_time || '18:00',
            proposal.delivery_option === 'LENDER_DELIVERY' ? 'OWNER_DELIVERY' : 'LENDER_LOCATION',
            proposal.delivery_location || lenderInfo.locality || 'Handover location',
            proposal.collection_option === 'LENDER_COLLECT' ? 'OWNER_COLLECT' : 'LENDER_LOCATION',
            proposal.return_location || lenderInfo.locality || 'Return location',
            !!proposal.delivery_fee && Number(proposal.delivery_fee) > 0,
            Number(proposal.delivery_fee) || 0,
            !!proposal.collection_fee && Number(proposal.collection_fee) > 0,
            Number(proposal.collection_fee) || 0,
            pickupCode,
        ]);
        const createdBooking = bookingRes.rows[0];
        // 4. Update the proposal message
        const updatedProposal = {
            ...proposal,
            status: 'ACCEPTED',
            booking_id: createdBooking.id,
            item_id: createdItem.id,
            accepted_at: new Date().toISOString(),
        };
        await (0, db_1.query)(`UPDATE messages 
       SET proposal_data = $1, booking_id = $2
       WHERE id = $3`, [JSON.stringify(updatedProposal), createdBooking.id, messageId]);
        // 5. Insert system confirmation message into the chat
        const cleanStartDate = String(startDate).split('T')[0];
        const cleanEndDate = String(endDateStr).split('T')[0];
        const priceDisplay = Number(totalPrice) === 0 ? 'Free' : `₹${totalPrice}`;
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'SYSTEM')`, [
            createdBooking.id,
            currentUserId,
            message.sender_id,
            `Agreement Accepted. Confirmed booking for "${itemTitle}" (${priceDisplay}) is scheduled from ${cleanStartDate} to ${cleanEndDate}. Active in Bookings.`,
        ]);
        // 6. If this proposal originated from a community request, mark that request as FULFILLED
        if (proposal.request_id) {
            await (0, db_1.query)(`UPDATE requests SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [proposal.request_id]).catch(() => { });
        }
        // 7. Send notifications to both lender and borrower about the ongoing booking
        await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
       VALUES ($1, $2, 'BOOKING_STARTED', 'Booking Confirmed: ' || $3, 'Rental agreement confirmed. Handover is now live in your Ongoing Bookings.', $4, 'BOOKING')`, [canonicalBorrowerId, canonicalLenderId, itemTitle, createdBooking.id]).catch(() => { });
        await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
       VALUES ($1, $2, 'BOOKING_STARTED', 'Booking Confirmed: ' || $3, 'Rental agreement confirmed. Handover is now live in your Ongoing Bookings.', $4, 'BOOKING')`, [canonicalLenderId, canonicalBorrowerId, itemTitle, createdBooking.id]).catch(() => { });
        const safeCreatedBooking = { ...createdBooking };
        // Never expose pickup code or return code upon immediate acceptance before scheduled meetup time
        delete safeCreatedBooking.pickup_code;
        delete safeCreatedBooking.return_code;
        const safeProposal = { ...updatedProposal };
        delete safeProposal.pickup_code;
        delete safeProposal.return_code;
        return (0, response_1.sendSuccess)(res, {
            booking: safeCreatedBooking,
            item: createdItem,
            message_id: messageId,
            proposal_data: safeProposal,
        }, 'Agreement accepted and booking created');
    }
    catch (error) {
        next(error);
    }
});
// 5. Decline a Personal Listing / Request Proposal
router.post('/proposal/:messageId/decline', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.user.id;
        const msgRes = await (0, db_1.query)(`SELECT * FROM messages WHERE id = $1`, [messageId]);
        if (msgRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Proposal message not found', 404);
        }
        const message = msgRes.rows[0];
        const myIds = await (0, user_1.resolveUserIds)(currentUserId);
        if (!myIds.includes(String(message.receiver_id)) && !myIds.includes(String(message.sender_id))) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied', 403);
        }
        const isReceiver = myIds.includes(String(message.receiver_id));
        const isSender = myIds.includes(String(message.sender_id));
        if (!isReceiver && !isSender) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied: You are not part of this proposal', 403);
        }
        const proposal = typeof message.proposal_data === 'string'
            ? JSON.parse(message.proposal_data)
            : (message.proposal_data || {});
        const targetProposalStatus = isReceiver ? 'DECLINED' : 'CANCELLED';
        const targetBookingStatus = isReceiver ? 'REJECTED' : 'CANCELLED';
        const updatedProposal = { ...proposal, status: targetProposalStatus };
        await (0, db_1.query)(`UPDATE messages SET proposal_data = $1 WHERE id = $2`, [JSON.stringify(updatedProposal), messageId]);
        const existingBookingId = message.booking_id || proposal.booking_id;
        if (existingBookingId && isUuid(existingBookingId)) {
            await (0, db_1.query)(`UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [targetBookingStatus, existingBookingId]).catch(() => { });
            const itemTitle = proposal.item_title || proposal.title || 'Item';
            const notificationRecipientId = isReceiver ? message.sender_id : message.receiver_id;
            const statusActionText = isReceiver ? 'was declined' : 'was cancelled by the sender';
            await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
         VALUES ($1, $2, $3, $4, 'SYSTEM')`, [
                existingBookingId,
                currentUserId,
                notificationRecipientId,
                `Rental request for "${itemTitle}" ${statusActionText}.`,
            ]).catch(() => { });
            await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
         VALUES ($1, $2, $3, $4, 'Your request for "' || $5 || '" ' || $6 || '.', $7, 'BOOKING')`, [
                notificationRecipientId,
                currentUserId,
                isReceiver ? 'BOOKING_REJECTED' : 'BOOKING_CANCELLED',
                isReceiver ? 'Rental Request Declined' : 'Rental Request Cancelled',
                itemTitle,
                statusActionText,
                existingBookingId,
            ]).catch(() => { });
        }
        return (0, response_1.sendSuccess)(res, { proposal_data: updatedProposal }, `Proposal ${targetProposalStatus.toLowerCase()}`);
    }
    catch (error) {
        next(error);
    }
});
// 6. Delete entire conversation with someone
router.delete('/conversations/:conversationId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const isDm = conversationId.startsWith('dm_') || !isUuid(conversationId);
        const rawPartnerId = isDm ? conversationId.replace(/^dm_/, '') : null;
        if (isDm && rawPartnerId) {
            // Find all IDs for me and partner
            const meRes = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
            const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean);
            const pRes = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [rawPartnerId]);
            const pIds = [rawPartnerId, pRes.rows[0]?.id, pRes.rows[0]?.firebase_uid].filter(Boolean);
            await (0, db_1.query)(`DELETE FROM messages
         WHERE (sender_id = ANY($1::text[]) AND receiver_id = ANY($2::text[]))
            OR (sender_id = ANY($2::text[]) AND receiver_id = ANY($1::text[]))`, [myIds, pIds]);
            return (0, response_1.sendSuccess)(res, { conversation_id: conversationId }, 'Chat deleted successfully');
        }
        // If it's a booking conversation, delete all messages for this booking
        await (0, db_1.query)(`DELETE FROM messages WHERE booking_id::text = $1`, [conversationId]);
        return (0, response_1.sendSuccess)(res, { conversation_id: conversationId }, 'Chat cleared');
    }
    catch (error) {
        next(error);
    }
});
// 7. Edit an individual message (or update proposal_data/live location)
router.put('/:messageId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const { content, proposal_data } = req.body;
        const userId = req.user.id;
        const checkRes = await (0, db_1.query)(`SELECT * FROM messages WHERE id::text = $1`, [messageId]);
        if (checkRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Message not found', 404);
        }
        const msg = checkRes.rows[0];
        const userRow = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
        const validSenders = [userId, userRow.rows[0]?.id, userRow.rows[0]?.firebase_uid].filter(Boolean);
        if (!validSenders.includes(msg.sender_id)) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'You can only edit your own messages', 403);
        }
        const newContent = (content && content.trim()) || msg.content;
        const newProposalData = proposal_data !== undefined
            ? (typeof proposal_data === 'string' ? proposal_data : JSON.stringify(proposal_data))
            : msg.proposal_data;
        const result = await (0, db_1.query)(`UPDATE messages SET content = $1, proposal_data = $2, is_edited = true WHERE id::text = $3 RETURNING *`, [newContent, newProposalData, messageId]);
        return (0, response_1.sendSuccess)(res, result.rows[0], 'Message updated');
    }
    catch (error) {
        next(error);
    }
});
// 8. Delete an individual message
router.delete('/:messageId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        const checkRes = await (0, db_1.query)(`SELECT * FROM messages WHERE id::text = $1`, [messageId]);
        if (checkRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Message not found', 404);
        }
        const msg = checkRes.rows[0];
        const userRow = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
        const validSenders = [userId, userRow.rows[0]?.id, userRow.rows[0]?.firebase_uid].filter(Boolean);
        if (!validSenders.includes(msg.sender_id)) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'You can only delete your own messages', 403);
        }
        await (0, db_1.query)(`DELETE FROM messages WHERE id::text = $1`, [messageId]);
        return (0, response_1.sendSuccess)(res, { id: messageId }, 'Message deleted');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
