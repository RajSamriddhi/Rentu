"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const city_1 = require("../../utils/city");
const router = (0, express_1.Router)();
const createRequestSchema = zod_1.z.object({
    item_name: zod_1.z.string().min(3, 'Item name must be at least 3 characters'),
    description: zod_1.z.string().min(5, 'Description is required'),
    category: zod_1.z.string().default('Other'),
    start_date: zod_1.z.string().min(1, 'Needed date is required'),
    start_time: zod_1.z.string().optional(),
    duration_days: zod_1.z.number().int().positive().default(1),
    offered_amount: zod_1.z.number().min(0, 'Offered budget cannot be negative'),
    locality: zod_1.z.string().optional(),
    address_text: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    image_url: zod_1.z.string().nullable().optional(),
});
const updateRequestSchema = zod_1.z.object({
    item_name: zod_1.z.string().min(3).optional(),
    description: zod_1.z.string().min(5).optional(),
    category: zod_1.z.string().optional(),
    start_date: zod_1.z.string().optional(),
    start_time: zod_1.z.string().optional(),
    duration_days: zod_1.z.number().int().positive().optional(),
    offered_amount: zod_1.z.number().min(0).optional(),
    locality: zod_1.z.string().optional(),
    status: zod_1.z.enum(['OPEN', 'FULFILLED', 'CANCELLED']).optional(),
    image_url: zod_1.z.string().nullable().optional(),
});
// Browse Community Wishes / Bounties
router.get('/', auth_1.optionalAuthMiddleware, async (req, res, next) => {
    try {
        const { category, locality, status = 'OPEN', seekerId } = req.query;
        let sql = `
      SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        r.image_url,
        COALESCE(u.id, r.seeker_id) AS seeker_id, 
        COALESCE(u.name, 'Community Member') AS seeker_name, 
        u.avatar_url AS seeker_avatar,
        COALESCE(u.locality, r.locality) AS seeker_locality, 
        u.trust_score AS seeker_trust_score,
        u.phone AS seeker_phone, 
        u.email AS seeker_email
      FROM requests r
      LEFT JOIN users u ON r.seeker_id = u.id
      WHERE 1=1
    `;
        const params = [];
        if (status && status !== 'ALL') {
            params.push(status);
            sql += ` AND r.status = $${params.length}`;
        }
        if (category && category !== 'All') {
            params.push(category);
            sql += ` AND r.category = $${params.length}`;
        }
        if (seekerId) {
            params.push(seekerId);
            sql += ` AND r.seeker_id = $${params.length}`;
        }
        else if (locality) {
            const city = (0, city_1.extractCity)(String(locality));
            if (city) {
                params.push(`%${city}%`);
                sql += ` AND (r.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
            }
        }
        sql += ` ORDER BY r.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// Get Single Request
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        r.image_url,
        u.id AS seeker_id, u.name AS seeker_name, u.avatar_url AS seeker_avatar,
        u.locality AS seeker_locality, u.trust_score AS seeker_trust_score,
        u.phone AS seeker_phone, u.email AS seeker_email
      FROM requests r
      JOIN users u ON r.seeker_id = u.id
      WHERE r.id = $1`, [id]);
        if (result.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Wish request not found', 404);
        }
        return (0, response_1.sendSuccess)(res, result.rows[0]);
    }
    catch (error) {
        next(error);
    }
});
// Drop a Wish (Create Bounty)
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = createRequestSchema.parse(req.body);
        // Ensure seeker exists in users table to prevent FK constraint errors
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
        let finalLocality = validated.locality?.trim() || '';
        const cleanPincode = validated.pincode?.trim() || null;
        // 3NF: Upsert into postal_codes table before referencing it
        if (cleanPincode && finalLocality) {
            await (0, db_1.query)(`INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`, [cleanPincode, finalLocality]).catch(() => { });
        }
        const result = await (0, db_1.query)(`INSERT INTO requests
        (seeker_id, item_name, description, category, start_date, start_time, duration_days, offered_amount, locality, address_text, pincode, latitude, longitude, image_url, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'OPEN')
       RETURNING *`, [
            req.user.id,
            validated.item_name,
            validated.description,
            validated.category,
            validated.start_date,
            validated.start_time || '10:00',
            validated.duration_days,
            validated.offered_amount,
            finalLocality,
            validated.address_text || finalLocality,
            cleanPincode,
            validated.latitude ?? null,
            validated.longitude ?? null,
            validated.image_url ?? null,
        ]);
        const createdRequest = result.rows[0];
        return (0, response_1.sendSuccess)(res, createdRequest, 'Wish dropped to community feed! 🎯 Nearby owners will see your bounty.', 201);
    }
    catch (error) {
        next(error);
    }
});
// Edit Request / Claim / Fulfill / Update Status
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = updateRequestSchema.parse(req.body);
        const check = await (0, db_1.query)('SELECT seeker_id, status FROM requests WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Wish request not found', 404);
        }
        const isSeeker = check.rows[0].seeker_id === req.user.id || req.user.role === 'ADMIN';
        // If another neighbor is claiming/fulfilling it
        if (!isSeeker) {
            if (validated.status === 'FULFILLED') {
                const result = await (0, db_1.query)(`UPDATE requests SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
                return (0, response_1.sendSuccess)(res, result.rows[0], 'Wish marked as fulfilled! 🤝');
            }
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied', 403);
        }
        const fields = [];
        const values = [];
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
        if (fields.length === 0) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'No fields provided for update', 400);
        }
        values.push(id);
        const updateSql = `
      UPDATE requests
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;
        const result = await (0, db_1.query)(updateSql, values);
        return (0, response_1.sendSuccess)(res, result.rows[0], 'Wish request updated successfully');
    }
    catch (error) {
        next(error);
    }
});
// Cancel / Delete Request
router.delete('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const check = await (0, db_1.query)('SELECT seeker_id FROM requests WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Wish request not found', 404);
        }
        if (check.rows[0].seeker_id !== req.user.id && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Permission denied', 403);
        }
        await (0, db_1.query)('DELETE FROM requests WHERE id = $1', [id]);
        return (0, response_1.sendSuccess)(res, { id }, 'Wish request deleted');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
