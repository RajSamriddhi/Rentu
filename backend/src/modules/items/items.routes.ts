import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { extractCity } from '../../utils/city';

const router = Router();

const createItemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(2, 'Category is required'),
  price_per_day: z.number().positive('Price per day must be greater than 0'),
  max_duration_days: z.number().int().positive().default(3),
  image_urls: z.array(z.string().url()).min(1, 'At least one photo is required'),
  sticker_badge: z.string().default('✨ Weekend Flex'),
  locality: z.string().min(2, 'Locality is required'),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const updateItemSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  category: z.string().optional(),
  price_per_day: z.number().positive().optional(),
  max_duration_days: z.number().int().positive().optional(),
  image_urls: z.array(z.string().url()).optional(),
  sticker_badge: z.string().optional(),
  locality: z.string().optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  status: z.enum(['AVAILABLE', 'RENTED', 'UNAVAILABLE']).optional(),
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
      max_distance 
    } = req.query;

    const params: any[] = [];
    let distanceField = 'NULL AS distance_meters';
    let distanceFilter = '';

    if (latitude && longitude) {
      const latNum = parseFloat(String(latitude));
      const lonNum = parseFloat(String(longitude));
      if (!isNaN(latNum) && !isNaN(lonNum)) {
        params.push(latNum);
        const latIdx = params.length;
        params.push(lonNum);
        const lonIdx = params.length;

        // Exact Haversine formula from SCHEMA.md
        distanceField = `
          ROUND(
            6371000 * acos(
              LEAST(1.0, GREATEST(-1.0, 
                cos(radians($${latIdx})) * cos(radians(i.latitude)) *
                cos(radians(i.longitude) - radians($${lonIdx})) +
                sin(radians($${latIdx})) * sin(radians(i.latitude))
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
    }

    let sql = `
      SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.address_text, i.latitude, i.longitude, i.status, i.created_at,
        ${distanceField},
        COALESCE(u.id, i.owner_id) AS owner_id, 
        COALESCE(u.name, 'Community Member') AS owner_name, 
        u.avatar_url AS owner_avatar,
        COALESCE(u.locality, i.locality) AS owner_locality, 
        COALESCE(u.trust_score, 98) AS owner_trust_score,
        COALESCE(u.rating, 5.00) AS owner_rating
      FROM items i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE 1=1 ${distanceFilter}
    `;

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    if (category && category !== 'All') {
      params.push(category);
      sql += ` AND i.category = $${params.length}`;
    }

    if (ownerId) {
      params.push(ownerId);
      sql += ` AND i.owner_id = $${params.length}`;
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

    if (radar === 'true' || radar === '100m') {
      sql += ` ORDER BY distance_meters ASC, i.created_at DESC`;
    } else {
      sql += ` ORDER BY i.created_at DESC`;
    }

    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});


// Get Single Item Detail
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.status, i.created_at,
        u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
        u.bio AS owner_bio, u.trust_score AS owner_trust_score, u.locality AS owner_locality,
        u.email AS owner_email, u.phone AS owner_phone
      FROM items i
      JOIN users u ON i.owner_id = u.id
      WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    const item = result.rows[0];

    // Fetch related items in same category and city
    const itemCity = extractCity(item.locality);
    const relatedResult = await query(
      `SELECT id, title, category, price_per_day, image_urls, sticker_badge, locality, status
       FROM items
       WHERE category = $1 AND id != $2 AND status = 'AVAILABLE' AND locality ILIKE $3
       LIMIT 4`,
      [item.category, item.id, `%${itemCity}%`]
    );

    return sendSuccess(res, {
      ...item,
      related_items: relatedResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// List New Gear (Lender Flow)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = createItemSchema.parse(req.body);

    const userRes = await query('SELECT locality FROM users WHERE id = $1', [req.user!.id]);
    const userLocality = userRes.rows[0]?.locality || '';
    let finalLocality = validated.locality?.trim() || userLocality;

    const result = await query(
      `INSERT INTO items 
        (owner_id, title, description, category, price_per_day, max_duration_days, image_urls, sticker_badge, locality, address_text, pincode, latitude, longitude, status)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, 'AVAILABLE')
       RETURNING *`,
      [
        req.user!.id,
        validated.title,
        validated.description,
        validated.category,
        validated.price_per_day,
        validated.max_duration_days,
        JSON.stringify(validated.image_urls),
        validated.sticker_badge,
        finalLocality,
        validated.address_text || finalLocality,
        validated.pincode || null,
        validated.latitude || 28.5355,
        validated.longitude || 77.2167,
      ]);
    const createdItem = result.rows[0];

    // 1NF: Save images into normalized item_images table
    if (Array.isArray(validated.image_urls) && validated.image_urls.length > 0) {
      for (let i = 0; i < validated.image_urls.length; i++) {
        await query(
          `INSERT INTO item_images (item_id, image_url, display_order) VALUES ($1, $2, $3)`,
          [createdItem.id, validated.image_urls[i], i]
        ).catch(() => {});
      }
    }

    // 3NF: Upsert into postal_codes table
    if (validated.pincode && finalLocality) {
      await query(
        `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
        [validated.pincode, finalLocality]
      ).catch(() => {});
    }

    return sendSuccess(res, createdItem, 'Gear listed successfully! ✨ It is now live on the feed.', 201);
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
    const check = await query('SELECT owner_id FROM items WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    if (check.rows[0].owner_id !== req.user!.id && req.user!.role !== 'ADMIN') {
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
      values.push(validated.category);
      fields.push(`category = $${values.length}`);
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
    if (validated.status !== undefined) {
      values.push(validated.status);
      fields.push(`status = $${values.length}`);
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
    return sendSuccess(res, result.rows[0], 'Listing updated successfully');
  } catch (error) {
    next(error);
  }
});

// Delete Item
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const check = await query('SELECT owner_id FROM items WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Item not found', 404);
    }

    if (check.rows[0].owner_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Permission denied', 403);
    }

    await query('DELETE FROM items WHERE id = $1', [id]);
    return sendSuccess(res, { id }, 'Listing deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
