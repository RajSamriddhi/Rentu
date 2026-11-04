"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Community Overview & Pulse Metrics (Accessible to view community impact)
router.get('/overview', auth_1.optionalAuthMiddleware, async (req, res, next) => {
    try {
        const pulseSql = `
      SELECT 
        (SELECT COUNT(*) FROM users)::int AS total_users,
        (SELECT COUNT(DISTINCT owner_id) FROM items WHERE status IN ('AVAILABLE', 'RENTED'))::int AS active_lenders,
        (SELECT COUNT(DISTINCT borrower_id) FROM bookings WHERE status IN ('ACCEPTED', 'HANDED_OVER', 'COMPLETED'))::int AS active_borrowers,
        (SELECT COUNT(*) FROM items WHERE status = 'AVAILABLE')::int AS available_gear,
        (SELECT COUNT(*) FROM items WHERE status = 'RENTED')::int AS currently_rented_gear,
        (SELECT COUNT(*) FROM bookings)::int AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED')::int AS completed_bookings,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status IN ('ACCEPTED', 'COMPLETED'))::numeric AS total_community_volume,
        (SELECT COUNT(*) FROM requests WHERE status = 'OPEN')::int AS open_wishes,
        (SELECT COUNT(*) FROM requests WHERE status = 'FULFILLED')::int AS fulfilled_wishes,
        (
          SELECT CASE 
            WHEN COUNT(*) = 0 THEN 100
            ELSE ROUND((COUNT(*) FILTER (WHERE status = 'COMPLETED')::numeric / COUNT(*)::numeric) * 100, 0)::int
          END
          FROM bookings 
          WHERE status IN ('COMPLETED', 'CANCELLED', 'REJECTED')
        ) AS handoff_success_rate,
        (
          SELECT COUNT(*)::int 
          FROM support_tickets 
          WHERE type = 'CONCERN'
        ) AS reported_disputes,
        (
          SELECT COALESCE(ROUND(AVG(price_per_day), 0), 0)::int 
          FROM items 
          WHERE status IN ('AVAILABLE', 'RENTED')
        ) AS avg_daily_rate,
        (
          SELECT COALESCE(ROUND(AVG(trust_score), 0), 90)::int 
          FROM users 
          WHERE trust_score IS NOT NULL
        ) AS avg_trust_score
    `;
        const pulseRes = await (0, db_1.query)(pulseSql);
        const pulse = pulseRes.rows[0];
        // Category breakdown
        const categoryRes = await (0, db_1.query)(`
      SELECT 
        category, 
        COUNT(*)::int AS count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate
      FROM items
      GROUP BY category
      ORDER BY count DESC
    `);
        // Top active lenders
        const topLendersRes = await (0, db_1.query)(`
      SELECT 
        u.id, u.name, u.avatar_url, u.locality, u.trust_score,
        COUNT(i.id)::int AS gear_count
      FROM users u
      JOIN items i ON u.id = i.owner_id
      GROUP BY u.id
      ORDER BY gear_count DESC
      LIMIT 5
    `);
        // Top localities
        const localityRes = await (0, db_1.query)(`
      SELECT 
        COALESCE(NULLIF(TRIM(locality), ''), 'Nearby') AS locality,
        COUNT(*)::int AS user_count
      FROM users
      GROUP BY 1
      ORDER BY user_count DESC
      LIMIT 5
    `);
        return (0, response_1.sendSuccess)(res, {
            pulse,
            categories: categoryRes.rows,
            topLenders: topLendersRes.rows,
            localities: localityRes.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// Category Leaderboard
router.get('/categories', async (req, res, next) => {
    try {
        const result = await (0, db_1.query)(`
      SELECT 
        category, 
        COUNT(*)::int AS item_count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate,
        (SELECT COUNT(*) FROM requests r WHERE r.category = i.category)::int AS demand_count
      FROM items i
      GROUP BY category
      ORDER BY item_count DESC
    `);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
