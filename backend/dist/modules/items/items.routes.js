"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const city_1 = require("../../utils/city");
const notifications_service_1 = require("../notifications/notifications.service");
const router = (0, express_1.Router)();
const createItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, 'Title must be at least 3 characters'),
    description: zod_1.z.string().min(10, 'Description must be at least 10 characters'),
    category: zod_1.z.string().min(2, 'Category is required'),
    price_per_day: zod_1.z.number().min(0, 'Price per day cannot be negative'),
    max_duration_days: zod_1.z.number().int().positive().default(3),
    image_urls: zod_1.z.array(zod_1.z.string().min(1, 'Photo URL cannot be empty')).min(1, 'At least one photo is required'),
    sticker_badge: zod_1.z.string().default('✨ Available'),
    locality: zod_1.z.string().optional(),
    address_text: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    available_for_borrowing: zod_1.z.boolean().optional().default(false),
    offers_delivery: zod_1.z.boolean().optional().default(false),
    delivery_fee: zod_1.z.number().min(0).optional().default(0),
    offers_pickup: zod_1.z.boolean().optional().default(false),
    pickup_fee: zod_1.z.number().min(0).optional().default(0),
});
const updateItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).optional(),
    description: zod_1.z.string().min(10).optional(),
    category: zod_1.z.string().optional(),
    price_per_day: zod_1.z.number().min(0).optional(),
    max_duration_days: zod_1.z.number().int().positive().optional(),
    image_urls: zod_1.z.array(zod_1.z.string().min(1, 'Photo URL cannot be empty')).optional(),
    sticker_badge: zod_1.z.string().optional(),
    locality: zod_1.z.string().optional(),
    address_text: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    status: zod_1.z.enum(['AVAILABLE', 'RENTED', 'UNAVAILABLE']).optional(),
    available_for_borrowing: zod_1.z.boolean().optional(),
    offers_delivery: zod_1.z.boolean().optional(),
    delivery_fee: zod_1.z.number().min(0).optional(),
    offers_pickup: zod_1.z.boolean().optional(),
    pickup_fee: zod_1.z.number().min(0).optional(),
});
// Browse Items (Includes 100-Meter Proximity Radar)
router.get('/', auth_1.optionalAuthMiddleware, async (req, res, next) => {
    try {
        const { category, search, locality, status = 'AVAILABLE', ownerId, latitude, longitude, radar, max_distance } = req.query;
        const params = [];
        let distanceField = 'NULL AS distance_meters';
        let distanceFilter = '';
        let userLat = latitude ? parseFloat(String(latitude)) : NaN;
        let userLon = longitude ? parseFloat(String(longitude)) : NaN;
        if ((isNaN(userLat) || isNaN(userLon)) && req.user?.id) {
            const uRes = await (0, db_1.query)(`SELECT latitude, longitude FROM users WHERE id::text = $1 OR firebase_uid = $1`, [req.user.id]);
            if (uRes.rows.length > 0 && uRes.rows[0].latitude && uRes.rows[0].longitude) {
                userLat = parseFloat(uRes.rows[0].latitude);
                userLon = parseFloat(uRes.rows[0].longitude);
            }
        }
        if (!isNaN(userLat) && !isNaN(userLon)) {
            params.push(userLat);
            const latIdx = params.length;
            params.push(userLon);
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
        let sql = `
      SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.address_text, i.latitude, i.longitude, i.status, i.available_for_borrowing,
        i.offers_delivery, i.delivery_fee, i.offers_pickup, i.pickup_fee, i.created_at,
        ${distanceField},
        COALESCE(u.id, i.owner_id) AS owner_id, 
        COALESCE(u.name, 'Community Member') AS owner_name, 
        u.avatar_url AS owner_avatar,
        COALESCE(u.locality, i.locality) AS owner_locality, 
        u.trust_score AS owner_trust_score,
        u.rating AS owner_rating
      FROM items i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE 1=1 ${distanceFilter}
    `;
        if (status === 'AVAILABLE') {
            sql += ` AND i.status != 'UNAVAILABLE'`;
        }
        else if (status && status !== 'ALL') {
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
        }
        else if (locality) {
            const city = (0, city_1.extractCity)(String(locality));
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
        const currentViewerId = req.user?.id;
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
        }
        else {
            sql += ` ORDER BY i.created_at DESC`;
        }
        const result = await (0, db_1.query)(sql, params);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Get Single Item Detail
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.status, i.available_for_borrowing, i.offers_delivery, i.delivery_fee, i.offers_pickup, i.pickup_fee, i.created_at,
        u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
        u.bio AS owner_bio, u.trust_score AS owner_trust_score, u.locality AS owner_locality,
        u.email AS owner_email, u.phone AS owner_phone
      FROM items i
      JOIN users u ON i.owner_id = u.id
      WHERE i.id = $1`, [id]);
        if (result.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Item not found', 404);
        }
        const item = result.rows[0];
        // Block check: if viewer and owner have a block relationship, hide item
        const currentViewerId = req.user?.id;
        if (currentViewerId && item.owner_id && currentViewerId !== item.owner_id) {
            const blockCheck = await (0, db_1.query)(`SELECT 1 FROM user_blocks 
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`, [currentViewerId, item.owner_id]);
            if (blockCheck.rows.length > 0) {
                return (0, response_1.sendError)(res, 'FORBIDDEN', 'This item is not available', 403);
            }
        }
        // Fetch booked calendar dates for this item (Active / Confirmed rentals)
        const bookedRes = await (0, db_1.query)(`SELECT 
        id, 
        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
        TO_CHAR(COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date,
        start_time,
        end_time,
        duration_days,
        status
      FROM bookings
      WHERE item_id = $1 AND status IN ('ACCEPTED', 'HANDED_OVER')
      ORDER BY start_date ASC`, [id]);
        // Fetch related items in same category and city
        const itemCity = (0, city_1.extractCity)(item.locality);
        const relatedResult = await (0, db_1.query)(`SELECT id, title, category, price_per_day, image_urls, sticker_badge, locality, status, available_for_borrowing, offers_delivery, delivery_fee, offers_pickup, pickup_fee
       FROM items
       WHERE category = $1 AND id != $2 AND status != 'UNAVAILABLE' AND locality ILIKE $3
       LIMIT 4`, [item.category, item.id, `%${itemCity}%`]);
        return (0, response_1.sendSuccess)(res, {
            ...item,
            booked_dates: bookedRes.rows,
            related_items: relatedResult.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get Availability & Booked Dates for an Item Calendar
router.get('/:id/availability', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT 
        id, 
        TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, 
        TO_CHAR(COALESCE(end_date, (start_date + (duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date,
        start_time,
        end_time,
        duration_days,
        status
      FROM bookings
      WHERE item_id = $1 AND status IN ('ACCEPTED', 'HANDED_OVER')
      ORDER BY start_date ASC`, [id]);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Toggle Available for Borrowing (Lender 1-Click Action)
router.patch('/:id/borrowing', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { available_for_borrowing } = zod_1.z.object({ available_for_borrowing: zod_1.z.boolean() }).parse(req.body);
        const check = await (0, db_1.query)('SELECT owner_id FROM items WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Item not found', 404);
        }
        if (check.rows[0].owner_id !== req.user.id && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only the item owner can change borrowing options', 403);
        }
        const result = await (0, db_1.query)(`UPDATE items 
       SET available_for_borrowing = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, [available_for_borrowing, id]);
        return (0, response_1.sendSuccess)(res, result.rows[0], available_for_borrowing
            ? 'Item is now available for borrowing as well! 🤝'
            : 'Item is now set to rental only.');
    }
    catch (error) {
        next(error);
    }
});
// List New Gear (Lender Flow)
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = createItemSchema.parse(req.body);
        // Ensure owner exists in database so foreign keys and joins always succeed
        await (0, db_1.query)(`
      INSERT INTO users (id, name, email, role, locality)
      VALUES ($1, $2, $3, 'USER', $4)
      ON CONFLICT (id) DO NOTHING;
    `, [
            req.user.id,
            req.user.name || 'Rentu Member',
            req.user.email || `${req.user.id}@firebase.rentu.internal`,
            validated.locality || ''
        ]).catch(() => { });
        const userRes = await (0, db_1.query)('SELECT locality FROM users WHERE id = $1', [req.user.id]);
        const userLocality = userRes.rows[0]?.locality || '';
        let finalLocality = validated.locality?.trim() || userLocality;
        const cleanPincode = validated.pincode?.trim() || null;
        // 3NF: Upsert into postal_codes table before referencing it
        if (cleanPincode && finalLocality) {
            await (0, db_1.query)(`INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`, [cleanPincode, finalLocality]).catch(() => { });
        }
        const result = await (0, db_1.query)(`INSERT INTO items 
        (owner_id, title, description, category, price_per_day, max_duration_days, image_urls, sticker_badge, locality, address_text, pincode, latitude, longitude, status, available_for_borrowing, offers_delivery, delivery_fee, offers_pickup, pickup_fee)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, 'AVAILABLE', $14, $15, $16, $17, $18)
       RETURNING *`, [
            req.user.id,
            validated.title,
            validated.description,
            validated.category,
            validated.price_per_day,
            validated.max_duration_days,
            JSON.stringify(validated.image_urls),
            validated.sticker_badge,
            finalLocality,
            validated.address_text || finalLocality,
            cleanPincode,
            validated.latitude ?? null,
            validated.longitude ?? null,
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
                await (0, db_1.query)(`INSERT INTO item_images (item_id, image_url, display_order) VALUES ($1, $2, $3)`, [createdItem.id, validated.image_urls[i], i]).catch(() => { });
            }
        }
        return (0, response_1.sendSuccess)(res, createdItem, 'Gear listed successfully! ✨ It is now live on the feed.', 201);
    }
    catch (error) {
        next(error);
    }
});
// Update Item
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = updateItemSchema.parse(req.body);
        // Verify ownership
        const check = await (0, db_1.query)('SELECT owner_id FROM items WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Item not found', 404);
        }
        if (check.rows[0].owner_id !== req.user.id && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'You do not have permission to edit this listing', 403);
        }
        const fields = [];
        const values = [];
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
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'No fields provided for update', 400);
        }
        values.push(id);
        const updateSql = `
      UPDATE items 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;
        const result = await (0, db_1.query)(updateSql, values);
        // 1NF: Keep item_images table in sync when images are updated
        if (Array.isArray(validated.image_urls)) {
            await (0, db_1.query)(`DELETE FROM item_images WHERE item_id = $1`, [id]).catch(() => { });
            for (let i = 0; i < validated.image_urls.length; i++) {
                await (0, db_1.query)(`INSERT INTO item_images (item_id, image_url, display_order) VALUES ($1, $2, $3)`, [id, validated.image_urls[i], i]).catch(() => { });
            }
        }
        // Trigger availability notifications if status was modified
        if (validated.status === 'UNAVAILABLE') {
            await (0, notifications_service_1.createNotification)({
                userId: req.user.id,
                type: 'ITEM_UNAVAILABLE',
                title: 'Listing Marked Unavailable 🔒',
                body: `"${result.rows[0]?.title || 'Item'}" is now marked unavailable and paused from rental listings.`,
                referenceId: id,
                referenceType: 'ITEM',
            });
        }
        else if (validated.status === 'AVAILABLE') {
            await (0, notifications_service_1.createNotification)({
                userId: req.user.id,
                type: 'ITEM_AVAILABLE',
                title: 'Listing Marked Available ✨',
                body: `"${result.rows[0]?.title || 'Item'}" is active and available for rent on the marketplace.`,
                referenceId: id,
                referenceType: 'ITEM',
            });
        }
        return (0, response_1.sendSuccess)(res, result.rows[0], 'Listing updated successfully');
    }
    catch (error) {
        next(error);
    }
});
// Delete Item
router.delete('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const check = await (0, db_1.query)('SELECT owner_id FROM items WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Item not found', 404);
        }
        if (check.rows[0].owner_id !== req.user.id && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied', 403);
        }
        await (0, db_1.query)('DELETE FROM items WHERE id = $1', [id]);
        return (0, response_1.sendSuccess)(res, { id }, 'Listing deleted successfully');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
