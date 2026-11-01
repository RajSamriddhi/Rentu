"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
const createTicketSchema = zod_1.z.object({
    type: zod_1.z.enum(['CONCERN', 'FEEDBACK']),
    category: zod_1.z.string().min(1, 'Category is required'),
    subject: zod_1.z.string().min(3, 'Subject must be at least 3 characters'),
    description: zod_1.z.string().min(10, 'Please describe your concern or feedback in at least 10 characters'),
    priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
    user_email: zod_1.z.string().email().optional(),
});
const updateTicketSchema = zod_1.z.object({
    status: zod_1.z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']).optional(),
    priority: zod_1.z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    admin_notes: zod_1.z.string().optional(),
});
// 1. Submit Concern or Feedback
router.post('/', auth_1.optionalAuthMiddleware, async (req, res, next) => {
    try {
        const validated = createTicketSchema.parse(req.body);
        const userId = req.user?.id || null;
        const userName = req.user?.name || 'Community Member';
        const userEmail = validated.user_email || req.user?.email || 'unregistered@rentu.in';
        const insertRes = await (0, db_1.query)(`INSERT INTO support_tickets (user_id, user_name, user_email, type, category, subject, description, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')
       RETURNING *`, [
            userId,
            userName,
            userEmail,
            validated.type,
            validated.category,
            validated.subject,
            validated.description,
            validated.priority,
        ]);
        const ticket = insertRes.rows[0];
        // If user is authenticated, create an in-app confirmation notification
        if (userId) {
            await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
         VALUES ($1, NULL, 'SUPPORT_TICKET_RECEIVED', $2, $3, $4, 'SUPPORT')`, [
                userId,
                validated.type === 'CONCERN' ? 'Concern Received 🛡️' : 'Feedback Received 💡',
                `We have received your ${validated.type.toLowerCase()} regarding "${validated.subject}". Our admin team will review and resolve it promptly.`,
                ticket.id,
            ]).catch(() => { });
        }
        return (0, response_1.sendSuccess)(res, ticket, 'Your submission has been sent directly to the Rentu Admin Team.', 201);
    }
    catch (error) {
        next(error);
    }
});
// 2. Get User's Own Submitted Concerns & Feedback
router.get('/my', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await (0, db_1.query)(`SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// 3. Admin: Get All Concerns & Feedback (Restricted to Authorized Admins)
router.get('/admin', auth_1.adminMiddleware, async (req, res, next) => {
    try {
        const { status, type, category } = req.query;
        const params = [];
        let sql = `
      SELECT st.*, u.avatar_url AS user_avatar, u.phone AS user_phone, u.locality AS user_locality
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      WHERE 1=1
    `;
        if (status && status !== 'ALL') {
            params.push(status);
            sql += ` AND st.status = $${params.length}`;
        }
        if (type && type !== 'ALL') {
            params.push(type);
            sql += ` AND st.type = $${params.length}`;
        }
        if (category && category !== 'ALL') {
            params.push(category);
            sql += ` AND st.category = $${params.length}`;
        }
        sql += ` ORDER BY CASE WHEN st.status = 'OPEN' THEN 1 WHEN st.status = 'IN_REVIEW' THEN 2 ELSE 3 END, st.created_at DESC`;
        const result = await (0, db_1.query)(sql, params);
        return (0, response_1.sendSuccess)(res, result.rows);
    }
    catch (error) {
        next(error);
    }
});
// 4. Admin: Update Ticket Status & Admin Resolution Notes (Restricted to Authorized Admins)
router.put('/admin/:id', auth_1.adminMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = updateTicketSchema.parse(req.body);
        const ticketRes = await (0, db_1.query)(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
        if (ticketRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'Support ticket not found', 404);
        }
        const currentTicket = ticketRes.rows[0];
        const fields = [];
        const values = [];
        if (validated.status !== undefined) {
            values.push(validated.status);
            fields.push(`status = $${values.length}`);
            if (validated.status === 'RESOLVED') {
                fields.push(`resolved_at = CURRENT_TIMESTAMP`);
            }
        }
        if (validated.priority !== undefined) {
            values.push(validated.priority);
            fields.push(`priority = $${values.length}`);
        }
        if (validated.admin_notes !== undefined) {
            values.push(validated.admin_notes);
            fields.push(`admin_notes = $${values.length}`);
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const updateSql = `
      UPDATE support_tickets
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `;
        const result = await (0, db_1.query)(updateSql, values);
        const updated = result.rows[0];
        // Notify the user if ticket was resolved or updated with admin notes
        if (currentTicket.user_id && (validated.status === 'RESOLVED' || validated.admin_notes)) {
            const noteSnippet = validated.admin_notes ? `: "${validated.admin_notes}"` : '';
            await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, reference_id, reference_type)
         VALUES ($1, NULL, 'SUPPORT_TICKET_RESOLVED', $2, $3, $4, 'SUPPORT')`, [
                currentTicket.user_id,
                validated.status === 'RESOLVED' ? 'Concern Resolved ✅' : 'Support Update 💬',
                `Your ${currentTicket.type.toLowerCase()} regarding "${currentTicket.subject}" has been updated by the Admin team${noteSnippet}`,
                updated.id,
            ]).catch(() => { });
        }
        return (0, response_1.sendSuccess)(res, updated, 'Ticket updated successfully');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
