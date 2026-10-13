"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
    locality: zod_1.z.string().min(2).optional(),
    avatar_url: zod_1.z.string().url().or(zod_1.z.literal('')).optional(),
    banner_url: zod_1.z.string().url().or(zod_1.z.literal('')).optional(),
    bio: zod_1.z.string().max(300).optional(),
    address_text: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
});
// Public User Profile & Gear Closet
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userRes = await (0, db_1.query)(`SELECT id, name, locality, avatar_url, banner_url, bio, trust_score, created_at
       FROM users WHERE id = $1`, [id]);
        if (userRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'User not found', 404);
        }
        const user = userRes.rows[0];
        // User's active listings
        const itemsRes = await (0, db_1.query)(`SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, status, created_at
       FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
       ORDER BY created_at DESC`, [id]);
        // User's activity stats
        const statsRes = await (0, db_1.query)(`SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1 AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`, [id]);
        return (0, response_1.sendSuccess)(res, {
            ...user,
            items: itemsRes.rows,
            stats: statsRes.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
});
// Update Profile
router.put('/profile', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = updateProfileSchema.parse(req.body);
        const userId = req.user.id;
        const fields = [];
        const values = [];
        if (validated.name !== undefined) {
            values.push(validated.name);
            fields.push(`name = $${values.length}`);
        }
        if (validated.phone !== undefined) {
            values.push(validated.phone);
            fields.push(`phone = $${values.length}`);
        }
        if (validated.locality !== undefined) {
            values.push(validated.locality);
            fields.push(`locality = $${values.length}`);
        }
        if (validated.avatar_url !== undefined) {
            values.push(validated.avatar_url);
            fields.push(`avatar_url = $${values.length}`);
        }
        if (validated.banner_url !== undefined) {
            values.push(validated.banner_url);
            fields.push(`banner_url = $${values.length}`);
        }
        if (validated.bio !== undefined) {
            values.push(validated.bio);
            fields.push(`bio = $${values.length}`);
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
        if (fields.length === 0) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'No fields to update', 400);
        }
        values.push(userId);
        const updateSql = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at
    `;
        const result = await (0, db_1.query)(updateSql, values);
        return (0, response_1.sendSuccess)(res, result.rows[0], 'Profile updated successfully ✨');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
