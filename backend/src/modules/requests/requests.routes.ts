import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { extractCity } from '../../utils/city';
import { resolveUserIds, getCanonicalUserId } from '../../utils/user';
import { createNotification } from '../notifications/notifications.service';

const router = Router();

const createRequestSchema = z.object({
  item_name: z.string().min(3, 'Item name must be at least 3 characters'),
  description: z.string().min(5, 'Description is required'),
  category: z.string().default('Other'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  start_time: z.string().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
  end_time: z.string().optional(),
  duration_days: z.number().int().positive().default(1),
  offered_amount: z.number().min(0, 'Offered budget cannot be negative'),
  locality: z.string().optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  image_url: z.string().nullable().optional(),
  pickup_type: z.string().optional().default('LENDER_LOCATION'),
  pickup_locality: z.string().optional(),
  return_type: z.string().optional().default('LENDER_LOCATION'),
  return_locality: z.string().optional(),
  will_pickup: z.boolean().optional().default(true),
  will_drop_back: z.boolean().optional().default(true),
  delivery_fee: z.number().min(0).optional().default(0),
});

const updateRequestSchema = z.object({
  item_name: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  category: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
  start_time: z.string().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
  end_time: z.string().optional(),
  duration_days: z.number().int().positive().optional(),
  offered_amount: z.number().min(0).optional(),
  locality: z.string().optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  status: z.enum(['OPEN', 'FULFILLED', 'CANCELLED']).optional(),
  image_url: z.string().nullable().optional(),
  pickup_type: z.string().optional(),
  pickup_locality: z.string().optional(),
  return_type: z.string().optional(),
  return_locality: z.string().optional(),
  will_pickup: z.boolean().optional(),
  will_drop_back: z.boolean().optional(),
  delivery_fee: z.number().min(0).optional(),
});


function parseToUtcTimestamp(dateStr: string, timeStr?: string, tzOffsetMinutes: number = -330): number {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  const cleanTime = (timeStr && timeStr.trim() && timeStr.slice(0, 5) !== '00:00') ? timeStr.slice(0, 5) : '10:00';
  const [hour, minute] = cleanTime.split(':').map(Number);
  const localUtcMs = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
  return localUtcMs + (tzOffsetMinutes * 60000);
}

let lastRequestsExpirationRun = 0;

/**
 * Automatically checks and cancels any OPEN gear requests where the acceptance / needed start time has already passed.
 * Uses a single fast indexed SQL bulk update throttled to at most once per 60 seconds.
 */
async function autoCancelExpiredRequests(): Promise<void> {
  const now = Date.now();
  if (now - lastRequestsExpirationRun < 60 * 1000) return;
  lastRequestsExpirationRun = now;

  try {
    await query(`
      UPDATE requests
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'OPEN'
        AND (
          start_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
          OR (
            start_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
            AND COALESCE(start_time, '10:00:00'::time) < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::time
          )
        )
    `);
  } catch (err) {
    console.warn('autoCancelExpiredRequests error:', err);
  }
}

// Browse Community Wishes / Bounties
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    await autoCancelExpiredRequests();
    const { category, locality, status = 'OPEN', seekerId } = req.query;
    const currentViewerId = (req as AuthenticatedRequest).user?.id;
    const viewerIds = currentViewerId ? await resolveUserIds(currentViewerId, (req as AuthenticatedRequest).user?.email) : [];
    const params: any[] = [viewerIds];

    let sql = `
      SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.end_date, r.end_time, r.duration_days, 
        r.offered_amount, r.locality, 
        CASE WHEN r.seeker_id = ANY($1::text[]) THEN r.address_text ELSE NULL END AS address_text,
        CASE WHEN r.seeker_id = ANY($1::text[]) THEN r.pincode ELSE NULL END AS pincode,
        r.pickup_type, r.pickup_locality, r.return_type, r.return_locality,
        r.will_pickup, r.will_drop_back, r.delivery_fee,
        r.status, r.created_at, r.image_url,
        COALESCE(u.id, r.seeker_id) AS seeker_id, 
        COALESCE(u.name, 'Community Member') AS seeker_name, 
        u.username AS seeker_username,
        u.avatar_url AS seeker_avatar,
        COALESCE(u.locality, r.locality) AS seeker_locality, 
        u.trust_score AS seeker_trust_score,
        NULL AS seeker_phone, 
        NULL AS seeker_email
      FROM requests r
      LEFT JOIN users u ON (r.seeker_id = u.id OR r.seeker_id = u.firebase_uid)
      WHERE 1=1
    `;

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }

    if (category && category !== 'All') {
      params.push(category);
      sql += ` AND r.category = $${params.length}`;
    }

    if (seekerId) {
      const resolvedSeekerIds = await resolveUserIds(String(seekerId));
      params.push(resolvedSeekerIds);
      sql += ` AND r.seeker_id = ANY($${params.length}::text[])`;
    } else if (locality) {
      const city = extractCity(String(locality));
      if (city) {
        params.push(`%${city}%`);
        sql += ` AND (r.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      }
    }

    // Exclude requests from blocked users
    if (currentViewerId) {
      params.push(currentViewerId);
      sql += ` AND r.seeker_id NOT IN (
        SELECT blocked_id FROM user_blocks WHERE blocker_id = $${params.length}
        UNION
        SELECT blocker_id FROM user_blocks WHERE blocked_id = $${params.length}
      )`;
    }

    sql += ` ORDER BY r.created_at DESC`;

    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Get Single Request
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    await autoCancelExpiredRequests();
    const { id } = req.params;

    const result = await query(
      `SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.end_date, r.end_time, r.duration_days, 
        r.offered_amount, r.locality, r.address_text, r.pincode,
        r.pickup_type, r.pickup_locality, r.return_type, r.return_locality,
        r.will_pickup, r.will_drop_back, r.delivery_fee,
        r.status, r.created_at, r.image_url,
        u.id AS seeker_id, u.name AS seeker_name, u.username AS seeker_username, u.avatar_url AS seeker_avatar,
        u.locality AS seeker_locality, u.trust_score AS seeker_trust_score,
        u.phone AS seeker_phone, u.email AS seeker_email
      FROM requests r
      LEFT JOIN users u ON (r.seeker_id = u.id OR r.seeker_id = u.firebase_uid)
      WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Wish request not found', 404);
    }

    const requestItem = result.rows[0];
    const currentViewerId = (req as AuthenticatedRequest).user?.id;
    let canViewPrivate = false;
    if (currentViewerId) {
      const viewerIds = await resolveUserIds(currentViewerId);
      canViewPrivate = viewerIds.includes(String(requestItem.seeker_id)) || (req as AuthenticatedRequest).user?.role === 'ADMIN';
    }

    if (!canViewPrivate) {
      requestItem.address_text = null;
      requestItem.pincode = null;
      requestItem.seeker_phone = null;
      requestItem.seeker_email = null;
      requestItem.latitude = null;
      requestItem.longitude = null;
    }

    return sendSuccess(res, requestItem);
  } catch (error) {
    next(error);
  }
});

