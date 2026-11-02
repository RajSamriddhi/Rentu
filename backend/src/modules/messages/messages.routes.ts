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
  message_type: z.string().optional(),
  proposal_data: z.any().optional(),
});

const isUuid = (val: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// 1. Get User's Active Conversations (Unified per Person)
router.get('/conversations', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    // Mark pending incoming messages as delivered to this user
    await query(
      `WITH me AS (
        SELECT id::text AS id_text, firebase_uid FROM users WHERE id::text = $1::text OR firebase_uid = $1::text LIMIT 1
      )
      UPDATE messages
      SET is_delivered = true,
          delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
      WHERE (is_delivered = false OR is_delivered IS NULL)
        AND receiver_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)`,
      [userId]
    ).catch(() => {});

    // Get consolidated conversations: exactly ONE thread per partner user
    const result = await query(
      `WITH me AS (
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
      ORDER BY COALESCE(latest_msg.created_at, dp.latest_interaction) DESC`,
      [userId]
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// 2. Get Messages for a User (Unified Thread between Me and Partner)
router.get('/:conversationId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.id;

    // Resolve my IDs
    const meRes = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
    const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean) as string[];

    let rawPartnerId: string | null = null;
    let fallbackBooking: any = null;

    if (conversationId.startsWith('dm_')) {
      rawPartnerId = conversationId.replace(/^dm_/, '');
    } else {
      // Check if conversationId is a direct user ID
      const userCheck = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [conversationId]);
      if (userCheck.rows.length > 0) {
        rawPartnerId = userCheck.rows[0].id;
      } else if (isUuid(conversationId)) {
        // Check if conversationId is a booking ID
        const bookingCheck = await query(
          `SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day, i.owner_id AS item_owner_id
           FROM bookings b
           JOIN items i ON b.item_id = i.id
           WHERE b.id::text = $1`,
          [conversationId]
        );
        if (bookingCheck.rows.length > 0) {
          const b = bookingCheck.rows[0];
          fallbackBooking = b;
          const isBorrower = myIds.includes(b.borrower_id);
          rawPartnerId = isBorrower ? (b.lender_id || b.item_owner_id) : b.borrower_id;
        }
      }
    }

    if (!rawPartnerId) {
      return sendError(res, 'NOT_FOUND', 'Conversation partner not found', 404);
    }

    // Fetch partner user data
    const pRes = await query(
      `SELECT id::text, name, username, avatar_url, locality, phone, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`,
      [rawPartnerId]
    );
    const partnerData = pRes.rows[0] || {
      id: rawPartnerId,
      name: 'Community Member',
      avatar_url: null,
      locality: 'Bengaluru',
    };
    const pIds = [rawPartnerId, partnerData.id, partnerData.firebase_uid].filter(Boolean) as string[];

    // Block check
    const blockCheck = await query(
      `SELECT 1 FROM user_blocks 
       WHERE (blocker_id = ANY($1::text[]) AND blocked_id = ANY($2::text[]))
          OR (blocker_id = ANY($2::text[]) AND blocked_id = ANY($1::text[]))`,
      [myIds, pIds]
    );
    if (blockCheck.rows.length > 0) {
      return sendError(res, 'FORBIDDEN', 'Communication with this user is blocked.', 403);
    }

    // Mark unread messages sent to me by partner as READ & DELIVERED
    await query(
      `UPDATE messages
       SET is_read = true,
           read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
           is_delivered = true,
           delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
       WHERE (is_read = false OR is_read IS NULL)
         AND receiver_id = ANY($1::text[])
         AND sender_id = ANY($2::text[])`,
      [myIds, pIds]
    ).catch(() => {});

    // Fetch unified messages between current user and this partner
    const messagesRes = await query(
      `SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.message_type, m.proposal_data, m.is_edited,
        COALESCE(m.is_delivered, false) AS is_delivered, m.delivered_at,
        COALESCE(m.is_read, false) AS is_read, m.read_at,
        m.created_at,
        COALESCE(u.name, 'Member') AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       LEFT JOIN users u ON (m.sender_id = u.id::text OR m.sender_id = u.firebase_uid)
       WHERE (
         (m.sender_id = ANY($1::text[]) AND m.receiver_id = ANY($2::text[]))
         OR (m.sender_id = ANY($2::text[]) AND m.receiver_id = ANY($1::text[]))
         OR (m.booking_id IN (
           SELECT b_sub.id FROM bookings b_sub 
           WHERE ((b_sub.borrower_id = ANY($1::text[]) AND (b_sub.lender_id = ANY($2::text[]) OR b_sub.lender_id IS NULL))
               OR (b_sub.borrower_id = ANY($2::text[]) AND (b_sub.lender_id = ANY($1::text[]) OR b_sub.lender_id IS NULL)))
         ))
       )
       ORDER BY m.created_at ASC`,
      [myIds, pIds]
    );

    // Fetch latest active booking between them
    const latestBookingRes = await query(
      `SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE (
         (b.borrower_id = ANY($1::text[]) AND (b.lender_id = ANY($2::text[]) OR i.owner_id = ANY($2::text[])))
         OR (b.borrower_id = ANY($2::text[]) AND (b.lender_id = ANY($1::text[]) OR i.owner_id = ANY($1::text[])))
       )
       ORDER BY b.created_at DESC
       LIMIT 1`,
      [myIds, pIds]
    );

    const activeBooking = latestBookingRes.rows[0] || fallbackBooking || null;

    return sendSuccess(res, {
      booking: activeBooking,
      partner: partnerData,
      messages: messagesRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

// 2.1 Mark Conversation Messages as Read Explicitly
router.post('/:conversationId/read', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.id;
    const isDm = conversationId.startsWith('dm_') || !isUuid(conversationId);
    let rawPartnerId = isDm ? conversationId.replace(/^dm_/, '') : null;

    const meRes = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
    const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean) as string[];

    if (!rawPartnerId && isUuid(conversationId)) {
      const bRes = await query(`SELECT borrower_id, lender_id FROM bookings WHERE id = $1`, [conversationId]);
      if (bRes.rows.length > 0) {
        const b = bRes.rows[0];
        rawPartnerId = myIds.includes(b.borrower_id) ? b.lender_id : b.borrower_id;
      }
    }

    if (rawPartnerId) {
      const pRes = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [rawPartnerId]);
      const pIds = [rawPartnerId, pRes.rows[0]?.id, pRes.rows[0]?.firebase_uid].filter(Boolean) as string[];

      await query(
        `UPDATE messages
         SET is_read = true,
             read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
             is_delivered = true,
             delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
         WHERE (is_read = false OR is_read IS NULL)
           AND receiver_id = ANY($1::text[])
           AND sender_id = ANY($2::text[])`,
        [myIds, pIds]
      );
    }
    return sendSuccess(res, { marked_read: true });
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
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type, proposal_data, is_delivered, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, false, false)
       RETURNING *`,
      [
        targetBookingId,
        senderId,
        targetReceiverId,
        validated.content,
        validated.message_type || 'TEXT',
        validated.proposal_data ? JSON.stringify(validated.proposal_data) : null,
      ]
    );

    const inserted = result.rows[0];

    return sendSuccess(res, {
      ...inserted,
      is_delivered: false,
      is_read: false,
      sender_name: req.user!.name || 'You',
      sender_avatar: (req.user as any)?.avatar_url || null,
    }, 'Message sent');
  } catch (error) {
    next(error);
  }
});

// 4. Accept a Personal Listing / Request Proposal
router.post('/proposal/:messageId/accept', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user!.id;

    // Fetch the proposal message
    const msgRes = await query(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );
    if (msgRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Proposal message not found', 404);
    }

    const message = msgRes.rows[0];
    if (message.receiver_id !== currentUserId) {
      return sendError(res, 'FORBIDDEN', 'Only the intended recipient can accept this agreement', 403);
    }

    const proposal = typeof message.proposal_data === 'string'
      ? JSON.parse(message.proposal_data)
      : (message.proposal_data || {});

    if (proposal.status === 'ACCEPTED') {
      return sendError(res, 'BAD_REQUEST', 'This agreement has already been accepted', 400);
    }

    const existingBookingId = message.booking_id || proposal.booking_id;
    if (existingBookingId && isUuid(existingBookingId)) {
      // Handle acceptance for a standard listing rental booking request
      const bRes = await query(
        `SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.owner_id AS item_owner_id,
                TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date_str,
                TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date_str
         FROM bookings b
         JOIN items i ON b.item_id = i.id
         WHERE b.id = $1`,
        [existingBookingId]
      );

      if (bRes.rows.length > 0) {
        const existingBooking = bRes.rows[0];
        const pickupCode = existingBooking.pickup_code || Math.floor(100000 + Math.random() * 900000).toString();
        const returnCode = existingBooking.return_code || Math.floor(100000 + Math.random() * 900000).toString();

        const updateRes = await query(
          `UPDATE bookings
           SET status = 'ACCEPTED',
               pickup_code = $1,
               return_code = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [pickupCode, returnCode, existingBookingId]
        );
        const updatedBooking = updateRes.rows[0];

        const updatedProposal = {
          ...proposal,
          status: 'ACCEPTED',
          pickup_code: pickupCode,
          return_code: returnCode,
          accepted_at: new Date().toISOString(),
        };

        await query(
          `UPDATE messages SET proposal_data = $1 WHERE id = $2`,
          [JSON.stringify(updatedProposal), messageId]
        );

        const itemTitle = existingBooking.item_title || proposal.item_title || 'Item';
        const totalPrice = updatedBooking.total_price || proposal.total_price || 0;

        await query(
          `INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
           VALUES ($1, $2, $3, $4, 'SYSTEM')`,
          [
            existingBookingId,
            currentUserId,
            message.sender_id,
            `Request Accepted. Confirmed booking for "${itemTitle}" (₹${totalPrice}). Pickup Verification Code: ${pickupCode}. Handover is now live in Bookings.`,
          ]
        );

        await query(
          `INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
           VALUES ($1, $2, 'BOOKING_ACCEPTED', 'Rental Request Accepted', 'Your request for "' || $3 || '" was accepted. Handover is now active in Bookings.', $4, 'BOOKING')`,
          [message.sender_id, currentUserId, itemTitle, existingBookingId]
        ).catch(() => {});

        return sendSuccess(res, {
          booking: updatedBooking,
          message_id: messageId,
          proposal_data: updatedProposal,
        }, 'Rental request accepted');
      }
    }

    // Determine lender and borrower based on proposal type for custom deals:
    // If proposal was created as LISTING or is a lend offer from owner: creator/lender is message.sender_id, recipient is borrower.
    // If proposal was created as REQUEST: creator is borrower, recipient is lender.
    const isOffer = proposal.type === 'LISTING' || proposal.is_lend_offer === true;
    const lenderId = isOffer ? message.sender_id : currentUserId;
    const borrowerId = isOffer ? currentUserId : message.sender_id;

    // Fetch lender details for locality
    const lenderUserRes = await query(`SELECT locality, address_text FROM users WHERE id = $1`, [lenderId]);
    const lenderInfo = lenderUserRes.rows[0] || {};

    const startDate = proposal.start_date || new Date().toISOString().split('T')[0];
    const durationDays = Math.max(1, Number(proposal.duration_days) || 1);
    const pricePerDay = Number(proposal.price_per_day) || (Number(proposal.total_price) / durationDays) || 0;
    const totalPrice = Number(proposal.total_price) || (pricePerDay * durationDays);

    // 1. Create the item record for this custom listing so it shows in My Listings, reviews, calendar
    const itemTitle = proposal.title || 'Personal Agreement Item';
    const itemRes = await query(
      `INSERT INTO items (
        owner_id, title, description, category, price_per_day, max_duration_days, 
        image_urls, locality, address_text, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'AVAILABLE')
      RETURNING *`,
      [
        lenderId,
        itemTitle,
        proposal.description || proposal.notes || `Personal custom agreement via Rentu DM`,
        proposal.category || 'Other',
        pricePerDay,
        Math.max(durationDays, 3),
        proposal.image_url ? JSON.stringify([proposal.image_url]) : JSON.stringify([]),
        proposal.locality || lenderInfo.locality || 'Bangalore',
        proposal.address_text || proposal.delivery_location || lenderInfo.address_text || 'Local pickup',
      ]
    );
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
    const bookingRes = await query(
      `INSERT INTO bookings (
        item_id, borrower_id, lender_id, start_date, duration_days, total_price,
        status, message, end_date, start_time, end_time, pickup_type, pickup_locality,
        return_type, return_locality, requires_delivery, delivery_fee, requires_pickup, pickup_fee,
        pickup_code, return_code
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACCEPTED', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
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
      ]
    );
    const createdBooking = bookingRes.rows[0];

    // 4. Update the proposal message
    const updatedProposal = {
      ...proposal,
      status: 'ACCEPTED',
      booking_id: createdBooking.id,
      item_id: createdItem.id,
      pickup_code: pickupCode,
      return_code: returnCode,
      accepted_at: new Date().toISOString(),
    };

    await query(
      `UPDATE messages 
       SET proposal_data = $1, booking_id = $2
       WHERE id = $3`,
      [JSON.stringify(updatedProposal), createdBooking.id, messageId]
    );

    // 5. Insert system confirmation message into the chat
    await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
       VALUES ($1, $2, $3, $4, 'SYSTEM')`,
      [
        createdBooking.id,
        currentUserId,
        message.sender_id,
        `Agreement Accepted. Confirmed booking for "${itemTitle}" (₹${totalPrice}) is scheduled from ${startDate} to ${endDateStr}. Active in Bookings.`,
      ]
    );

    // 6. If this proposal originated from a community request, mark that request as FULFILLED
    if (proposal.request_id) {
      await query(
        `UPDATE requests SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [proposal.request_id]
      ).catch(() => {});
    }

    // 7. Send notifications to both lender and borrower about the ongoing booking
    await query(
      `INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
       VALUES ($1, $2, 'BOOKING_STARTED', 'Booking Confirmed: ' || $3, 'Rental agreement confirmed. Handover is now live in your Ongoing Bookings.', $4, 'BOOKING')`,
      [message.sender_id, currentUserId, itemTitle, createdBooking.id]
    ).catch(() => {});

    await query(
      `INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
       VALUES ($1, $2, 'BOOKING_STARTED', 'Booking Confirmed: ' || $3, 'Rental agreement confirmed. Handover is now live in your Ongoing Bookings.', $4, 'BOOKING')`,
      [currentUserId, message.sender_id, itemTitle, createdBooking.id]
    ).catch(() => {});

    return sendSuccess(res, {
      booking: createdBooking,
      item: createdItem,
      message_id: messageId,
      proposal_data: updatedProposal,
    }, 'Agreement accepted and booking created');
  } catch (error) {
    next(error);
  }
});

// 5. Decline a Personal Listing / Request Proposal
router.post('/proposal/:messageId/decline', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user!.id;

    const msgRes = await query(`SELECT * FROM messages WHERE id = $1`, [messageId]);
    if (msgRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Proposal message not found', 404);
    }
    const message = msgRes.rows[0];
    if (message.receiver_id !== currentUserId && message.sender_id !== currentUserId) {
      return sendError(res, 'FORBIDDEN', 'Access denied', 403);
    }

    const proposal = typeof message.proposal_data === 'string'
      ? JSON.parse(message.proposal_data)
      : (message.proposal_data || {});

    const updatedProposal = { ...proposal, status: 'DECLINED' };
    await query(`UPDATE messages SET proposal_data = $1 WHERE id = $2`, [JSON.stringify(updatedProposal), messageId]);

    const existingBookingId = message.booking_id || proposal.booking_id;
    if (existingBookingId && isUuid(existingBookingId)) {
      await query(
        `UPDATE bookings SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [existingBookingId]
      ).catch(() => {});

      const itemTitle = proposal.item_title || proposal.title || 'Item';
      await query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content, message_type)
         VALUES ($1, $2, $3, $4, 'SYSTEM')`,
        [
          existingBookingId,
          currentUserId,
          message.sender_id,
          `Rental request for "${itemTitle}" was declined.`,
        ]
      ).catch(() => {});

      await query(
        `INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
         VALUES ($1, $2, 'BOOKING_REJECTED', 'Rental Request Declined', 'Your request for "' || $3 || '" was declined.', $4, 'BOOKING')`,
        [message.sender_id, currentUserId, itemTitle, existingBookingId]
      ).catch(() => {});
    }

    return sendSuccess(res, { proposal_data: updatedProposal }, 'Proposal declined');
  } catch (error) {
    next(error);
  }
});

// 6. Delete entire conversation with someone
router.delete('/conversations/:conversationId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.id;

    const isDm = conversationId.startsWith('dm_') || !isUuid(conversationId);
    const rawPartnerId = isDm ? conversationId.replace(/^dm_/, '') : null;

    if (isDm && rawPartnerId) {
      // Find all IDs for me and partner
      const meRes = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
      const myIds = [userId, meRes.rows[0]?.id, meRes.rows[0]?.firebase_uid].filter(Boolean);

      const pRes = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [rawPartnerId]);
      const pIds = [rawPartnerId, pRes.rows[0]?.id, pRes.rows[0]?.firebase_uid].filter(Boolean);

      await query(
        `DELETE FROM messages
         WHERE (sender_id = ANY($1::text[]) AND receiver_id = ANY($2::text[]))
            OR (sender_id = ANY($2::text[]) AND receiver_id = ANY($1::text[]))`,
        [myIds, pIds]
      );
      return sendSuccess(res, { conversation_id: conversationId }, 'Chat deleted successfully');
    }

    // If it's a booking conversation, delete all messages for this booking
    await query(
      `DELETE FROM messages WHERE booking_id::text = $1`,
      [conversationId]
    );

    return sendSuccess(res, { conversation_id: conversationId }, 'Chat cleared');
  } catch (error) {
    next(error);
  }
});

// 7. Edit an individual message
router.put('/:messageId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content || !content.trim()) {
      return sendError(res, 'BAD_REQUEST', 'Message content cannot be empty', 400);
    }

    const checkRes = await query(`SELECT * FROM messages WHERE id::text = $1`, [messageId]);
    if (checkRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Message not found', 404);
    }

    const msg = checkRes.rows[0];
    const userRow = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
    const validSenders = [userId, userRow.rows[0]?.id, userRow.rows[0]?.firebase_uid].filter(Boolean);

    if (!validSenders.includes(msg.sender_id)) {
      return sendError(res, 'FORBIDDEN', 'You can only edit your own messages', 403);
    }

    const result = await query(
      `UPDATE messages SET content = $1, is_edited = true WHERE id::text = $2 RETURNING *`,
      [content.trim(), messageId]
    );

    return sendSuccess(res, result.rows[0], 'Message updated');
  } catch (error) {
    next(error);
  }
});

// 8. Delete an individual message
router.delete('/:messageId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    const checkRes = await query(`SELECT * FROM messages WHERE id::text = $1`, [messageId]);
    if (checkRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Message not found', 404);
    }

    const msg = checkRes.rows[0];
    const userRow = await query(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
    const validSenders = [userId, userRow.rows[0]?.id, userRow.rows[0]?.firebase_uid].filter(Boolean);

    if (!validSenders.includes(msg.sender_id)) {
      return sendError(res, 'FORBIDDEN', 'You can only delete your own messages', 403);
    }

    await query(`DELETE FROM messages WHERE id::text = $1`, [messageId]);

    return sendSuccess(res, { id: messageId }, 'Message deleted');
  } catch (error) {
    next(error);
  }
});

export default router;
