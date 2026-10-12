import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  locality: z.string().min(2).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(300).optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});


// Public User Profile & Gear Closet
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const userRes = await query(
      `SELECT id, name, locality, avatar_url, bio, trust_score, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    const user = userRes.rows[0];

    // User's active listings
    const itemsRes = await query(
      `SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, status, created_at
       FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
       ORDER BY created_at DESC`,
      [id]
    );

    // User's activity stats
    const statsRes = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1 AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`,
      [id]
    );

    return sendSuccess(res, {
      ...user,
      items: itemsRes.rows,
      stats: statsRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Update Profile
router.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const userId = req.user!.id;

    const fields: string[] = [];
    const values: any[] = [];

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
      return sendError(res, 'BAD_REQUEST', 'No fields to update', 400);
    }

    values.push(userId);
    const updateSql = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, email, name, phone, locality, avatar_url, bio, trust_score, role
    `;

    const result = await query(updateSql, values);
    return sendSuccess(res, result.rows[0], 'Profile updated successfully ✨');
  } catch (error) {
    next(error);
  }
});

export default router;
