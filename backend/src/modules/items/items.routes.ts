import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { query } from '../../config/db';
import { ENV } from '../../config/env';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { extractCity } from '../../utils/city';
import { createNotification } from '../notifications/notifications.service';
import { resolveUserIds } from '../../utils/user';

const router = Router();
const storageClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_ANON_KEY);

const deleteStoragePhoto = async (url: string) => {
  try {
    if (!url || typeof url !== 'string' || !url.includes('/storage/v1/object/public/item-photos/')) return;
    const path = url.split('/storage/v1/object/public/item-photos/')[1];
    if (path) {
      const decoded = decodeURIComponent(path.split('?')[0]);
      await storageClient.storage.from('item-photos').remove([decoded]);
    }
  } catch (e) {
    console.warn('Storage photo cleanup notice:', e);
  }
};

const createItemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(2, 'Category is required'),
  price_per_day: z.number().min(0, 'Price per day cannot be negative'),
  max_duration_days: z.number().int().positive().default(3),
  image_urls: z.array(z.string().min(1, 'Photo URL cannot be empty')).min(1, 'At least one photo is required'),
  sticker_badge: z.string().default('Available'),
  locality: z.string().optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  available_for_borrowing: z.boolean().optional().default(false),
  condition: z.string().optional().default('Good'),
  offers_delivery: z.boolean().optional().default(false),
  delivery_fee: z.number().min(0).optional().default(0),
  offers_pickup: z.boolean().optional().default(false),
  pickup_fee: z.number().min(0).optional().default(0),
});

const updateItemSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  category: z.string().optional(),
  condition: z.string().optional(),
  price_per_day: z.number().min(0).optional(),
  max_duration_days: z.number().int().positive().optional(),
  image_urls: z.array(z.string().min(1, 'Photo URL cannot be empty')).optional(),
  sticker_badge: z.string().optional(),
  locality: z.string().optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  status: z.enum(['AVAILABLE', 'RENTED', 'UNAVAILABLE']).optional(),
  available_for_borrowing: z.boolean().optional(),
  offers_delivery: z.boolean().optional(),
  delivery_fee: z.number().min(0).optional(),
  offers_pickup: z.boolean().optional(),
  pickup_fee: z.number().min(0).optional(),
});

