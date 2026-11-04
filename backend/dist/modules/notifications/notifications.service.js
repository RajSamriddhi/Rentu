"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.checkAndGenerateReminders = checkAndGenerateReminders;
const db_1 = require("../../config/db");
const user_1 = require("../../utils/user");
const webpush_1 = require("./webpush");
/**
 * Creates an in-app notification row in the PostgreSQL database with retry protection
 * and automatically dispatches Web Push notifications.
 */
async function createNotification(params) {
    const userIds = await (0, user_1.resolveUserIds)(params.userId);
    const targetUserId = userIds[0] || params.userId;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await (0, db_1.query)(`INSERT INTO notifications 
          (user_id, sender_id, type, title, body, booking_id, message_id, reference_id, reference_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`, [
                targetUserId,
                params.senderId || null,
                params.type,
                params.title,
                params.body,
                params.bookingId || null,
                params.messageId || null,
                params.referenceId || null,
                params.referenceType || null,
            ]);
            // Asynchronously trigger Web Push without blocking caller
            (0, webpush_1.sendPushNotification)(userIds, params).catch((err) => {
                console.warn('Web Push async dispatch note:', err);
            });
            return { id: res.rows[0]?.id, success: true };
        }
        catch (error) {
            lastError = error;
            console.error(`createNotification attempt ${attempt + 1} failed:`, error);
        }
    }
    throw lastError || new Error('Failed to create notification');
}
/**
 * Checks for upcoming handoffs, returns, and generates timely reminder notifications.
 * Uses atomic INSERTs and uniqueness constraints to prevent duplicate reminders across concurrent requests.
 */
async function checkAndGenerateReminders(userId) {
    try {
        const userIds = await (0, user_1.resolveUserIds)(userId);
        // 1. Pickup Reminders for ACCEPTED bookings (scheduled for today or tomorrow)
        const upcomingPickups = await (0, db_1.query)(`SELECT 
        b.id, 
        b.borrower_id, 
        b.lender_id, 
        TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date, 
        b.start_time, 
        i.title AS item_title,
        borrower.name AS borrower_name,
        lender.name AS lender_name,
        (b.start_date = CURRENT_DATE) AS is_today
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
       LEFT JOIN users lender ON (i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid OR b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid)
       WHERE (b.borrower_id = ANY($1::text[]) OR b.lender_id = ANY($1::text[]) OR i.owner_id = ANY($1::text[]))
         AND b.status = 'ACCEPTED'
         AND b.start_date IN (CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day')`, [userIds]);
        for (const b of upcomingPickups.rows) {
            const isBorrower = userIds.includes(String(b.borrower_id));
            const dayLabel = b.is_today ? 'today' : 'tomorrow';
            const senderId = isBorrower ? b.lender_id : b.borrower_id;
            const title = `Pickup ${b.is_today ? 'Today' : 'Tomorrow'}`;
            const body = isBorrower
                ? `Pickup for "${b.item_title}" with ${b.lender_name || 'Lender'} is scheduled ${dayLabel}.`
                : `Handover for "${b.item_title}" with ${b.borrower_name || 'Borrower'} is scheduled ${dayLabel}.`;
            // Atomic check-and-insert to prevent concurrent duplicate inserts
            const insertRes = await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, booking_id, reference_id, reference_type)
         SELECT $1, $2, 'REMINDER_PICKUP', $3, $4, $5, $5, 'BOOKING'
         WHERE NOT EXISTS (
           SELECT 1 FROM notifications 
           WHERE user_id = ANY($6::text[]) 
             AND booking_id = $5 
             AND type = 'REMINDER_PICKUP'
             AND created_at >= CURRENT_DATE
         )
         ON CONFLICT DO NOTHING
         RETURNING id`, [userId, senderId, title, body, b.id, userIds]).catch(() => ({ rows: [] }));
            if (insertRes.rows.length > 0) {
                (0, webpush_1.sendPushNotification)(userIds, {
                    title,
                    body,
                    type: 'REMINDER_PICKUP',
                    bookingId: b.id,
                }).catch(() => { });
            }
        }
        // 2. Return Reminders for HANDED_OVER bookings (due today or tomorrow)
        const upcomingReturns = await (0, db_1.query)(`SELECT 
        b.id, 
        b.borrower_id, 
        b.lender_id, 
        TO_CHAR(COALESCE(b.end_date, (b.start_date + ((GREATEST(b.duration_days, 1) - 1) || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date, 
        b.end_time, 
        i.title AS item_title,
        borrower.name AS borrower_name,
        lender.name AS lender_name,
        (COALESCE(b.end_date, (b.start_date + ((GREATEST(b.duration_days, 1) - 1) || ' days')::interval)::date)::date = CURRENT_DATE) AS is_today
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
       LEFT JOIN users lender ON (i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid OR b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid)
       WHERE (b.borrower_id = ANY($1::text[]) OR b.lender_id = ANY($1::text[]) OR i.owner_id = ANY($1::text[]))
         AND b.status = 'HANDED_OVER'
         AND COALESCE(b.end_date, (b.start_date + ((GREATEST(b.duration_days, 1) - 1) || ' days')::interval)::date)::date IN (CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day')`, [userIds]);
        for (const b of upcomingReturns.rows) {
            const isBorrower = userIds.includes(String(b.borrower_id));
            const dayLabel = b.is_today ? 'today' : 'tomorrow';
            const senderId = isBorrower ? b.lender_id : b.borrower_id;
            const title = `Return Due ${b.is_today ? 'Today' : 'Tomorrow'}`;
            const body = isBorrower
                ? `Return for "${b.item_title}" to ${b.lender_name || 'Owner'} is due ${dayLabel}.`
                : `Scheduled return for "${b.item_title}" from ${b.borrower_name || 'Borrower'} is ${dayLabel}.`;
            // Atomic check-and-insert to prevent concurrent duplicate inserts
            const insertRes = await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body, booking_id, reference_id, reference_type)
         SELECT $1, $2, 'REMINDER_RETURN', $3, $4, $5, $5, 'BOOKING'
         WHERE NOT EXISTS (
           SELECT 1 FROM notifications 
           WHERE user_id = ANY($6::text[]) 
             AND booking_id = $5 
             AND type = 'REMINDER_RETURN'
             AND created_at >= CURRENT_DATE
         )
         ON CONFLICT DO NOTHING
         RETURNING id`, [userId, senderId, title, body, b.id, userIds]).catch(() => ({ rows: [] }));
            if (insertRes.rows.length > 0) {
                (0, webpush_1.sendPushNotification)(userIds, {
                    title,
                    body,
                    type: 'REMINDER_RETURN',
                    bookingId: b.id,
                }).catch(() => { });
            }
        }
    }
    catch (error) {
        console.error('Error generating notification reminders:', error);
    }
}
