"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
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
// 1. Get User's Active Conversations (Both Bookings & Direct DMs)
router.get('/conversations', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Get bookings & direct messages (excluding blocked relationships)
        const result = await (0, db_1.query)(`WITH me AS (
        SELECT id::text AS id_text, firebase_uid FROM users WHERE id::text = $1::text OR firebase_uid = $1::text LIMIT 1
      ),
      user_convs AS (
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
          CASE 
            WHEN b.borrower_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) 
            THEN COALESCE(lender.id::text, b.lender_id) 
            ELSE borrower.id::text 
          END AS partner_id,
          CASE 
            WHEN b.borrower_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) 
            THEN COALESCE(lender.name, 'Lender') 
            ELSE COALESCE(borrower.name, 'Borrower') 
          END AS partner_name,
          CASE 
            WHEN b.borrower_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) 
            THEN lender.avatar_url 
            ELSE borrower.avatar_url 
          END AS partner_avatar,
          CASE 
            WHEN b.borrower_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) 
            THEN lender.phone 
            ELSE borrower.phone 
          END AS partner_phone,
          m.content AS last_message,
          m.created_at AS last_message_at,
          b.created_at AS created_at
        FROM bookings b
        JOIN items i ON b.item_id = i.id
        LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
        LEFT JOIN users lender ON (b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid OR i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid)
        LEFT JOIN LATERAL (
          SELECT content, created_at FROM messages 
          WHERE booking_id = b.id 
          ORDER BY created_at DESC LIMIT 1
        ) m ON true
        WHERE (
          b.borrower_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) OR 
          b.lender_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) OR 
          i.owner_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)
        )

        UNION ALL

        -- 2. Direct DM conversations (matching by ID and Firebase UID)
        SELECT
          'dm_' || partner.id::text AS conversation_id,
          NULL::uuid AS booking_id,
          'DIRECT_DM' AS booking_status,
          NULL::date AS start_date,
          NULL::integer AS duration_days,
          0 AS total_price,
          'Direct Chat' AS item_title,
          ARRAY[]::text[] AS item_images,
          partner.locality AS item_locality,
          partner.id::text AS partner_id,
          partner.name AS partner_name,
          partner.avatar_url AS partner_avatar,
          partner.phone AS partner_phone,
          dm.content AS last_message,
          dm.created_at AS last_message_at,
          dm.created_at AS created_at
        FROM (
          SELECT DISTINCT ON (
            CASE 
              WHEN sender_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) 
              THEN receiver_id 
              ELSE sender_id 
            END
          )
            id,
            CASE 
              WHEN sender_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) 
              THEN receiver_id 
              ELSE sender_id 
            END AS partner_id,
            content,
            created_at
          FROM messages
          WHERE (
            sender_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)
            OR receiver_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)
          )
          ORDER BY (
            CASE 
              WHEN sender_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL) 
              THEN receiver_id 
              ELSE sender_id 
            END
          ), created_at DESC
        ) dm
        JOIN users partner ON (dm.partner_id = partner.id::text OR dm.partner_id = partner.firebase_uid)
        WHERE partner.id::text NOT IN (SELECT id_text FROM me)
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = ANY(ARRAY(SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)) AND (ub.blocked_id = partner.id::text OR ub.blocked_id = partner.firebase_uid))
               OR (ub.blocked_id = ANY(ARRAY(SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)) AND (ub.blocker_id = partner.id::text OR ub.blocker_id = partner.firebase_uid))
          )
      )
      SELECT * FROM user_convs
      ORDER BY COALESCE(last_message_at, created_at) DESC`, [userId]);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// 2. Get Messages for a Booking OR a Direct Message (DM)
router.get('/:conversationId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const isDm = conversationId.startsWith('dm_') || !isUuid(conversationId);
        const rawPartnerId = isDm ? conversationId.replace(/^dm_/, '') : null;
        if (isDm && rawPartnerId) {
            // Find my IDs and partner IDs
            const meRes = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
            const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean);
            const pRes = await (0, db_1.query)(`SELECT id::text, name, avatar_url, locality, phone, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [rawPartnerId]);
            const partnerData = pRes.rows[0] || {
                id: rawPartnerId,
                name: 'Community Member',
                avatar_url: null,
                locality: 'Bengaluru',
            };
            const pIds = [rawPartnerId, partnerData.id, partnerData.firebase_uid].filter(Boolean);
            // Check block
            const blockCheck = await (0, db_1.query)(`SELECT 1 FROM user_blocks 
         WHERE (blocker_id = ANY($1::text[]) AND blocked_id = ANY($2::text[]))
            OR (blocker_id = ANY($2::text[]) AND blocked_id = ANY($1::text[]))`, [myIds, pIds]);
            if (blockCheck.rows.length > 0) {
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'Communication with this user is blocked.', 403);
            }
            // Fetch direct messages between them
            const messagesRes = await (0, db_1.query)(`SELECT 
          m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.message_type, m.proposal_data, m.is_edited, m.created_at,
          COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
         FROM messages m
         LEFT JOIN users u ON (m.sender_id = u.id::text OR m.sender_id = u.firebase_uid)
         WHERE (
           (m.sender_id = ANY($1::text[]) AND m.receiver_id = ANY($2::text[]))
           OR (m.sender_id = ANY($2::text[]) AND m.receiver_id = ANY($1::text[]))
         )
         ORDER BY m.created_at ASC`, [myIds, pIds]);
            return (0, response_1.sendSuccess)(res, {
                booking: null,
                partner: partnerData,
                messages: messagesRes.rows,
            });
        }
        // Otherwise, check booking by UUID
        const bookingRes = await (0, db_1.query)(`SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id::text = $1 AND (b.borrower_id = $2 OR b.lender_id = $2 OR i.owner_id = $2)`, [conversationId, userId]);
        if (bookingRes.rows.length === 0) {
            // Check if conversationId was a user ID formatted as UUID
            const userRes = await (0, db_1.query)(`SELECT id::text, name, avatar_url, locality, phone, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [conversationId]);
            if (userRes.rows.length > 0) {
                const partner = userRes.rows[0];
                const meRes = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
                const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean);
                const pIds = [conversationId, partner.id, partner.firebase_uid].filter(Boolean);
                const messagesRes = await (0, db_1.query)(`SELECT 
            m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.message_type, m.proposal_data, m.is_edited, m.created_at,
            COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
           FROM messages m
           LEFT JOIN users u ON (m.sender_id = u.id::text OR m.sender_id = u.firebase_uid)
           WHERE (
             (m.sender_id = ANY($1::text[]) AND m.receiver_id = ANY($2::text[]))
             OR (m.sender_id = ANY($2::text[]) AND m.receiver_id = ANY($1::text[]))
           )
           ORDER BY m.created_at ASC`, [myIds, pIds]);
                return (0, response_1.sendSuccess)(res, {
                    booking: null,
                    partner,
                    messages: messagesRes.rows,
                });
            }
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Conversation not found or access denied', 404);
        }
        const messagesRes = await (0, db_1.query)(`SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.message_type, m.proposal_data, m.is_edited, m.created_at,
        COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       LEFT JOIN users u ON (m.sender_id = u.id::text OR m.sender_id = u.firebase_uid)
       WHERE m.booking_id::text = $1
       ORDER BY m.created_at ASC`, [conversationId]);
        return (0, response_1.sendSuccess)(res, {
            booking: bookingRes.rows[0],
            messages: messagesRes.rows,
        });
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
        const result = await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type, proposal_data)
       VALUES ($1, $2, $3, $4, $5, $6)
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
        if (message.receiver_id !== currentUserId) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the intended recipient can accept this agreement', 403);
        }
        const proposal = typeof message.proposal_data === 'string'
            ? JSON.parse(message.proposal_data)
            : (message.proposal_data || {});
        if (proposal.status === 'ACCEPTED') {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'This agreement has already been accepted', 400);
        }
        // Determine lender and borrower based on proposal type:
        // If proposal was created as LISTING: creator is lender, recipient is borrower.
        // If proposal was created as REQUEST: creator is borrower, recipient is lender.
        const isOffer = proposal.type === 'LISTING';
        const lenderId = isOffer ? message.sender_id : currentUserId;
        const borrowerId = isOffer ? currentUserId : message.sender_id;
        // Fetch lender details for locality
        const lenderUserRes = await (0, db_1.query)(`SELECT locality, address_text FROM users WHERE id = $1`, [lenderId]);
        const lenderInfo = lenderUserRes.rows[0] || {};
        const startDate = proposal.start_date || new Date().toISOString().split('T')[0];
        const durationDays = Math.max(1, Number(proposal.duration_days) || 1);
        const pricePerDay = Number(proposal.price_per_day) || (Number(proposal.total_price) / durationDays) || 0;
        const totalPrice = Number(proposal.total_price) || (pricePerDay * durationDays);
        // 1. Create the item record for this custom listing so it shows in My Listings, reviews, calendar
        const itemTitle = proposal.title || 'Personal Agreement Item';
        const itemRes = await (0, db_1.query)(`INSERT INTO items (
        owner_id, title, description, category, price_per_day, max_duration_days, 
        image_urls, locality, address_text, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'RENTED')
      RETURNING *`, [
            lenderId,
            itemTitle,
            proposal.description || proposal.notes || `Personal custom agreement via Rentu DM`,
            proposal.category || 'Other',
            pricePerDay,
            Math.max(durationDays, 3),
            proposal.image_url ? JSON.stringify([proposal.image_url]) : JSON.stringify([]),
            lenderInfo.locality || 'Bangalore',
            lenderInfo.address_text || 'Local pickup',
        ]);
        const createdItem = itemRes.rows[0];
        // Calculate end date
        const sDate = new Date(startDate);
        const eDate = new Date(sDate);
        eDate.setDate(sDate.getDate() + durationDays);
        const endDateStr = proposal.end_date || eDate.toISOString().split('T')[0];
        // 2. Generate handover security codes (6 digits)
        const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
        const returnCode = Math.floor(100000 + Math.random() * 900000).toString();
        // 3. Create the booking with status 'ACCEPTED'
        const bookingRes = await (0, db_1.query)(`INSERT INTO bookings (
        item_id, borrower_id, lender_id, start_date, duration_days, total_price,
        status, message, end_date, start_time, end_time, pickup_type, pickup_locality,
        return_type, return_locality, requires_delivery, delivery_fee, requires_pickup, pickup_fee,
        pickup_code, return_code
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACCEPTED', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`, [
            createdItem.id,
            borrowerId,
            lenderId,
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
            returnCode,
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
        await (0, db_1.query)(`INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'SYSTEM')`, [
            createdBooking.id,
            currentUserId,
            message.sender_id,
            `🎉 Agreement Accepted! Confirmed booking for "${itemTitle}" (₹${totalPrice}) is scheduled from ${startDate} to ${endDateStr}. Active in Bookings & Handoffs!`,
        ]);
        return (0, response_1.sendSuccess)(res, {
            booking: createdBooking,
            item: createdItem,
            message_id: messageId,
            proposal_data: updatedProposal,
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
        if (message.receiver_id !== currentUserId && message.sender_id !== currentUserId) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access denied', 403);
        }
        const proposal = typeof message.proposal_data === 'string'
            ? JSON.parse(message.proposal_data)
            : (message.proposal_data || {});
        const updatedProposal = { ...proposal, status: 'DECLINED' };
        await (0, db_1.query)(`UPDATE messages SET proposal_data = $1 WHERE id = $2`, [JSON.stringify(updatedProposal), messageId]);
        return (0, response_1.sendSuccess)(res, { proposal_data: updatedProposal }, 'Proposal declined');
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
// 7. Edit an individual message
router.put('/:messageId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        if (!content || !content.trim()) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'Message content cannot be empty', 400);
        }
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
        const result = await (0, db_1.query)(`UPDATE messages SET content = $1, is_edited = true WHERE id::text = $2 RETURNING *`, [content.trim(), messageId]);
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