// Browse Items (Includes 100-Meter Proximity Radar)
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const {
      category,
      search,
      locality,
      status = 'AVAILABLE',
      ownerId,
      latitude,
      longitude,
      radar,
      max_distance,
      limit,
      offset
    } = req.query;

    const params: any[] = [];
    let distanceField = 'NULL AS distance_meters';
    let distanceFilter = '';

    let userLat = latitude ? parseFloat(String(latitude)) : NaN;
    let userLon = longitude ? parseFloat(String(longitude)) : NaN;

    if ((isNaN(userLat) || isNaN(userLon)) && (req as any).user?.id) {
      const uRes = await query(
        `SELECT latitude, longitude, locality FROM users WHERE id::text = $1 OR firebase_uid = $1`,
        [(req as any).user.id]
      );
      if (uRes.rows.length > 0) {
        if (uRes.rows[0].latitude && uRes.rows[0].longitude) {
          userLat = parseFloat(uRes.rows[0].latitude);
          userLon = parseFloat(uRes.rows[0].longitude);
        } else if (uRes.rows[0].locality) {
          const loc = uRes.rows[0].locality.toLowerCase();
          if (loc.includes('beml')) { userLat = 12.9140; userLon = 77.4993; }
          else if (loc.includes('mylasandra')) { userLat = 12.8850; userLon = 77.5050; }
        }
      }
    }

    if (!isNaN(userLat) && !isNaN(userLon)) {
      params.push(userLat);
      const latIdx = params.length;
      params.push(userLon);
      const lonIdx = params.length;

      // Exact Haversine formula from profile coordinates and accurate localities
      distanceField = `
        ROUND(
          6371000 * acos(
            LEAST(1.0, GREATEST(-1.0, 
              cos(radians($${latIdx})) * cos(radians(
                CASE 
                  WHEN i.latitude IS NOT NULL AND i.latitude != 0 THEN i.latitude
                  WHEN u.latitude IS NOT NULL AND u.latitude != 0 THEN u.latitude
                  WHEN i.locality ILIKE '%beml%' THEN 12.9140
                  WHEN i.locality ILIKE '%mylasandra%' THEN 12.8850
                  WHEN i.locality ILIKE '%kengeri%' THEN 12.9177
                  WHEN i.locality ILIKE '%rajarajeshwari%' OR i.locality ILIKE '%rr nagar%' THEN 12.9275
                  WHEN i.locality ILIKE '%jayanagar%' THEN 12.9308
                  WHEN i.locality ILIKE '%koramangala%' THEN 12.9352
                  WHEN i.locality ILIKE '%indiranagar%' THEN 12.9784
                  WHEN i.locality ILIKE '%hsr%' THEN 12.9121
                  WHEN i.locality ILIKE '%whitefield%' THEN 12.9698
                  WHEN i.locality ILIKE '%electronic city%' THEN 12.8452
                  ELSE $${latIdx}
                END
              )) *
              cos(radians(
                CASE 
                  WHEN i.longitude IS NOT NULL AND i.longitude != 0 THEN i.longitude
                  WHEN u.longitude IS NOT NULL AND u.longitude != 0 THEN u.longitude
                  WHEN i.locality ILIKE '%beml%' THEN 77.4993
                  WHEN i.locality ILIKE '%mylasandra%' THEN 77.5050
                  WHEN i.locality ILIKE '%kengeri%' THEN 77.4838
                  WHEN i.locality ILIKE '%rajarajeshwari%' OR i.locality ILIKE '%rr nagar%' THEN 77.5150
                  WHEN i.locality ILIKE '%jayanagar%' THEN 77.5838
                  WHEN i.locality ILIKE '%koramangala%' THEN 77.6245
                  WHEN i.locality ILIKE '%indiranagar%' THEN 77.6408
                  WHEN i.locality ILIKE '%hsr%' THEN 77.6446
                  WHEN i.locality ILIKE '%whitefield%' THEN 77.7500
                  WHEN i.locality ILIKE '%electronic city%' THEN 77.6602
                  ELSE $${lonIdx}
                END
              ) - radians($${lonIdx})) +
              sin(radians($${latIdx})) * sin(radians(
                CASE 
                  WHEN i.latitude IS NOT NULL AND i.latitude != 0 THEN i.latitude
                  WHEN u.latitude IS NOT NULL AND u.latitude != 0 THEN u.latitude
                  WHEN i.locality ILIKE '%beml%' THEN 12.9140
                  WHEN i.locality ILIKE '%mylasandra%' THEN 12.8850
                  WHEN i.locality ILIKE '%kengeri%' THEN 12.9177
                  WHEN i.locality ILIKE '%rajarajeshwari%' OR i.locality ILIKE '%rr nagar%' THEN 12.9275
                  WHEN i.locality ILIKE '%jayanagar%' THEN 12.9308
                  WHEN i.locality ILIKE '%koramangala%' THEN 12.9352
                  WHEN i.locality ILIKE '%indiranagar%' THEN 12.9784
                  WHEN i.locality ILIKE '%hsr%' THEN 12.9121
                  WHEN i.locality ILIKE '%whitefield%' THEN 12.9698
                  WHEN i.locality ILIKE '%electronic city%' THEN 12.8452
                  ELSE $${latIdx}
                END
              ))
            ))
          )
        ) AS distance_meters
      `;

      if (radar === 'true' || radar === '100m' || max_distance) {
        const limitMeters = max_distance ? parseFloat(String(max_distance)) : 100;
        params.push(limitMeters);
        distanceFilter = ` AND (
          6371000 * acos(
            LEAST(1.0, GREATEST(-1.0, 
              cos(radians($${latIdx})) * cos(radians(i.latitude)) *
              cos(radians(i.longitude) - radians($${lonIdx})) +
              sin(radians($${latIdx})) * sin(radians(i.latitude))
            ))
          )
        ) <= $${params.length}`;
      }
    }

    let sql = `
      SELECT 
        i.id, i.title, i.description, i.category, i.condition, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, 
        COALESCE(i.locality, u.locality) AS locality, 
        NULL AS address_text, 
        NULL AS pincode,
        NULL AS latitude, 
        NULL AS longitude, 
        i.status AS status, 
        EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.item_id = i.id
            AND b.status IN ('ACCEPTED', 'HANDED_OVER')
            AND CURRENT_DATE BETWEEN b.start_date::date AND (COALESCE(b.end_date, b.start_date))::date
        ) AS is_currently_booked,
        i.available_for_borrowing,
        i.offers_delivery, i.delivery_fee, i.offers_pickup, i.pickup_fee, i.created_at,
        ${distanceField},
        COALESCE(u.id, i.owner_id) AS owner_id, 
        COALESCE(u.name, 'Community Member') AS owner_name, 
        u.username AS owner_username,
        u.avatar_url AS owner_avatar,
        COALESCE(i.locality, u.locality) AS owner_locality, 
        NULL AS owner_address_text,
        NULL AS owner_pincode,
        u.trust_score AS owner_trust_score,
        CASE WHEN COALESCE(u.owner_reviews_count, 0) > 0 THEN u.owner_rating ELSE NULL END AS owner_rating,
        COALESCE(u.owner_reviews_count, 0)::int AS owner_reviews_count
      FROM items i
      LEFT JOIN users u ON (i.owner_id = u.id OR i.owner_id = u.firebase_uid)
      WHERE 1=1 ${distanceFilter}
        AND COALESCE(i.is_deleted, false) = false
    `;

    if (status === 'AVAILABLE') {
      sql += ` AND i.status = 'AVAILABLE'`;
    } else if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    if (category && category !== 'All') {
      if (category === 'Clothing & Fits' || category === 'Clothing & Accessories') {
        sql += ` AND (i.category = 'Clothing & Fits' OR i.category = 'Clothing & Accessories')`;
      } else {
        params.push(category);
        sql += ` AND i.category = $${params.length}`;
      }
    }

    if (ownerId) {
      const resolvedOwnerIds = await resolveUserIds(String(ownerId));
      params.push(resolvedOwnerIds);
      sql += ` AND i.owner_id = ANY($${params.length}::text[])`;
    } else if (locality) {
      const city = extractCity(String(locality));
      if (city) {
        params.push(`%${city}%`);
        sql += ` AND (i.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      }
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (i.title ILIKE $${params.length} OR i.description ILIKE $${params.length} OR i.category ILIKE $${params.length})`;
    }

    // Exclude items from blocked users
    const currentViewerId = (req as AuthenticatedRequest).user?.id;
    if (currentViewerId) {
      params.push(currentViewerId);
      sql += ` AND i.owner_id NOT IN (
        SELECT blocked_id FROM user_blocks WHERE blocker_id = $${params.length}
        UNION
        SELECT blocker_id FROM user_blocks WHERE blocked_id = $${params.length}
      )`;
    }

    if (radar === 'true' || radar === '100m') {
      sql += ` ORDER BY distance_meters ASC, i.created_at DESC`;
    } else {
      sql += ` ORDER BY i.created_at DESC`;
    }

    const parsedLimit = limit ? Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50)) : 50;
    params.push(parsedLimit);
    sql += ` LIMIT $${params.length}`;

    if (offset) {
      const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);
      params.push(parsedOffset);
      sql += ` OFFSET $${params.length}`;
    }

    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});


