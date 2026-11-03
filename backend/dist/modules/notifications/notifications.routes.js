"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const notifications_service_1 = require("./notifications.service");
const router = (0, express_1.Router)();
// GET /notifications - Get current user notifications
router.get('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Automatically check and generate active reminders for upcoming pickups and returns
        await (0, notifications_service_1.checkAndGenerateReminders)(userId).catch(err => {
            console.warn('Notification reminder check error:', err);
        });
        // Mark pending incoming messages as delivered to this active user
        await (0, db_1.query)(`WITH me AS (
        SELECT id::text AS id_text, firebase_uid FROM users WHERE id::text = $1::text OR firebase_uid = $1::text LIMIT 1
      )
      UPDATE messages
      SET is_delivered = true,
          delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
      WHERE (is_delivered = false OR is_delivered IS NULL)
        AND receiver_id IN (SELECT id_text FROM me UNION SELECT firebase_uid FROM me WHERE firebase_uid IS NOT NULL)`, [userId]).catch(() => { });
        const result = await (0, db_1.query)(`SELECT 
        n.id, 
        n.user_id, 
        n.type, 
        n.title, 
        n.body, 
        n.sender_id, 
        n.booking_id,
        n.message_id,
        n.reference_id, 
        n.reference_type, 
        n.read_at, 
        (n.read_at IS NOT NULL) AS is_read,
        n.created_at,
        COALESCE(u.name, 'Neighbor') AS sender_name,
        u.avatar_url AS sender_avatar,
        COALESCE(i.title, i_ref.title) AS item_title,
        COALESCE(
          CASE 
            WHEN jsonb_typeof(i.image_urls) = 'array' AND jsonb_array_length(i.image_urls) > 0 
            THEN i.image_urls->>0 
            ELSE NULL 
          END,
          CASE 
            WHEN jsonb_typeof(i_ref.image_urls) = 'array' AND jsonb_array_length(i_ref.image_urls) > 0 
            THEN i_ref.image_urls->>0 
            ELSE NULL 
          END
        ) AS item_image
       FROM notifications n
       LEFT JOIN users u ON (n.sender_id = u.id::text OR n.sender_id = u.firebase_uid)
       LEFT JOIN bookings b ON (n.booking_id = b.id OR (n.reference_type = 'BOOKING' AND n.reference_id::text = b.id::text))
       LEFT JOIN items i ON b.item_id = i.id
       LEFT JOIN items i_ref ON (n.reference_type = 'ITEM' AND n.reference_id::text = i_ref.id::text)
       WHERE n.user_id = $1
         AND n.type NOT IN ('ITEM_UNAVAILABLE', 'ITEM_AVAILABLE', 'BOOKING_PENDING')
         AND (n.body NOT LIKE 'You accepted%' AND n.body NOT LIKE 'You declined%')
       ORDER BY n.created_at DESC
       LIMIT 150`, [userId]);
        const unreadCountRes = await (0, db_1.query)(`SELECT COUNT(*)::int AS unread FROM notifications 
       WHERE user_id = $1 
         AND read_at IS NULL
         AND type NOT IN ('ITEM_UNAVAILABLE', 'ITEM_AVAILABLE', 'BOOKING_PENDING')
         AND (body NOT LIKE 'You accepted%' AND body NOT LIKE 'You declined%')`, [userId]);
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
