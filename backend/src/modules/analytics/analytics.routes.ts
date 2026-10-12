import { Router, Response } from 'express';
import { query } from '../../config/db';
import { sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// Community Overview & Pulse Metrics (Accessible to view community impact)
router.get('/overview', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const pulseSql = `
      SELECT 
        (SELECT COUNT(*) FROM users)::int AS total_users,
        (SELECT COUNT(DISTINCT owner_id) FROM items)::int AS active_lenders,
        (SELECT COUNT(DISTINCT borrower_id) FROM bookings)::int AS active_borrowers,
        (SELECT COUNT(*) FROM items WHERE status = 'AVAILABLE')::int AS available_gear,
        (SELECT COUNT(*) FROM items WHERE status = 'RENTED')::int AS currently_rented_gear,
        (SELECT COUNT(*) FROM bookings)::int AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED')::int AS completed_bookings,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status IN ('ACCEPTED', 'COMPLETED'))::numeric AS total_community_volume,
        (SELECT COUNT(*) FROM requests WHERE status = 'OPEN')::int AS open_wishes,
        (SELECT COUNT(*) FROM requests WHERE status = 'FULFILLED')::int AS fulfilled_wishes
    `;

    const pulseRes = await query(pulseSql);
    const pulse = pulseRes.rows[0];

    // Category breakdown
    const categoryRes = await query(`
      SELECT 
        category, 
        COUNT(*)::int AS count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate
      FROM items
      GROUP BY category
      ORDER BY count DESC
    `);

    // Top active lenders
    const topLendersRes = await query(`
      SELECT 
        u.id, u.name, u.avatar_url, u.locality, u.trust_score,
        COUNT(i.id)::int AS gear_count
      FROM users u
      JOIN items i ON u.id = i.owner_id
      GROUP BY u.id
      ORDER BY gear_count DESC
      LIMIT 5
    `);

    return sendSuccess(res, {
      pulse,
      categories: categoryRes.rows,
      topLenders: topLendersRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Category Leaderboard
router.get('/categories', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        category, 
        COUNT(*)::int AS item_count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate,
        (SELECT COUNT(*) FROM requests r WHERE r.category = i.category)::int AS demand_count
      FROM items i
      GROUP BY category
      ORDER BY item_count DESC
    `);

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
