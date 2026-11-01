"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// GET /notifications - Get current user notifications
router.get('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await (0, db_1.query)(`SELECT 
        n.id, 
        n.user_id, 
        n.type, 
        n.title, 
        n.body, 
        n.sender_id, 
        n.reference_id, 
        n.reference_type, 
        n.read_at, 
        n.created_at,
        u.name AS sender_name,
        u.avatar_url AS sender_avatar
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`, [userId]);
        const unreadCountRes = await (0, db_1.query)(`SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId]);
        return (0, response_1.sendSuccess)(res, {
            notifications: result.rows,
            unread_count: unreadCountRes.rows[0]?.unread || 0,
        });
    }
    catch (error) {
        next(error);
    }
});
// PUT /notifications/:id/read - Mark single notification as read
router.put('/:id/read', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        await (0, db_1.query)(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`, [id, userId]);
        return (0, response_1.sendSuccess)(res, { success: true }, 'Notification marked as read');
    }
    catch (error) {
        next(error);
    }
});
// PUT /notifications/read-all - Mark all as read
router.put('/read-all', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        await (0, db_1.query)(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL`, [userId]);
        return (0, response_1.sendSuccess)(res, { success: true }, 'All notifications marked as read');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
