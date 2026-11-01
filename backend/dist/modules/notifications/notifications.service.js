"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.checkAndGenerateReminders = checkAndGenerateReminders;
const db_1 = require("../../config/db");
/**
 * Creates an in-app notification row in the PostgreSQL database.
 */
async function createNotification(params) {
    try {
        await (0, db_1.query)(`INSERT INTO notifications 
        (user_id, sender_id, type, title, body, booking_id, message_id, reference_id, reference_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            params.userId,
            params.senderId || null,
            params.type,
            params.title,
            params.body,
            params.bookingId || null,
            params.messageId || null,
            params.referenceId || null,
            params.referenceType || null,
        ]);
    }
    catch (error) {
        console.error('Failed to create notification:', error);
    }
}
/**
 * Checks for upcoming handoffs, returns, and generates timely reminder notifications.
 * Runs smoothly when notifications are fetched so users receive active alerts for today/tomorrow.
 */
async function checkAndGenerateReminders(userId) {
    try {
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
       JOIN users borrower ON b.borrower_id = borrower.id
       JOIN users lender ON i.owner_id = lender.id
       WHERE (b.borrower_id = $1 OR b.lender_id = $1)
         AND b.status = 'ACCEPTED'
         AND b.start_date IN (CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day')`, [userId]);
        for (const b of upcomingPickups.rows) {
            const alreadyNotified = await (0, db_1.query)(`SELECT id FROM notifications 
         WHERE user_id = $1 
           AND booking_id = $2 
           AND type = 'REMINDER_PICKUP'
           AND created_at >= CURRENT_DATE`, [userId, b.id]);
            if (alreadyNotified.rows.length === 0) {
                const isBorrower = b.borrower_id === userId;
                const dayLabel = b.is_today ? 'Today' : 'Tomorrow';
                await createNotification({
                    userId,
                    senderId: isBorrower ? b.lender_id : b.borrower_id,
                    bookingId: b.id,
                    referenceId: b.id,
                    referenceType: 'BOOKING',
                    type: 'REMINDER_PICKUP',
                    title: `⏰ Pickup ${dayLabel}!`,
                    body: isBorrower
                        ? `Your pickup for "${b.item_title}" is scheduled ${dayLabel.toLowerCase()} (${b.start_date} at ${b.start_time || '10:00'}). Have your 6-digit code ready!`
                        : `Handover for "${b.item_title}" with ${b.borrower_name} is scheduled ${dayLabel.toLowerCase()} (${b.start_date} at ${b.start_time || '10:00'}).`,
                });
            }
        }
        // 2. Return Reminders for HANDED_OVER bookings (due today or tomorrow)
        const upcomingReturns = await (0, db_1.query)(`SELECT 
        b.id, 
        b.borrower_id, 
        b.lender_id, 
        TO_CHAR(COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date), 'YYYY-MM-DD') AS end_date, 
        b.end_time, 
        i.title AS item_title,
        borrower.name AS borrower_name,
        lender.name AS lender_name,
        (COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date)::date = CURRENT_DATE) AS is_today
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users borrower ON b.borrower_id = borrower.id
       JOIN users lender ON i.owner_id = lender.id
       WHERE (b.borrower_id = $1 OR b.lender_id = $1)
         AND b.status = 'HANDED_OVER'
         AND COALESCE(b.end_date, (b.start_date + (b.duration_days || ' days')::interval)::date)::date IN (CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day')`, [userId]);
        for (const b of upcomingReturns.rows) {
            const alreadyNotified = await (0, db_1.query)(`SELECT id FROM notifications 
         WHERE user_id = $1 
           AND booking_id = $2 
           AND type = 'REMINDER_RETURN'
           AND created_at >= CURRENT_DATE`, [userId, b.id]);
            if (alreadyNotified.rows.length === 0) {
                const isBorrower = b.borrower_id === userId;
                const dayLabel = b.is_today ? 'Today' : 'Tomorrow';
                await createNotification({
                    userId,
                    senderId: isBorrower ? b.lender_id : b.borrower_id,
                    bookingId: b.id,
                    referenceId: b.id,
                    referenceType: 'BOOKING',
                    type: 'REMINDER_RETURN',
                    title: `⏰ Return Due ${dayLabel}!`,
                    body: isBorrower
                        ? `Your rental of "${b.item_title}" is due for return ${dayLabel.toLowerCase()} (${b.end_date} at ${b.end_time || '18:00'}). Meet ${b.lender_name} to verify exchange!`
                        : `Scheduled return collection for "${b.item_title}" from ${b.borrower_name} is ${dayLabel.toLowerCase()} (${b.end_date} at ${b.end_time || '18:00'}).`,
                });
            }
        }
    }
    catch (error) {
        console.error('Error generating notification reminders:', error);
    }
}