// Drop a Wish (Create Bounty)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = createRequestSchema.parse(req.body);

    // Validate that start date and time has not already passed
    const tzOffset = typeof req.body.timezone_offset_minutes === 'number'
      ? req.body.timezone_offset_minutes
      : -330;
    const [year, month, day] = validated.start_date.split('-').map(Number);
    const cleanTime = (validated.start_time && validated.start_time.trim()) ? validated.start_time.slice(0, 5) : '10:00';
    const [hour, minute] = cleanTime.split(':').map(Number);
    const localUtcMs = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
    const startMs = localUtcMs + (tzOffset * 60000);

    if (startMs < Date.now() - (2 * 60 * 1000)) {
      return sendError(res, 'BAD_REQUEST', 'Cannot create request for a date and time that has already passed.', 400);
    }

    let calculatedDuration = validated.duration_days;
    if (validated.end_date) {
      const [eY, eM, eD] = validated.end_date.split('-').map(Number);
      const eUtc = Date.UTC(eY, (eM || 1) - 1, eD || 1);
      const sUtc = Date.UTC(year, (month || 1) - 1, day || 1);
      const calDiff = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24));
      calculatedDuration = Math.max(1, calDiff);
    }

    // Ensure seeker exists in users table to prevent FK constraint errors
    await query(`
      INSERT INTO users (id, name, email, role, locality)
      VALUES ($1, $2, $3, 'USER', $4)
      ON CONFLICT (id) DO NOTHING;
    `, [
      req.user!.id,
      req.user!.name || 'Rentu Member',
      req.user!.email || `${req.user!.id}@firebase.rentu.internal`,
      validated.locality || ''
    ]).catch(() => {});

    let finalLocality = validated.locality?.trim() || '';
    const cleanPincode = validated.pincode?.trim() || null;

    // 3NF: Upsert into postal_codes table before referencing it
    if (cleanPincode && finalLocality) {
      await query(
        `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
        [cleanPincode, finalLocality]
      ).catch(() => {});
    }

    const result = await query(
      `INSERT INTO requests
        (seeker_id, item_name, description, category, start_date, start_time, end_date, end_time, duration_days, offered_amount, locality, address_text, pincode, latitude, longitude, image_url, pickup_type, pickup_locality, return_type, return_locality, will_pickup, will_drop_back, delivery_fee, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, 'OPEN')
       RETURNING *`,
      [
        req.user!.id,
        validated.item_name,
        validated.description,
        validated.category,
        validated.start_date,
        validated.start_time || '10:00',
        validated.end_date || null,
        validated.end_time || '18:00',
        calculatedDuration,
        validated.offered_amount,
        finalLocality,
        validated.address_text || finalLocality,
        cleanPincode,
        validated.latitude ?? null,
        validated.longitude ?? null,
        validated.image_url ?? null,
        validated.pickup_type || 'LENDER_LOCATION',
        validated.pickup_locality || null,
        validated.return_type || 'LENDER_LOCATION',
        validated.return_locality || null,
        validated.will_pickup ?? true,
        validated.will_drop_back ?? true,
        validated.delivery_fee ?? 0,
      ]);
    const createdRequest = result.rows[0];
    const seekerId = req.user!.id;
    const seekerName = req.user!.name || 'A neighbor';

    // 1. Send announcement to all followers of seeker
    try {
      const followersRes = await query(
        `SELECT uf.follower_id FROM user_follows uf
         WHERE uf.following_id = $1
         AND uf.follower_id NOT IN (
           SELECT blocked_id FROM user_blocks WHERE blocker_id = $1
           UNION
           SELECT blocker_id FROM user_blocks WHERE blocked_id = $1
         )`,
        [seekerId]
      );

      const notifiedUserIds = new Set<string>();
      notifiedUserIds.add(seekerId);

      for (const f of followersRes.rows) {
        notifiedUserIds.add(f.follower_id);
        await query(
          `INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
           VALUES ($1, $2, 'REQUEST_FOLLOWER_ANNOUNCEMENT', $3, $4, $5, 'REQUEST')`,
          [
            f.follower_id,
            seekerId,
            `New Request from ${seekerName}`,
            `${seekerName} just posted a gear request: "${validated.item_name}" (Budget: ₹${validated.offered_amount})`,
            createdRequest.id,
          ]
        ).catch(() => {});
      }

      // 2. Send notification to all neighbors within 5 km who haven't disabled the 5km alert setting
      const nearbyUsersRes = await query(
        `SELECT id, locality, latitude, longitude FROM users
         WHERE id != $1
         AND COALESCE(notify_nearby_requests_5km, TRUE) = TRUE
         AND id NOT IN (
           SELECT blocked_id FROM user_blocks WHERE blocker_id = $1
           UNION
           SELECT blocker_id FROM user_blocks WHERE blocked_id = $1
         )`,
        [seekerId]
      );

      let seekerLat = validated.latitude;
      let seekerLon = validated.longitude;
      if (seekerLat == null || seekerLon == null) {
        const sLocRes = await query(`SELECT latitude, longitude FROM users WHERE id = $1`, [seekerId]);
        seekerLat = sLocRes.rows[0]?.latitude;
        seekerLon = sLocRes.rows[0]?.longitude;
      }

      for (const u of nearbyUsersRes.rows) {
        if (notifiedUserIds.has(u.id)) continue;

        let isWithin5Km = false;
        if (seekerLat != null && seekerLon != null && u.latitude != null && u.longitude != null) {
          const R = 6371; // Earth radius in km
          const dLat = (u.latitude - seekerLat) * Math.PI / 180;
          const dLon = (u.longitude - seekerLon) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(seekerLat * Math.PI / 180) * Math.cos(u.latitude * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distKm = R * c;
          if (distKm <= 5) {
            isWithin5Km = true;
          }
        }

        if (isWithin5Km) {
          notifiedUserIds.add(u.id);
          await query(
            `INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
             VALUES ($1, $2, 'NEARBY_REQUEST_ANNOUNCEMENT', $3, $4, $5, 'REQUEST')`,
            [
              u.id,
              seekerId,
              `Nearby Gear Request`,
              `${seekerName} nearby requested: "${validated.item_name}" (${finalLocality || 'nearby'})`,
              createdRequest.id,
            ]
          ).catch(() => {});
        }
      }
    } catch (announcementErr) {
      console.warn('Failed to dispatch request announcements:', announcementErr);
    }

    return sendSuccess(res, createdRequest, 'Wish dropped to community feed. Nearby owners will see your request.', 201);
  } catch (error) {
    next(error);
  }
});

// Send "I Can Lend This" Offer & Notification to Seeker
router.post('/:id/offer-lend', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const lenderId = req.user!.id;
    const lenderName = req.user!.name || 'A Neighbor';

    const reqResult = await query(
      `SELECT r.*, u.name as seeker_name, u.avatar_url as seeker_avatar, u.locality as seeker_user_locality
       FROM requests r
       LEFT JOIN users u ON (r.seeker_id = u.id OR r.seeker_id = u.firebase_uid)
       WHERE r.id = $1`,
      [id]
    );

    if (reqResult.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Request not found', 404);
    }

    const request = reqResult.rows[0];

    const myIds = await resolveUserIds(lenderId);
    if (myIds.includes(String(request.seeker_id))) {
      return sendError(res, 'BAD_REQUEST', 'You cannot lend gear to your own request', 400);
    }

    if (request.status !== 'OPEN') {
      return sendError(res, 'BAD_REQUEST', 'This request is no longer open', 400);
    }

    // Expiration check: request only expires if the requested rental end period has completely passed
    const toDateIso = (d: any): string => {
      if (!d) return '';
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return String(d).slice(0, 10);
    };
    const endDateStr = toDateIso(request.end_date || request.start_date);
    if (endDateStr) {
      const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);
      if (eYear && eMonth && eDay) {
        // End of that calendar day in local IST (23:59:59 IST is 18:29:59 UTC)
        const endOfDayMs = Date.UTC(eYear, eMonth - 1, eDay, 18, 29, 59);
        if (endOfDayMs < Date.now()) {
          await query(`UPDATE requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [request.id]).catch(() => {});
          return sendError(res, 'BAD_REQUEST', 'This request has expired and can no longer receive offers.', 400);
        }
      }
    }

    // DUPLICATE CHECK: Prevent multiple pending offers from the same lender on the same request
    const existingOffer = await query(
      `SELECT id FROM messages 
       WHERE (proposal_data->>'request_id') = $1 
         AND sender_id = ANY($2::text[]) 
         AND (proposal_data->>'status' = 'PENDING' OR (proposal_data->>'status') IS NULL)
       LIMIT 1`,
      [request.id, myIds]
    );
    if (existingOffer.rows.length > 0) {
      return sendError(res, 'BAD_REQUEST', 'You already sent a lend offer for this request. Please wait for the seeker to review it in Messages.', 400);
    }

    const existingBooking = await query(
      `SELECT id FROM bookings 
       WHERE request_id = $1 
         AND lender_id = ANY($2::text[]) 
         AND status::text IN ('PENDING', 'ACCEPTED', 'HANDED_OVER')
       LIMIT 1`,
      [request.id, myIds]
    );
    if (existingBooking.rows.length > 0) {
      return sendError(res, 'BAD_REQUEST', 'You already have an active booking or offer for this request.', 400);
    }

    // BLOCK CHECK: Prevent lending if either party has blocked the other
    const blockCheck = await query(
      `SELECT 1 FROM user_blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [lenderId, request.seeker_id]
    );
    if (blockCheck.rows.length > 0) {
      return sendError(res, 'FORBIDDEN', 'Cannot send lend offer. Communication between these users is blocked.', 403);
    }

    const durationDays = Math.max(1, Number(request.duration_days) || 1);
    const offeredAmount = Number(request.offered_amount) || 0;
    const totalExtraFee = (!request.will_pickup || !request.will_drop_back) ? Number(request.delivery_fee || 0) : 0;
    const deliveryFee = !request.will_pickup ? (request.will_drop_back ? totalExtraFee : Math.round(totalExtraFee / 2)) : 0;
    const returnFee = !request.will_drop_back ? (request.will_pickup ? totalExtraFee : totalExtraFee - deliveryFee) : 0;
    const totalDealPrice = offeredAmount + totalExtraFee;
    const pricePerDay = Math.round(offeredAmount / durationDays);

    // Address privacy: coarse locality only in proposal payload prior to acceptance
    const coarseHandoverLocation = request.locality || 'Handover location';

    const proposalPayload = {
      type: 'REQUEST',
      is_lend_offer: true,
      request_id: request.id,
      lender_id: lenderId,
      borrower_id: request.seeker_id,
      title: request.item_name,
      description: request.description,
      category: request.category || 'Other',
      price_per_day: pricePerDay,
      total_price: totalDealPrice,
      duration_days: durationDays,
      start_date: request.start_date,
      end_date: request.end_date,
      start_time: request.start_time || '10:00:00',
      end_time: request.end_time || '18:00:00',
      delivery_option: !request.will_pickup ? 'LENDER_DELIVERY' : 'SELF',
      delivery_fee: deliveryFee,
      collection_option: !request.will_drop_back ? 'LENDER_COLLECT' : 'SELF',
      collection_fee: returnFee,
      delivery_location: coarseHandoverLocation,
      return_location: coarseHandoverLocation,
      notes: request.description,
      image_url: request.image_url || null,
      status: 'PENDING',
    };

    const summaryText = `I Can Lend This: ${lenderName} offered to fulfill your request for "${request.item_name}" (₹${totalDealPrice} for ${durationDays} days)`;

    // Insert proposal message in chat between lender and seeker
    const msgResult = await query(
      `INSERT INTO messages (sender_id, receiver_id, content, message_type, proposal_data)
       VALUES ($1, $2, $3, 'PROPOSAL', $4)
       RETURNING *`,
      [lenderId, request.seeker_id, summaryText, JSON.stringify(proposalPayload)]
    );
    const createdMessage = msgResult.rows[0];

    // Insert high-priority notification for seeker
    await createNotification({
      userId: request.seeker_id,
      senderId: lenderId,
      type: 'REQUEST_LEND_OFFER',
      title: `${lenderName} is ready to lend gear`,
      body: `${lenderName} accepted your request terms for "${request.item_name}" (Budget: ₹${request.offered_amount}). Accept the offer in messages to start your ongoing booking!`,
      referenceId: request.id,
      referenceType: 'PROPOSAL',
      messageId: createdMessage?.id,
    }).catch((err) => console.warn('Failed to dispatch lend offer notification:', err));

    return sendSuccess(res, {
      message: createdMessage,
      proposal: proposalPayload,
      partner: {
        id: request.seeker_id,
        name: request.seeker_name,
        avatar: request.seeker_avatar,
      }
    }, 'Lend offer sent to seeker! When they accept, the booking will automatically start in Ongoing Bookings.');
  } catch (error) {
    next(error);
  }
});

// Edit Request / Claim / Fulfill / Update Status
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const validated = updateRequestSchema.parse(req.body);

    const check = await query('SELECT seeker_id, status FROM requests WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Wish request not found', 404);
    }

    const userIds = await resolveUserIds(req.user!.id);
    const isSeeker = userIds.includes(String(check.rows[0].seeker_id)) || req.user!.role === 'ADMIN';

    if (!isSeeker) {
      return sendError(res, 'FORBIDDEN', 'Permission denied: Only the wish creator can edit or update the status of this request.', 403);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (validated.item_name !== undefined) {
      values.push(validated.item_name);
      fields.push(`item_name = $${values.length}`);
    }
    if (validated.description !== undefined) {
      values.push(validated.description);
      fields.push(`description = $${values.length}`);
    }
    if (validated.category !== undefined) {
      values.push(validated.category);
      fields.push(`category = $${values.length}`);
    }
    if (validated.start_date !== undefined) {
      values.push(validated.start_date);
      fields.push(`start_date = $${values.length}`);
    }
    if (validated.start_time !== undefined) {
      values.push(validated.start_time);
      fields.push(`start_time = $${values.length}`);
    }
    if (validated.end_date !== undefined) {
      values.push(validated.end_date);
      fields.push(`end_date = $${values.length}`);
    }
    if (validated.end_time !== undefined) {
      values.push(validated.end_time);
      fields.push(`end_time = $${values.length}`);
    }
    if (validated.duration_days !== undefined) {
      values.push(validated.duration_days);
      fields.push(`duration_days = $${values.length}`);
    }
    if (validated.offered_amount !== undefined) {
      values.push(validated.offered_amount);
      fields.push(`offered_amount = $${values.length}`);
    }
    if (validated.locality !== undefined) {
      values.push(validated.locality);
      fields.push(`locality = $${values.length}`);
    }
    if (validated.status !== undefined) {
      values.push(validated.status);
      fields.push(`status = $${values.length}`);
    }
    if (validated.image_url !== undefined) {
      values.push(validated.image_url);
      fields.push(`image_url = $${values.length}`);
    }
    if (validated.pickup_type !== undefined) {
      values.push(validated.pickup_type);
      fields.push(`pickup_type = $${values.length}`);
    }
    if (validated.pickup_locality !== undefined) {
      values.push(validated.pickup_locality);
      fields.push(`pickup_locality = $${values.length}`);
    }
    if (validated.return_type !== undefined) {
      values.push(validated.return_type);
      fields.push(`return_type = $${values.length}`);
    }
    if (validated.return_locality !== undefined) {
      values.push(validated.return_locality);
      fields.push(`return_locality = $${values.length}`);
    }
    if (validated.address_text !== undefined) {
      values.push(validated.address_text);
      fields.push(`address_text = $${values.length}`);
    }
    if (validated.pincode !== undefined) {
      values.push(validated.pincode);
      fields.push(`pincode = $${values.length}`);
    }
    if (validated.will_pickup !== undefined) {
      values.push(validated.will_pickup);
      fields.push(`will_pickup = $${values.length}`);
    }
    if (validated.will_drop_back !== undefined) {
      values.push(validated.will_drop_back);
      fields.push(`will_drop_back = $${values.length}`);
    }
    if (validated.delivery_fee !== undefined) {
      values.push(validated.delivery_fee);
      fields.push(`delivery_fee = $${values.length}`);
    }

    if (fields.length === 0) {
      return sendError(res, 'BAD_REQUEST', 'No fields provided for update', 400);
    }

    values.push(id);
    const updateSql = `
      UPDATE requests
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await query(updateSql, values);
    const updatedRequest = result.rows[0];

    // If request was cancelled or fulfilled, or core dates/budget terms changed, invalidate pending proposals
    const coreTermsChanged = validated.offered_amount !== undefined || validated.start_date !== undefined || validated.end_date !== undefined || validated.duration_days !== undefined;
    if (validated.status === 'CANCELLED' || validated.status === 'FULFILLED' || coreTermsChanged) {
      await query(
        `UPDATE messages
         SET proposal_data = jsonb_set(proposal_data, '{status}', '"CANCELLED"')
         WHERE (proposal_data->>'request_id') = $1
           AND (proposal_data->>'status' = 'PENDING' OR (proposal_data->>'status') IS NULL)`,
        [id]
      ).catch((e) => console.warn('Failed to cancel pending proposals for request:', e));
    }

    return sendSuccess(res, updatedRequest, 'Wish request updated successfully');
  } catch (error) {
    next(error);
  }
});

// Cancel / Delete Request
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const check = await query('SELECT seeker_id FROM requests WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Wish request not found', 404);
    }

    const userIds = await resolveUserIds(req.user!.id);
    if (!userIds.includes(String(check.rows[0].seeker_id)) && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Permission denied', 403);
    }

    await query('DELETE FROM requests WHERE id = $1', [id]);
    await query(
      `UPDATE messages
       SET proposal_data = jsonb_set(proposal_data, '{status}', '"CANCELLED"')
       WHERE (proposal_data->>'request_id') = $1
         AND (proposal_data->>'status' = 'PENDING' OR (proposal_data->>'status') IS NULL)`,
      [id]
    ).catch(() => {});
    return sendSuccess(res, { id }, 'Wish request deleted');
  } catch (error) {
    next(error);
  }
});

export default router;