// Get Single Item Detail
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        i.id, i.title, i.description, i.category, i.condition, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, 
        COALESCE(i.locality, u.locality) AS locality, 
        COALESCE(i.address_text, u.address_text) AS address_text, 
        COALESCE(i.pincode, u.pincode) AS pincode,
        COALESCE(i.latitude, u.latitude) AS latitude, 
        COALESCE(i.longitude, u.longitude) AS longitude,
        i.status AS status, 
        i.available_for_borrowing, i.offers_delivery, i.delivery_fee, i.offers_pickup, i.pickup_fee, i.created_at,
        u.id AS owner_id, u.name AS owner_name, u.username AS owner_username, u.avatar_url AS owner_avatar,
        u.bio AS owner_bio, u.trust_score AS owner_trust_score,
        CASE WHEN COALESCE(u.owner_reviews_count, 0) > 0 THEN u.owner_rating ELSE NULL END AS owner_rating,
        COALESCE(u.owner_reviews_count, 0)::int AS owner_reviews_count,
        COALESCE(u.locality, i.locality) AS owner_locality,
        COALESCE(u.address_text, i.address_text) AS owner_address_text,
        COALESCE(u.pincode, i.pincode) AS owner_pincode,
        u.email AS owner_email, u.phone AS owner_phone
      FROM items i
      LEFT JOIN users u ON (i.owner_id = u.id OR i.owner_id = u.firebase_uid)
      WHERE i.id = $1 AND COALESCE(i.is_deleted, false) = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    const item = result.rows[0];

    // Block check: if viewer and owner have a block relationship, hide item
    const currentViewerId = (req as AuthenticatedRequest).user?.id;
    if (currentViewerId && item.owner_id && currentViewerId !== item.owner_id) {
      const blockCheck = await query(
        `SELECT 1 FROM user_blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [currentViewerId, item.owner_id]
      );
      if (blockCheck.rows.length > 0) {
        return sendError(res, 'FORBIDDEN', 'This item is not available', 403);
      }
    }

    // Privacy protection: Only show exact address to the item owner or renters who have an accepted/active booking
    let canViewAddress = false;
    if (currentViewerId) {
      const viewerIds = await resolveUserIds(currentViewerId);
      if (viewerIds.includes(String(item.owner_id))) {
        canViewAddress = true;
      } else {
        const acceptedBookingCheck = await query(
          `SELECT 1 FROM bookings 
           WHERE item_id = $1 
             AND borrower_id = ANY($2::text[]) 
             AND status IN ('ACCEPTED', 'HANDED_OVER')
             AND COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date) >= CURRENT_DATE
           LIMIT 1`,
          [item.id, viewerIds]
        );
        canViewAddress = acceptedBookingCheck.rows.length > 0;
      }
    }

    if (!canViewAddress) {
      item.address_text = null;
      item.owner_address_text = null;
      item.pincode = null;
      item.owner_pincode = null;
      item.owner_email = null;
      item.owner_phone = null;
      item.latitude = null;
      item.longitude = null;
    }

    // Fetch booked calendar dates for this item (Active / Confirmed rentals in the future or ongoing)
    const bookedRes = await query(
      `SELECT 
        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
        TO_CHAR(COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date,
        start_time,
        end_time
      FROM bookings
      WHERE item_id = $1 
        AND status IN ('ACCEPTED', 'HANDED_OVER')
        AND COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date) >= CURRENT_DATE
      ORDER BY start_date ASC`,
      [id]
    );

    // Fetch related items in same category and city
    const itemCity = extractCity(item.locality);
    const relatedResult = await query(
      `SELECT id, title, category, price_per_day, image_urls, sticker_badge, locality, status, available_for_borrowing, offers_delivery, delivery_fee, offers_pickup, pickup_fee
       FROM items
       WHERE category = $1 AND id != $2 AND status != 'UNAVAILABLE' AND locality ILIKE $3
       LIMIT 4`,
      [item.category, item.id, `%${itemCity}%`]
    );

    return sendSuccess(res, {
      ...item,
      can_view_address: canViewAddress,
      booked_dates: bookedRes.rows,
      related_items: relatedResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get Availability & Booked Dates for an Item Calendar (Active or upcoming rentals)
router.get('/:id/availability', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
        TO_CHAR(COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date,
        start_time,
        end_time
      FROM bookings
      WHERE item_id = $1 
        AND status IN ('ACCEPTED', 'HANDED_OVER')
        AND COALESCE(end_date, (start_date + ((GREATEST(duration_days, 1) - 1) || ' days')::interval)::date) >= CURRENT_DATE
      ORDER BY start_date ASC`,
      [id]
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Toggle Available for Borrowing (Lender 1-Click Action)
router.patch('/:id/borrowing', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { available_for_borrowing } = z.object({ available_for_borrowing: z.boolean() }).parse(req.body);

    const check = await query('SELECT owner_id FROM items WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    const ownerIds = await resolveUserIds(req.user!.id);
    if (!ownerIds.includes(String(check.rows[0].owner_id)) && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only the item owner can change borrowing options', 403);
    }

    const result = await query(
      `UPDATE items 
       SET available_for_borrowing = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [available_for_borrowing, id]
    );

    return sendSuccess(
      res,
      result.rows[0],
      available_for_borrowing
        ? 'Item is now available for borrowing as well.'
        : 'Item is now set to rental only.'
    );
  } catch (error) {
    next(error);
  }
});

// List New Gear (Lender Flow)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = createItemSchema.parse(req.body);

    // Ensure owner exists in database so foreign keys and joins always succeed
    await query(`
      INSERT INTO users (id, name, email, role, locality)
      VALUES ($1, $2, $3, 'USER', $4)
      ON CONFLICT (id) DO NOTHING;
    `, [
      req.user!.id,
      req.user!.name || 'Rentu Member',
      req.user!.email || `${req.user!.id}@firebase.rentu.internal`,
      validated.locality || ''
    ]).catch(() => { });

    const userRes = await query('SELECT locality, latitude, longitude FROM users WHERE id = $1', [req.user!.id]);
    const userLocality = userRes.rows[0]?.locality || '';
    let finalLocality = validated.locality?.trim() || userLocality;
    const cleanPincode = validated.pincode?.trim() || null;

    // Resolve accurate coordinates from item input, owner profile, or locality
    let itemLat = validated.latitude ?? (userRes.rows[0]?.latitude ? parseFloat(userRes.rows[0].latitude) : null);
    let itemLon = validated.longitude ?? (userRes.rows[0]?.longitude ? parseFloat(userRes.rows[0].longitude) : null);

    if ((itemLat === null || isNaN(itemLat)) && finalLocality) {
      const lower = finalLocality.toLowerCase();
      if (lower.includes('beml')) { itemLat = 12.9140; itemLon = 77.4993; }
      else if (lower.includes('mylasandra')) { itemLat = 12.8850; itemLon = 77.5050; }
      else if (lower.includes('kengeri')) { itemLat = 12.9177; itemLon = 77.4838; }
      else if (lower.includes('rajarajeshwari') || lower.includes('rr nagar')) { itemLat = 12.9275; itemLon = 77.5150; }
      else if (lower.includes('jayanagar')) { itemLat = 12.9308; itemLon = 77.5838; }
      else if (lower.includes('koramangala')) { itemLat = 12.9352; itemLon = 77.6245; }
      else if (lower.includes('indiranagar')) { itemLat = 12.9784; itemLon = 77.6408; }
      else if (lower.includes('hsr')) { itemLat = 12.9121; itemLon = 77.6446; }
    }

    // 3NF: Upsert into postal_codes table before referencing it
    if (cleanPincode && finalLocality) {
      await query(
        `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
        [cleanPincode, finalLocality]
      ).catch(() => { });
    }

    const result = await query(
      `INSERT INTO items 
        (owner_id, title, description, category, condition, price_per_day, max_duration_days, image_urls, sticker_badge, locality, address_text, pincode, latitude, longitude, status, available_for_borrowing, offers_delivery, delivery_fee, offers_pickup, pickup_fee)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, 'AVAILABLE', $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        req.user!.id,
        validated.title,
        validated.description,
        validated.category,
        validated.condition || 'Good',
        validated.price_per_day,
        validated.max_duration_days,
        JSON.stringify(validated.image_urls),
        validated.sticker_badge,
        finalLocality,
        validated.address_text || finalLocality,
        cleanPincode,
        itemLat ?? null,
        itemLon ?? null,
        validated.available_for_borrowing ?? false,
        validated.offers_delivery ?? false,
        validated.delivery_fee ?? 0,
        validated.offers_pickup ?? false,
        validated.pickup_fee ?? 0,
      ]);
    const createdItem = result.rows[0];

    // 1NF: Save images into normalized item_images table
    if (Array.isArray(validated.image_urls) && validated.image_urls.length > 0) {
      for (let i = 0; i < validated.image_urls.length; i++) {
        await query(
          `INSERT INTO item_images (item_id, image_url, display_order) VALUES ($1, $2, $3)`,
          [createdItem.id, validated.image_urls[i], i]
        ).catch(() => { });
      }
    }

    return sendSuccess(res, createdItem, 'Gear listed successfully. It is now live on the feed.', 201);
  } catch (error) {
    next(error);
  }
});

// Update Item
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const validated = updateItemSchema.parse(req.body);

    // Verify ownership
    const check = await query('SELECT owner_id, image_urls FROM items WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    const ownerIds = await resolveUserIds(req.user!.id);
    if (!ownerIds.includes(String(check.rows[0].owner_id)) && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'You do not have permission to edit this listing', 403);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (validated.title !== undefined) {
      values.push(validated.title);
      fields.push(`title = $${values.length}`);
    }
    if (validated.description !== undefined) {
      values.push(validated.description);
      fields.push(`description = $${values.length}`);
    }
    if (validated.category !== undefined) {
      const cat = validated.category === 'Clothing & Accessories' ? 'Clothing & Fits' : validated.category;
      values.push(cat);
      fields.push(`category = $${values.length}`);
    }
    if (validated.condition !== undefined) {
      values.push(validated.condition);
      fields.push(`condition = $${values.length}`);
    }
    if (validated.price_per_day !== undefined) {
      values.push(validated.price_per_day);
      fields.push(`price_per_day = $${values.length}`);
    }
    if (validated.max_duration_days !== undefined) {
      values.push(validated.max_duration_days);
      fields.push(`max_duration_days = $${values.length}`);
    }
    if (validated.image_urls !== undefined) {
      values.push(JSON.stringify(validated.image_urls));
      fields.push(`image_urls = $${values.length}::jsonb`);
    }
    if (validated.sticker_badge !== undefined) {
      values.push(validated.sticker_badge);
      fields.push(`sticker_badge = $${values.length}`);
    }
    if (validated.locality !== undefined) {
      values.push(validated.locality);
      fields.push(`locality = $${values.length}`);
    }
    if (validated.address_text !== undefined) {
      values.push(validated.address_text);
      fields.push(`address_text = $${values.length}`);
    }
    if (validated.pincode !== undefined) {
      values.push(validated.pincode);
      fields.push(`pincode = $${values.length}`);
    }
    if (validated.latitude !== undefined) {
      values.push(validated.latitude);
      fields.push(`latitude = $${values.length}`);
    }
    if (validated.longitude !== undefined) {
      values.push(validated.longitude);
      fields.push(`longitude = $${values.length}`);
    }
    if (validated.status !== undefined) {
      values.push(validated.status);
      fields.push(`status = $${values.length}`);
    }
    if (validated.available_for_borrowing !== undefined) {
      values.push(validated.available_for_borrowing);
      fields.push(`available_for_borrowing = $${values.length}`);
    }
    if (validated.offers_delivery !== undefined) {
      values.push(validated.offers_delivery);
      fields.push(`offers_delivery = $${values.length}`);
    }
    if (validated.delivery_fee !== undefined) {
      values.push(validated.delivery_fee);
      fields.push(`delivery_fee = $${values.length}`);
    }
    if (validated.offers_pickup !== undefined) {
      values.push(validated.offers_pickup);
      fields.push(`offers_pickup = $${values.length}`);
    }
    if (validated.pickup_fee !== undefined) {
      values.push(validated.pickup_fee);
      fields.push(`pickup_fee = $${values.length}`);
    }

    if (fields.length === 0) {
      return sendError(res, 'BAD_REQUEST', 'No fields provided for update', 400);
    }

    values.push(id);
    const updateSql = `
      UPDATE items 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await query(updateSql, values);

    if (validated.pincode && validated.locality) {
      const cleanPincode = validated.pincode.replace(/\D/g, '').slice(0, 6);
      if (cleanPincode) {
        await query(
          `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
          [cleanPincode, validated.locality]
        ).catch(() => { });
      }
    }

    // If images were updated, clean up old storage photos that were removed
    if (validated.image_urls !== undefined) {
      const oldRawImages = check.rows[0].image_urls;
      const oldImages: string[] = Array.isArray(oldRawImages) ? oldRawImages : [];
      const newImagesSet = new Set(validated.image_urls);
      for (const oldImg of oldImages) {
        if (!newImagesSet.has(oldImg)) {
          await deleteStoragePhoto(oldImg);
        }
      }

      await query(`DELETE FROM item_images WHERE item_id = $1`, [id]).catch(() => { });
      for (let i = 0; i < validated.image_urls.length; i++) {
        await query(
          `INSERT INTO item_images (item_id, image_url, display_order) VALUES ($1, $2, $3)`,
          [id, validated.image_urls[i], i]
        ).catch(() => { });
      }
    }

    // Trigger availability notifications if status was modified
    if (validated.status === 'UNAVAILABLE') {
      await createNotification({
        userId: req.user!.id,
        type: 'ITEM_UNAVAILABLE',
        title: 'Listing Marked Unavailable',
        body: `"${result.rows[0]?.title || 'Item'}" is now marked unavailable and paused from rental listings.`,
        referenceId: id,
        referenceType: 'ITEM',
      });
    } else if (validated.status === 'AVAILABLE') {
      await createNotification({
        userId: req.user!.id,
        type: 'ITEM_AVAILABLE',
        title: 'Listing Marked Available',
        body: `"${result.rows[0]?.title || 'Item'}" is active and available for rent on the marketplace.`,
        referenceId: id,
        referenceType: 'ITEM',
      });
    }

    return sendSuccess(res, result.rows[0], 'Listing updated successfully');
  } catch (error) {
    next(error);
  }
});

// Delete Item (handles foreign key safety, active rental checks, soft-delete, and storage cleanup)
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const check = await query('SELECT owner_id, image_urls FROM items WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    const ownerIds = await resolveUserIds(req.user!.id);
    if (!ownerIds.includes(String(check.rows[0].owner_id)) && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Permission denied', 403);
    }

    // 1. Check for active/ongoing bookings that would leave users stranded
    const activeBookings = await query(
      `SELECT id FROM bookings 
       WHERE item_id = $1 
         AND status IN ('ACCEPTED', 'HANDED_OVER') 
       LIMIT 1`,
      [id]
    );
    if (activeBookings.rows.length > 0) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Cannot delete listing: this item currently has an active rental booking in progress. Please complete the booking first.',
        400
      );
    }

    // 2. Check if historical bookings exist to maintain relational integrity
    const anyBookings = await query(
      `SELECT id FROM bookings WHERE item_id = $1 LIMIT 1`,
      [id]
    );

    if (anyBookings.rows.length > 0) {
      // Soft-delete: retain row for booking history reference while removing from all feeds and searches
      await query(
        `UPDATE items 
         SET status = 'UNAVAILABLE', is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [id]
      );
    } else {
      // Hard delete if never booked
      await query('DELETE FROM item_images WHERE item_id = $1', [id]).catch(() => {});
      await query('DELETE FROM items WHERE id = $1', [id]);
    }

    // 3. Remove photo files from public storage
    const rawImages = check.rows[0].image_urls;
    const images: string[] = Array.isArray(rawImages) ? rawImages : [];
    for (const img of images) {
      await deleteStoragePhoto(img);
    }

    return sendSuccess(res, { id }, 'Listing deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
