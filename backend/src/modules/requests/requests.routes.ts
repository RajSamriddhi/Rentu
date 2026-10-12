import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { extractCity } from '../../utils/city';

const router = Router();

const createRequestSchema = z.object({
  item_name: z.string().min(3, 'Item name must be at least 3 characters'),
  description: z.string().min(5, 'Description is required'),
  category: z.string().default('Other'),
  start_date: z.string().min(1, 'Needed date is required'),
  start_time: z.string().optional(),
  duration_days: z.number().int().positive().default(1),
  offered_amount: z.number().positive('Offered budget must be greater than 0'),
  locality: z.string().min(2, 'Locality is required'),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});


// Browse Community Wishes / Bounties
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const { category, locality, status = 'OPEN', seekerId } = req.query;

    let sql = `
      SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        COALESCE(u.id, r.seeker_id) AS seeker_id, 
        COALESCE(u.name, 'Community Member') AS seeker_name, 
        COALESCE(u.avatar_url, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80') AS seeker_avatar,
        COALESCE(u.locality, r.locality) AS seeker_locality, 
        COALESCE(u.trust_score, 98) AS seeker_trust_score,
        u.phone AS seeker_phone, 
        u.email AS seeker_email
      FROM requests r
      LEFT JOIN users u ON r.seeker_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

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
    } else {
      // A user can ONLY see wishes/bounties from its own city
      let userCity: string | null = null;
      const authUser = (req as AuthenticatedRequest).user;
      if (authUser?.id) {
        const userRes = await query('SELECT locality FROM users WHERE id = $1', [authUser.id]);
        if (userRes.rows.length > 0) {
          userCity = extractCity(userRes.rows[0].locality);
        }
      }

      const activeCity = userCity || (locality ? extractCity(String(locality)) : 'Delhi');
      params.push(`%${activeCity}%`);
      sql += ` AND (r.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
    }

    sql += ` ORDER BY r.created_at DESC`;

    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Get Single Request
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        u.id AS seeker_id, u.name AS seeker_name, u.avatar_url AS seeker_avatar,
        u.locality AS seeker_locality, u.trust_score AS seeker_trust_score,
        u.phone AS seeker_phone, u.email AS seeker_email
      FROM requests r
      JOIN users u ON r.seeker_id = u.id
      WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Wish request not found', 404);
    }

    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Drop a Wish (Create Bounty)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = createRequestSchema.parse(req.body);

    // Ensure locality includes seeker's city
    const userRes = await query('SELECT locality FROM users WHERE id = $1', [req.user!.id]);
    const userLocality = userRes.rows[0]?.locality || 'Delhi';
    const userCity = extractCity(userLocality);
    let finalLocality = validated.locality.trim();
    if (!finalLocality.toLowerCase().includes(userCity.toLowerCase())) {
      finalLocality = `${finalLocality}, ${userCity}`;
    }

    const result = await query(
      `INSERT INTO requests
        (seeker_id, item_name, description, category, start_date, start_time, duration_days, offered_amount, locality, address_text, pincode, latitude, longitude, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'OPEN')
       RETURNING *`,
      [
        req.user!.id,
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
      ]
    );


    return sendSuccess(res, result.rows[0], 'Wish dropped to community feed! 🎯 Nearby owners will see your bounty.', 201);
  } catch (error) {
    next(error);
  }
});

// Claim / Fulfill / Update Status ("I Gotchu")
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status = 'FULFILLED' } = req.body;

    const check = await query('SELECT seeker_id, status FROM requests WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Wish request not found', 404);
    }

    const result = await query(
      `UPDATE requests
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return sendSuccess(res, result.rows[0], `Wish marked as ${status.toLowerCase()}! 🤝`);
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

    if (check.rows[0].seeker_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Permission denied', 403);
    }

    await query('DELETE FROM requests WHERE id = $1', [id]);
    return sendSuccess(res, { id }, 'Wish request deleted');
  } catch (error) {
    next(error);
  }
});

export default router;
