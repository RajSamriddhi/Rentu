"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParseJson = safeParseJson;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
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
    proposal_data: zod_1.z.union([zod_1.z.record(zod_1.z.any()), zod_1.z.string()]).optional().nullable(),
});
function safeParseJson(data) {
    if (!data)
        return {};
    if (typeof data === 'object')
        return data;
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch {
            return {};
        }
    }
    return {};
}
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
        const myIds = await (0, user_1.resolveUserIds)(userId, req.user?.email);
        // Update caller's presence timestamp
        await (0, db_1.query)(`UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id::text = ANY($1::text[]) OR firebase_uid = ANY($1::text[])`, [myIds]).catch(() => { });
        // Mark pending incoming messages as delivered to this user
        await (0, db_1.query)(`UPDATE messages
       SET is_delivered = true,
           delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
       WHERE (is_delivered = false OR is_delivered IS NULL)
         AND receiver_id = ANY($1::text[])`, [myIds]).catch(() => { });
        // Get consolidated conversations: exactly ONE thread per partner user
        const result = await (0, db_1.query)(`WITH my_ids AS (
        SELECT unnest($1::text[]) AS id_text
      ),
      user_deleted AS (
        SELECT partner_id, MAX(deleted_at) AS deleted_at
        FROM user_deleted_conversations
        WHERE user_id IN (SELECT id_text FROM my_ids)
        GROUP BY partner_id
      ),
      raw_interactions AS (
        -- 1. From direct and booking messages
        SELECT 
          CASE 
            WHEN m.sender_id IN (SELECT id_text FROM my_ids) THEN m.receiver_id
            ELSE m.sender_id
          END AS partner_raw_id,
          m.created_at AS interaction_at
        FROM messages m
        WHERE (m.sender_id IN (SELECT id_text FROM my_ids)
           OR m.receiver_id IN (SELECT id_text FROM my_ids))
          AND (m.deleted_by IS NULL OR NOT (m.deleted_by && (SELECT ARRAY_AGG(id_text) FROM my_ids)))

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
      filtered_interactions AS (
        SELECT ri.partner_raw_id, ri.interaction_at
        FROM raw_interactions ri
        LEFT JOIN user_deleted ud ON (
          ri.partner_raw_id = ud.partner_id
          OR ri.partner_raw_id IN (SELECT u_alias.id::text FROM users u_alias WHERE u_alias.id::text = ud.partner_id OR u_alias.firebase_uid = ud.partner_id)
          OR ri.partner_raw_id IN (SELECT u_alias.firebase_uid FROM users u_alias WHERE u_alias.id::text = ud.partner_id OR u_alias.firebase_uid = ud.partner_id)
        )
        WHERE ud.deleted_at IS NULL OR ri.interaction_at > ud.deleted_at
      ),
      distinct_partners AS (
        SELECT u.id AS partner_user_id, MAX(fi.interaction_at) AS latest_interaction
        FROM filtered_interactions fi
        JOIN users u ON (fi.partner_raw_id = u.id::text OR fi.partner_raw_id = u.firebase_uid)
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
        partner.last_seen_at,
        (partner.last_seen_at IS NOT NULL AND partner.last_seen_at > (CURRENT_TIMESTAMP - INTERVAL '5 minutes')) AS is_online,
        EXISTS (
          SELECT 1 FROM user_muted_conversations umc
          WHERE umc.user_id IN (SELECT id_text FROM my_ids)
            AND (umc.partner_id = partner.id::text OR umc.partner_id = partner.firebase_uid)
        ) AS is_muted,
        NULL AS partner_phone,
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
        AND (m.deleted_by IS NULL OR NOT (m.deleted_by && (SELECT ARRAY_AGG(id_text) FROM my_ids)))
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
          AND (m.message_type IS NULL OR m.message_type != 'SYSTEM')
          AND (m.deleted_by IS NULL OR NOT (m.deleted_by && (SELECT ARRAY_AGG(id_text) FROM my_ids)))
      ) unread ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_id IN (SELECT id_text FROM my_ids) AND (ub.blocked_id = partner.id::text OR ub.blocked_id = partner.firebase_uid))
           OR (ub.blocked_id IN (SELECT id_text FROM my_ids) AND (ub.blocker_id = partner.id::text OR ub.blocker_id = partner.firebase_uid))
      )
      ORDER BY COALESCE(latest_msg.created_at, dp.latest_interaction) DESC`, [myIds]);
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
        const myIds = await (0, user_1.resolveUserIds)(userId, req.user?.email);
        const result = await (0, db_1.query)(`WITH my_ids AS (
        SELECT unnest($1::text[]) AS id_text
      )
      SELECT COUNT(*)::int AS unread_count
      FROM messages m
      WHERE (m.is_read = false OR m.is_read IS NULL)
        AND (m.message_type IS NULL OR m.message_type != 'SYSTEM')
        AND m.sender_id NOT IN (SELECT id_text FROM my_ids)
        AND m.receiver_id IN (SELECT id_text FROM my_ids)
        AND (m.deleted_by IS NULL OR NOT (m.deleted_by && (SELECT ARRAY_AGG(id_text) FROM my_ids)))
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id IN (SELECT id_text FROM my_ids) AND (ub.blocked_id = m.sender_id))
             OR (ub.blocked_id IN (SELECT id_text FROM my_ids) AND (ub.blocker_id = m.sender_id))
        )`, [myIds]);
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
        const myIds = await (0, user_1.resolveUserIds)(userId, req.user?.email);
        // Update caller's presence timestamp
        await (0, db_1.query)(`UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id::text = ANY($1::text[]) OR firebase_uid = ANY($1::text[])`, [myIds]).catch(() => { });
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
                    const isParticipant = myIds.includes(String(b.borrower_id)) ||
                        myIds.includes(String(b.lender_id)) ||
                        myIds.includes(String(b.item_owner_id)) ||
                        req.user.role === 'ADMIN';
                    if (!isParticipant) {
                        return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied: You are not an authorized participant in this booking.', 403);
                    }
                    fallbackBooking = b;
                    const isBorrower = myIds.includes(String(b.borrower_id));
                    rawPartnerId = isBorrower ? (b.lender_id || b.item_owner_id) : b.borrower_id;
                }
            }
        }
        if (!rawPartnerId) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Conversation partner not found', 404);
        }
        // Fetch partner user data
        const pRes = await (0, db_1.query)(`SELECT id::text, name, username, avatar_url, locality, firebase_uid, last_seen_at FROM users WHERE id::text = $1 OR firebase_uid = $1`, [rawPartnerId]);
        const partnerData = pRes.rows[0] || {
            id: rawPartnerId,
            name: 'Community Member',
            avatar_url: null,
            locality: '',
            last_seen_at: null,
        };
        const pIds = [rawPartnerId, partnerData.id, partnerData.firebase_uid].filter(Boolean);
        // Block check
        const blockCheck = await (0, db_1.query)(`SELECT 1 FROM user_blocks 
       WHERE (blocker_id = ANY($1::text[]) AND blocked_id = ANY($2::text[]))
          OR (blocker_id = ANY($2::text[]) AND blocked_id = ANY($1::text[]))`, [myIds, pIds]);
        if (blockCheck.rows.length > 0) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Communication with this user is blocked.', 403);
        }
        // Mark unread messages sent to me by partner as READ & DELIVERED (if requested)
        if (req.query.mark_read !== 'false') {
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
        }
        // Fetch unified messages between current user and this partner (recent limited messages)
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 200);
        const messagesRes = await (0, db_1.query)(`SELECT * FROM (
        SELECT 
          m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.message_type, m.proposal_data, m.is_edited,
          COALESCE(m.is_delivered, false) AS is_delivered, m.delivered_at,
          COALESCE(m.is_read, false) AS is_read, m.read_at,
          m.created_at, m.updated_at,
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
        AND (m.deleted_by IS NULL OR NOT (m.deleted_by && $1::text[]))
        ORDER BY m.created_at DESC
        LIMIT $3
      ) sub
      ORDER BY created_at ASC`, [myIds, pIds, limit]);
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
                let pData = safeParseJson(row.proposal_data);
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
        const isMutedRes = await (0, db_1.query)(`SELECT 1 FROM user_muted_conversations
       WHERE user_id = ANY($1::text[]) AND partner_id = ANY($2::text[])`, [myIds, pIds]).catch(() => ({ rows: [] }));
        const isOnline = partnerData.last_seen_at
            ? (Date.now() - new Date(partnerData.last_seen_at).getTime() < 5 * 60 * 1000)
            : false;
        return (0, response_1.sendSuccess)(res, {
            booking: activeBooking,
            partner: {
                ...partnerData,
                is_online: isOnline,
                is_muted: isMutedRes.rows.length > 0,
            },
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
        const myIds = await (0, user_1.resolveUserIds)(senderId, req.user?.email);
        // Update presence
        await (0, db_1.query)(`UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id::text = ANY($1::text[]) OR firebase_uid = ANY($1::text[])`, [myIds]).catch(() => { });
        let targetBookingId = null;
        let targetReceiverId = validated.receiver_id;
        if (validated.booking_id && isUuid(validated.booking_id)) {
            const bookingRes = await (0, db_1.query)(`SELECT b.id, b.borrower_id, i.owner_id AS lender_id 
         FROM bookings b 
         JOIN items i ON b.item_id = i.id 
         WHERE b.id = $1`, [validated.booking_id]);
            if (bookingRes.rows.length === 0) {
                return (0, response_1.sendError)(res, 'NOT_FOUND', 'Linked booking not found', 404);
            }
            const booking = bookingRes.rows[0];
            const isBorrower = myIds.includes(String(booking.borrower_id));
            const isLender = myIds.includes(String(booking.lender_id));
            if (!isBorrower && !isLender && req.user.role !== 'ADMIN') {
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied: You are not a participant in this booking.', 403);
            }
            // Verify that receiver is strictly the other participant in this booking
            const expectedPartnerId = isBorrower ? booking.lender_id : booking.borrower_id;
            const receiverIds = await (0, user_1.resolveUserIds)(targetReceiverId);
            if (!receiverIds.includes(String(expectedPartnerId)) && req.user.role !== 'ADMIN') {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Receiver must be the other participant in this booking.', 400);
            }
            targetBookingId = booking.id;
            targetReceiverId = expectedPartnerId;
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
        const cleanProposalData = validated.proposal_data
            ? (typeof validated.proposal_data === 'string' ? safeParseJson(validated.proposal_data) : validated.proposal_data)
            : null;
        const result = await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type, proposal_data, is_delivered, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, false, false)
       RETURNING *`, [
            targetBookingId,
            senderId,
            targetReceiverId,
            validated.content,
            validated.message_type || 'TEXT',
            cleanProposalData ? JSON.stringify(cleanProposalData) : null,
        ]);
        const inserted = result.rows[0];
        // Check if recipient has muted the sender before dispatching notification
        const isMutedRes = await (0, db_1.query)(`SELECT 1 FROM user_muted_conversations
       WHERE (user_id = $1 OR user_id IN (SELECT firebase_uid FROM users WHERE id::text = $1))
         AND (partner_id = $2 OR partner_id IN (SELECT firebase_uid FROM users WHERE id::text = $2))`, [targetReceiverId, senderId]).catch(() => ({ rows: [] }));
        if (isMutedRes.rows.length === 0) {
            const senderName = req.user.name || 'A neighbor';
            const previewText = validated.message_type === 'IMAGE'
                ? '📷 Sent a photo'
                : validated.message_type === 'LOCATION'
                    ? '📍 Shared a location'
                    : validated.message_type === 'CONTACT'
                        ? '👤 Sent a contact card'
                        : validated.message_type === 'DOCUMENT'
                            ? '📄 Sent a note'
                            : validated.content.length > 80
                                ? validated.content.slice(0, 77) + '...'
                                : validated.content;
            await (0, notifications_service_1.createNotification)({
                userId: targetReceiverId,
                senderId: senderId,
                bookingId: targetBookingId || undefined,
                referenceId: inserted.id,
                referenceType: 'MESSAGE',
                type: 'NEW_MESSAGE',
                title: `Message from ${senderName}`,
                body: previewText,
            }).catch((err) => console.warn('Failed to dispatch new message notification:', err));
        }
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
        const myIds = await (0, user_1.resolveUserIds)(currentUserId, req.user?.email);
        if (!myIds.includes(String(message.receiver_id))) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the intended recipient can accept this agreement', 403);
        }
        if (message.message_type !== 'PROPOSAL') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This message is not a proposal.', 400);
        }
        if (!message.proposal_data && !message.booking_id) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This message is not a rental proposal or booking offer.', 400);
        }
        const proposal = safeParseJson(message.proposal_data);
        if (proposal.status && proposal.status !== 'PENDING') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot accept agreement with status "${proposal.status}". Only pending proposals can be accepted.`, 400);
        }
        const existingBookingId = message.booking_id || proposal.booking_id;
        if (existingBookingId && isUuid(existingBookingId)) {
            // Handle acceptance for a standard listing rental booking request
            const bRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.owner_id AS item_owner_id,
                TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
                TO_CHAR(COALESCE(b.end_date, (b.start_date + ((GREATEST(b.duration_days, 1) - 1) || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str
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
                const tzOffset = typeof req.body?.timezone_offset_minutes === 'number'
                    ? req.body.timezone_offset_minutes
                    : (proposal.timezone_offset_minutes ?? -330);
                const startTimestamp = parseToUtcTimestamp(sDate, existingBooking.start_time || '10:00', tzOffset);
                if (startTimestamp < Date.now()) {
                    return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This booking request cannot be accepted because its scheduled pickup time has already passed.', 400);
                }
                const client = await db_1.pool.connect();
                let updatedBooking;
                let updatedProposal;
                let conflictingPendingList = [];
                const itemTitle = existingBooking.item_title || proposal.item_title || 'Item';
                try {
                    await client.query('BEGIN');
                    // ATOMIC LOCK: Lock the message, booking, and item to prevent concurrent acceptances
                    await client.query('SELECT id, proposal_data FROM messages WHERE id = $1 FOR UPDATE', [messageId]);
                    const lockedBookingRes = await client.query('SELECT id, status FROM bookings WHERE id = $1 FOR UPDATE', [existingBookingId]);
                    if (lockedBookingRes.rows.length === 0 || lockedBookingRes.rows[0].status !== 'PENDING') {
                        await client.query('ROLLBACK');
                        return (0, response_1.sendError)(res, 'CONFLICT', 'This booking request is no longer pending or has already been updated.', 409);
                    }
                    await client.query('SELECT id FROM items WHERE id = $1 FOR UPDATE', [existingBooking.item_id]);
                    // CALENDAR OVERLAP CHECK (under atomic item lock):
                    const conflictRes = await client.query(`SELECT id, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
                    TO_CHAR(COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date,
                    start_time, end_time
             FROM bookings
             WHERE item_id = $1
               AND id != $2
               AND status IN ('ACCEPTED', 'HANDED_OVER')
               AND (
                 start_date <= $4::date
                 AND COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date) >= $3::date
               )`, [existingBooking.item_id, existingBookingId, sDate, eDate]);
                    const reqStartTs = parseToUtcTimestamp(sDate, existingBooking.start_time || '10:00', tzOffset);
                    const reqEndTs = parseToUtcTimestamp(eDate, existingBooking.end_time || '18:00', tzOffset);
                    let actualConflict = null;
                    for (const c of conflictRes.rows) {
                        const cStartTs = parseToUtcTimestamp(c.start_date, c.start_time || '10:00', tzOffset);
                        const cEndTs = parseToUtcTimestamp(c.end_date || c.start_date, c.end_time || '18:00', tzOffset);
                        if (reqStartTs < cEndTs && cStartTs < reqEndTs) {
                            actualConflict = c;
                            break;
                        }
                    }
                    if (actualConflict) {
                        await client.query('ROLLBACK');
                        return (0, response_1.sendError)(res, 'CONFLICT', `Cannot accept proposal: This item is already booked from ${actualConflict.start_date} ${actualConflict.start_time || '10:00'} to ${actualConflict.end_date} ${actualConflict.end_time || '18:00'}.`, 409);
                    }
                    // Auto-cancel any conflicting pending requests for this item during the same dates/times
                    const conflictingPendingRes = await client.query(`SELECT id, borrower_id, TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
                    TO_CHAR(COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date,
                    start_time, end_time
             FROM bookings
             WHERE item_id = $1
               AND id != $2
               AND status = 'PENDING'
               AND (
                 start_date <= $4::date
                 AND COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date) >= $3::date
               )`, [existingBooking.item_id, existingBookingId, sDate, eDate]);
                    const toCancelPending = conflictingPendingRes.rows.filter((cp) => {
                        const cpStartTs = parseToUtcTimestamp(cp.start_date, cp.start_time || '10:00', tzOffset);
                        const cpEndTs = parseToUtcTimestamp(cp.end_date || cp.start_date, cp.end_time || '18:00', tzOffset);
                        return reqStartTs < cpEndTs && cpStartTs < reqEndTs;
                    });
                    conflictingPendingList = toCancelPending;
                    for (const conflicting of toCancelPending) {
                        await client.query(`UPDATE bookings SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [conflicting.id]);
                        await client.query(`UPDATE messages 
               SET proposal_data = jsonb_set(COALESCE(proposal_data, '{}'::jsonb), '{status}', '"CANCELLED"'::jsonb)
               WHERE booking_id = $1 OR (proposal_data->>'booking_id' = $1::text)`, [conflicting.id]).catch(() => { });
                    }
                    // Generate pickup handover verification code (return_code is strictly generated later upon verified handover)
                    const pickupCode = existingBooking.pickup_code || crypto_1.default.randomInt(100000, 1000000).toString();
                    const updateRes = await client.query(`UPDATE bookings
             SET status = 'ACCEPTED',
                 pickup_code = $1,
                 return_code = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`, [pickupCode, existingBookingId]);
                    updatedBooking = updateRes.rows[0];
                    updatedProposal = {
                        ...proposal,
                        status: 'ACCEPTED',
                        accepted_at: new Date().toISOString(),
                    };
                    await client.query(`UPDATE messages SET proposal_data = $1 WHERE id = $2`, [JSON.stringify(updatedProposal), messageId]);
                    const totalPrice = updatedBooking.total_price || proposal.total_price || 0;
                    const priceDisplay = Number(totalPrice) === 0 ? 'Free' : `₹${totalPrice}`;
                    await client.query(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
             VALUES ($1, $2, $3, $4, 'SYSTEM')`, [
                        existingBookingId,
                        currentUserId,
                        message.sender_id,
                        `Request Accepted. Confirmed booking for "${itemTitle}" (${priceDisplay}). Handover is now live in Bookings.`,
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
                // Asynchronous non-blocking lifecycle notifications after transaction commits
                for (const conflicting of conflictingPendingList) {
                    (0, notifications_service_1.createNotification)({
                        userId: conflicting.borrower_id,
                        bookingId: conflicting.id,
                        referenceId: conflicting.id,
                        referenceType: 'BOOKING',
                        type: 'BOOKING_CANCELLED',
                        title: 'Request Auto-Cancelled',
                        body: `Your rental request was cancelled because the owner accepted another booking for those dates.`,
                    }).catch(() => { });
                }
                (0, notifications_service_1.createNotification)({
                    userId: message.sender_id,
                    senderId: currentUserId,
                    bookingId: existingBookingId,
                    referenceId: existingBookingId,
                    referenceType: 'BOOKING',
                    type: 'BOOKING_ACCEPTED',
                    title: 'Rental Request Accepted',
                    body: `Your request for "${itemTitle}" was accepted. Handover is now active in Bookings.`,
                }).catch(() => { });
                // Never expose pickup_code or return_code in proposal_data response
                const safeProposal = { ...updatedProposal };
                delete safeProposal.pickup_code;
                delete safeProposal.return_code;
                const safeBooking = { ...updatedBooking };
                delete safeBooking.pickup_code;
                delete safeBooking.return_code;
                return (0, response_1.sendSuccess)(res, {
                    booking: safeBooking,
                    message_id: messageId,
                    proposal_data: safeProposal,
                }, 'Rental request accepted');
            }
        }
        if (!existingBookingId) {
            if (!proposal.type && !proposal.title && !proposal.item_title) {
                return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This message is not a rental proposal or agreement offer.', 400);
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
        // Calculate end date
        const sDate = new Date(startDate);
        const eDate = new Date(sDate);
        eDate.setDate(sDate.getDate() + Math.max(0, durationDays - 1));
        const endDateStr = proposal.end_date || eDate.toISOString().split('T')[0];
        const tzOffset = typeof req.body?.timezone_offset_minutes === 'number'
            ? req.body.timezone_offset_minutes
            : (proposal.timezone_offset_minutes ?? -330);
        const startTimestamp = parseToUtcTimestamp(startDate, proposal.start_time || '10:00', tzOffset);
        if (startTimestamp < Date.now()) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This custom proposal cannot be accepted because its scheduled pickup time has already passed.', 400);
        }
        const client = await db_1.pool.connect();
        let createdItem;
        let createdBooking;
        let updatedProposal;
        const itemTitle = proposal.title || 'Personal Agreement Item';
        try {
            await client.query('BEGIN');
            // ATOMIC LOCK: Lock the message row to prevent concurrent race condition acceptances
            const msgLock = await client.query(`SELECT id, proposal_data, booking_id FROM messages WHERE id = $1 FOR UPDATE`, [messageId]);
            if (msgLock.rows.length === 0) {
                await client.query('ROLLBACK');
                return (0, response_1.sendError)(res, 'NOT_FOUND', 'Proposal message not found', 404);
            }
            const lockedMsg = msgLock.rows[0];
            const currentProposal = typeof lockedMsg.proposal_data === 'string'
                ? JSON.parse(lockedMsg.proposal_data)
                : (lockedMsg.proposal_data || {});
            if (lockedMsg.booking_id || currentProposal.status === 'ACCEPTED' || (currentProposal.status && currentProposal.status !== 'PENDING')) {
                await client.query('ROLLBACK');
                return (0, response_1.sendError)(res, 'CONFLICT', 'This proposal has already been accepted or processed.', 409);
            }
            // 1. If this proposal originated from a community request, atomically check and claim it:
            let reqRow = null;
            if (proposal.request_id) {
                const reqCheck = await client.query(`SELECT id, status, seeker_id, locality, address_text, will_pickup, will_drop_back FROM requests WHERE id = $1 FOR UPDATE`, [proposal.request_id]);
                if (reqCheck.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return (0, response_1.sendError)(res, 'NOT_FOUND', 'Community request for this offer not found', 404);
                }
                if (reqCheck.rows[0].status !== 'OPEN') {
                    await client.query('ROLLBACK');
                    return (0, response_1.sendError)(res, 'CONFLICT', 'This community request has already been fulfilled by another neighbor or cancelled.', 409);
                }
                reqRow = reqCheck.rows[0];
                // Mark request fulfilled atomically inside transaction
                await client.query(`UPDATE requests SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [proposal.request_id]);
                // Auto-cancel all other pending offer messages for this request
                await client.query(`UPDATE messages
           SET proposal_data = jsonb_set(proposal_data, '{status}', '"CANCELLED"')
           WHERE id != $1
             AND (proposal_data->>'request_id') = $2
             AND (proposal_data->>'status' = 'PENDING' OR (proposal_data->>'status') IS NULL)`, [messageId, proposal.request_id]);
            }
            // Determine correct meetup locations:
            // If lender delivers/collects, destination is borrower's address;
            // If borrower picks up/drops back, meetup is at lender's location.
            const borrowerAddress = reqRow?.address_text || reqRow?.locality || proposal.delivery_location || 'Handover location';
            const lenderAddress = lenderInfo.address_text || lenderInfo.locality || 'Lender location';
            const pickupLocality = proposal.delivery_option === 'LENDER_DELIVERY'
                ? borrowerAddress
                : lenderAddress;
            const returnLocality = proposal.collection_option === 'LENDER_COLLECT'
                ? borrowerAddress
                : lenderAddress;
            // 2. Create the item record for this custom listing (owned by lender)
            const itemRes = await client.query(`INSERT INTO items (
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
                lenderInfo.locality || proposal.locality || '',
                lenderInfo.address_text || lenderInfo.locality || '',
            ]);
            createdItem = itemRes.rows[0];
            // 3. Generate handover security code (6 digits) for pickup (return_code is strictly NULL at acceptance)
            const pickupCode = crypto_1.default.randomInt(100000, 1000000).toString();
            // 4. Create the booking with status 'ACCEPTED'
            const bookingRes = await client.query(`INSERT INTO bookings (
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
                pickupLocality,
                proposal.collection_option === 'LENDER_COLLECT' ? 'OWNER_COLLECT' : 'LENDER_LOCATION',
                returnLocality,
                !!proposal.delivery_fee && Number(proposal.delivery_fee) > 0,
                Number(proposal.delivery_fee) || 0,
                !!proposal.collection_fee && Number(proposal.collection_fee) > 0,
                Number(proposal.collection_fee) || 0,
                pickupCode,
            ]);
            createdBooking = bookingRes.rows[0];
            // 5. Update the proposal message
            updatedProposal = {
                ...proposal,
                status: 'ACCEPTED',
                booking_id: createdBooking.id,
                item_id: createdItem.id,
                accepted_at: new Date().toISOString(),
            };
            await client.query(`UPDATE messages 
         SET proposal_data = $1, booking_id = $2
         WHERE id = $3`, [JSON.stringify(updatedProposal), createdBooking.id, messageId]);
            // 6. Insert system confirmation message into the chat
            const cleanStartDate = String(startDate).split('T')[0];
            const cleanEndDate = String(endDateStr).split('T')[0];
            const priceDisplay = Number(totalPrice) === 0 ? 'Free' : `₹${totalPrice}`;
            await client.query(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
         VALUES ($1, $2, $3, $4, 'SYSTEM')`, [
                createdBooking.id,
                currentUserId,
                message.sender_id,
                `Agreement Accepted. Confirmed booking for "${itemTitle}" (${priceDisplay}) is scheduled from ${cleanStartDate} to ${cleanEndDate}. Active in Bookings.`,
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
        // 7. Send notifications to both lender and borrower about the ongoing booking
        await (0, notifications_service_1.createNotification)({
            userId: canonicalBorrowerId,
            senderId: canonicalLenderId,
            type: 'BOOKING_STARTED',
            title: `Booking Confirmed: ${itemTitle}`,
            body: 'Rental agreement confirmed. Handover is now live in your Ongoing Bookings.',
            referenceId: createdBooking.id,
            referenceType: 'BOOKING',
            bookingId: createdBooking.id,
        }).catch(() => { });
        await (0, notifications_service_1.createNotification)({
            userId: canonicalLenderId,
            senderId: canonicalBorrowerId,
            type: 'BOOKING_STARTED',
            title: `Booking Confirmed: ${itemTitle}`,
            body: 'Rental agreement confirmed. Handover is now live in your Ongoing Bookings.',
            referenceId: createdBooking.id,
            referenceType: 'BOOKING',
            bookingId: createdBooking.id,
        }).catch(() => { });
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
        if (message.message_type !== 'PROPOSAL') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This message is not a proposal.', 400);
        }
        if (!message.proposal_data && !message.booking_id) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This message is not a proposal or booking request.', 400);
        }
        const myIds = await (0, user_1.resolveUserIds)(currentUserId, req.user?.email);
        if (!myIds.includes(String(message.receiver_id)) && !myIds.includes(String(message.sender_id))) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied', 403);
        }
        const isReceiver = myIds.includes(String(message.receiver_id));
        const isSender = myIds.includes(String(message.sender_id));
        if (!isReceiver && !isSender) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied: You are not part of this proposal', 403);
        }
        const proposal = safeParseJson(message.proposal_data);
        if (proposal.status && proposal.status !== 'PENDING') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', `This proposal has already been ${proposal.status.toLowerCase()}.`, 400);
        }
        const existingBookingId = message.booking_id || proposal.booking_id;
        if (existingBookingId && isUuid(existingBookingId)) {
            const bRes = await (0, db_1.query)(`SELECT id, status FROM bookings WHERE id = $1`, [existingBookingId]);
            if (bRes.rows.length > 0) {
                const currentBookingStatus = bRes.rows[0].status;
                if (currentBookingStatus !== 'PENDING') {
                    return (0, response_1.sendError)(res, 'BAD_REQUEST', `Cannot decline: booking is currently in "${currentBookingStatus}" state and can no longer be rejected or cancelled through this proposal.`, 400);
                }
            }
        }
        const targetProposalStatus = isReceiver ? 'DECLINED' : 'CANCELLED';
        const targetBookingStatus = isReceiver ? 'REJECTED' : 'CANCELLED';
        const updatedProposal = { ...proposal, status: targetProposalStatus };
        await (0, db_1.query)(`UPDATE messages SET proposal_data = $1 WHERE id = $2`, [JSON.stringify(updatedProposal), messageId]);
        if (existingBookingId && isUuid(existingBookingId)) {
            await (0, db_1.query)(`UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = 'PENDING'`, [targetBookingStatus, existingBookingId]).catch(() => { });
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
            await (0, notifications_service_1.createNotification)({
                userId: notificationRecipientId,
                senderId: currentUserId,
                type: isReceiver ? 'BOOKING_REJECTED' : 'BOOKING_CANCELLED',
                title: isReceiver ? 'Rental Request Declined' : 'Rental Request Cancelled',
                body: `Your request for "${itemTitle}" ${statusActionText}.`,
                referenceId: existingBookingId,
                referenceType: 'BOOKING',
                bookingId: existingBookingId,
            }).catch(() => { });
        }
        return (0, response_1.sendSuccess)(res, { proposal_data: updatedProposal }, `Proposal ${targetProposalStatus.toLowerCase()}`);
    }
    catch (error) {
        next(error);
    }
});
// 6. Delete entire conversation with someone (Soft-deletes for the calling user only)
router.delete('/conversations/:conversationId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const myIds = await (0, user_1.resolveUserIds)(userId, req.user?.email);
        const isDm = conversationId.startsWith('dm_') || !isUuid(conversationId);
        const rawPartnerId = isDm ? conversationId.replace(/^dm_/, '') : null;
        if (isDm && rawPartnerId) {
            const pIds = await (0, user_1.resolveUserIds)(rawPartnerId);
            const canonicalPartnerId = pIds[0] || rawPartnerId;
            // Track per-user conversation deletion timestamp
            for (const mId of myIds) {
                await (0, db_1.query)(`INSERT INTO user_deleted_conversations (user_id, partner_id, deleted_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, partner_id) DO UPDATE SET deleted_at = CURRENT_TIMESTAMP`, [mId, canonicalPartnerId]).catch(() => { });
            }
            // Soft delete for the calling user only (keeps history intact for partner)
            await (0, db_1.query)(`UPDATE messages
         SET deleted_by = ARRAY(
           SELECT DISTINCT unnest(COALESCE(deleted_by, '{}'::text[]) || $1::text[])
         )
         WHERE (sender_id = ANY($1::text[]) AND receiver_id = ANY($2::text[]))
            OR (sender_id = ANY($2::text[]) AND receiver_id = ANY($1::text[]))`, [myIds, pIds]);
            return (0, response_1.sendSuccess)(res, { conversation_id: conversationId }, 'Chat deleted for you');
        }
        // For a booking conversation: verify that the caller is an authorized participant!
        const bookingRes = await (0, db_1.query)(`SELECT b.id, b.borrower_id, b.lender_id, i.owner_id AS item_owner_id
       FROM bookings b
       LEFT JOIN items i ON b.item_id = i.id
       WHERE b.id = $1`, [conversationId]);
        if (bookingRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Booking not found', 404);
        }
        const b = bookingRes.rows[0];
        const isParticipant = myIds.includes(String(b.borrower_id)) ||
            myIds.includes(String(b.lender_id)) ||
            myIds.includes(String(b.item_owner_id)) ||
            req.user.role === 'ADMIN';
        if (!isParticipant) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied: You are not a participant in this booking chat.', 403);
        }
        const partnerId = myIds.includes(String(b.borrower_id)) ? (b.item_owner_id || b.lender_id) : b.borrower_id;
        for (const mId of myIds) {
            await (0, db_1.query)(`INSERT INTO user_deleted_conversations (user_id, partner_id, deleted_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, partner_id) DO UPDATE SET deleted_at = CURRENT_TIMESTAMP`, [mId, String(partnerId)]).catch(() => { });
        }
        // Soft delete for the calling user only
        await (0, db_1.query)(`UPDATE messages
       SET deleted_by = ARRAY(
         SELECT DISTINCT unnest(COALESCE(deleted_by, '{}'::text[]) || $1::text[])
       )
       WHERE booking_id::text = $2`, [myIds, conversationId]);
        return (0, response_1.sendSuccess)(res, { conversation_id: conversationId }, 'Chat cleared for you');
    }
    catch (error) {
        next(error);
    }
});
// 6.1 Mute or Unmute a Conversation
router.post('/conversations/:partnerId/mute', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { partnerId } = req.params;
        const userId = req.user.id;
        const { muted = true } = req.body;
        const myIds = await (0, user_1.resolveUserIds)(userId, req.user?.email);
        const isDm = partnerId.startsWith('dm_') || !isUuid(partnerId);
        const rawPartnerId = isDm ? partnerId.replace(/^dm_/, '') : partnerId;
        const pIds = await (0, user_1.resolveUserIds)(rawPartnerId);
        const canonicalPartnerId = pIds[0] || rawPartnerId;
        if (muted) {
            for (const mId of myIds) {
                await (0, db_1.query)(`INSERT INTO user_muted_conversations (user_id, partner_id, created_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, partner_id) DO NOTHING`, [mId, canonicalPartnerId]).catch(() => { });
            }
        }
        else {
            for (const mId of myIds) {
                await (0, db_1.query)(`DELETE FROM user_muted_conversations
           WHERE user_id = $1 AND partner_id = ANY($2::text[])`, [mId, pIds]).catch(() => { });
            }
        }
        return (0, response_1.sendSuccess)(res, { partner_id: canonicalPartnerId, is_muted: Boolean(muted) }, muted ? 'Conversation muted' : 'Conversation unmuted');
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
// 8. Delete an individual message (Soft-deletes for the caller)
router.delete('/:messageId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        const myIds = await (0, user_1.resolveUserIds)(userId, req.user?.email);
        const checkRes = await (0, db_1.query)(`SELECT * FROM messages WHERE id::text = $1`, [messageId]);
        if (checkRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Message not found', 404);
        }
        const msg = checkRes.rows[0];
        const isSender = myIds.includes(String(msg.sender_id));
        const isReceiver = myIds.includes(String(msg.receiver_id));
        const isAdmin = req.user.role === 'ADMIN';
        if (!isSender && !isReceiver && !isAdmin) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied: You cannot delete this message', 403);
        }
        // Soft delete for the calling user only
        await (0, db_1.query)(`UPDATE messages
       SET deleted_by = ARRAY(
         SELECT DISTINCT unnest(COALESCE(deleted_by, '{}'::text[]) || $1::text[])
       )
       WHERE id::text = $2`, [myIds, messageId]);
        return (0, response_1.sendSuccess)(res, { id: messageId }, 'Message deleted for you');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
