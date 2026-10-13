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
    offered_amount: zod_1.z.number().positive('Offered budget must be greater than 0'),
    locality: zod_1.z.string().min(2, 'Locality is required'),
    address_text: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
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
        COALESCE(u.id, r.seeker_id) AS seeker_id, 
        COALESCE(u.name, 'Community Member') AS seeker_name, 
        u.avatar_url AS seeker_avatar,
        COALESCE(u.locality, r.locality) AS seeker_locality, 
        COALESCE(u.trust_score, 98) AS seeker_trust_score,
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
        const result = await (0, db_1.query)(`INSERT INTO requests
        (seeker_id, item_name, description, category, start_date, start_time, duration_days, offered_amount, locality, address_text, pincode, latitude, longitude, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'OPEN')
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
            validated.pincode || null,
            validated.latitude || 28.5355,
            validated.longitude || 77.2167,
        ]);
        return (0, response_1.sendSuccess)(res, result.rows[0], 'Wish dropped to community feed! 🎯 Nearby owners will see your bounty.', 201);
    }
    catch (error) {
        next(error);
    }
});
// Claim / Fulfill / Update Status ("I Gotchu")
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status = 'FULFILLED' } = req.body;
        const check = await (0, db_1.query)('SELECT seeker_id, status FROM requests WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Wish request not found', 404);
        }
        const result = await (0, db_1.query)(`UPDATE requests
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, [status, id]);
        return (0, response_1.sendSuccess)(res, result.rows[0], `Wish marked as ${status.toLowerCase()}! 🤝`);
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
