import { query } from '../../config/db';
import { sendPushNotification } from './webpush';

let schedulerInterval: NodeJS.Timeout | null = null;
let lastPurgeDate: string = '';

/**
 * Runs a platform-wide reminder check for all upcoming pickups and returns.
 * Guarantees offline users receive push reminders on schedule.
 */
export async function runGlobalReminderCycle(): Promise<void> {
  try {
    // 1. Upcoming Pickups across all users
    const upcomingPickups = await query(
      `SELECT 
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
       WHERE b.status = 'ACCEPTED'
         AND b.start_date IN (CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day')`
    );

    for (const b of upcomingPickups.rows) {
      const dayLabel = b.is_today ? 'today' : 'tomorrow';

      // Borrower reminder
      if (b.borrower_id) {
        const borrowerRes = await query(
          `INSERT INTO notifications (user_id, sender_id, type, title, body, booking_id, reference_id, reference_type)
           SELECT $1, $2, 'REMINDER_PICKUP', $3, $4, $5, $5, 'BOOKING'
           WHERE NOT EXISTS (
             SELECT 1 FROM notifications 
             WHERE (user_id = $1 OR user_id IN (SELECT firebase_uid FROM users WHERE id::text = $1))
               AND booking_id = $5 
               AND type = 'REMINDER_PICKUP'
               AND created_at >= CURRENT_DATE
           )
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            b.borrower_id,
            b.lender_id,
            `Pickup ${b.is_today ? 'Today' : 'Tomorrow'}`,
            `Pickup for "${b.item_title}" with ${b.lender_name || 'Lender'} is scheduled ${dayLabel}.`,
            b.id,
          ]
        ).catch(() => ({ rows: [] }));

        if (borrowerRes.rows.length > 0) {
          sendPushNotification(b.borrower_id, {
            title: `Pickup ${b.is_today ? 'Today' : 'Tomorrow'}`,
            body: `Pickup for "${b.item_title}" with ${b.lender_name || 'Lender'} is scheduled ${dayLabel}.`,
            type: 'REMINDER_PICKUP',
            bookingId: b.id,
          }).catch(() => {});
        }
      }

      // Lender reminder
      const lenderId = b.lender_id;
      if (lenderId) {
        const lenderRes = await query(
          `INSERT INTO notifications (user_id, sender_id, type, title, body, booking_id, reference_id, reference_type)
           SELECT $1, $2, 'REMINDER_PICKUP', $3, $4, $5, $5, 'BOOKING'
           WHERE NOT EXISTS (
             SELECT 1 FROM notifications 
             WHERE (user_id = $1 OR user_id IN (SELECT firebase_uid FROM users WHERE id::text = $1))
               AND booking_id = $5 
               AND type = 'REMINDER_PICKUP'
               AND created_at >= CURRENT_DATE
           )
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            lenderId,
            b.borrower_id,
            `Handover ${b.is_today ? 'Today' : 'Tomorrow'}`,
            `Handover for "${b.item_title}" with ${b.borrower_name || 'Borrower'} is scheduled ${dayLabel}.`,
            b.id,
          ]
        ).catch(() => ({ rows: [] }));

        if (lenderRes.rows.length > 0) {
          sendPushNotification(lenderId, {
            title: `Handover ${b.is_today ? 'Today' : 'Tomorrow'}`,
            body: `Handover for "${b.item_title}" with ${b.borrower_name || 'Borrower'} is scheduled ${dayLabel}.`,
            type: 'REMINDER_PICKUP',
            bookingId: b.id,
          }).catch(() => {});
        }
      }
    }

    // 2. Upcoming Returns across all users
    const upcomingReturns = await query(
      `SELECT 
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
       WHERE b.status = 'HANDED_OVER'
         AND COALESCE(b.end_date, (b.start_date + ((GREATEST(b.duration_days, 1) - 1) || ' days')::interval)::date)::date IN (CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day')`
    );

    for (const b of upcomingReturns.rows) {
      const dayLabel = b.is_today ? 'today' : 'tomorrow';

      // Borrower return reminder
      if (b.borrower_id) {
        const borrowerRes = await query(
          `INSERT INTO notifications (user_id, sender_id, type, title, body, booking_id, reference_id, reference_type)
           SELECT $1, $2, 'REMINDER_RETURN', $3, $4, $5, $5, 'BOOKING'
           WHERE NOT EXISTS (
             SELECT 1 FROM notifications 
             WHERE (user_id = $1 OR user_id IN (SELECT firebase_uid FROM users WHERE id::text = $1))
               AND booking_id = $5 
               AND type = 'REMINDER_RETURN'
               AND created_at >= CURRENT_DATE
           )
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            b.borrower_id,
            b.lender_id,
            `Return Due ${b.is_today ? 'Today' : 'Tomorrow'}`,
            `Return of "${b.item_title}" to ${b.lender_name || 'Owner'} is due ${dayLabel}. Ensure verification code is ready.`,
            b.id,
          ]
        ).catch(() => ({ rows: [] }));

        if (borrowerRes.rows.length > 0) {
          sendPushNotification(b.borrower_id, {
            title: `Return Due ${b.is_today ? 'Today' : 'Tomorrow'}`,
            body: `Return of "${b.item_title}" to ${b.lender_name || 'Owner'} is due ${dayLabel}.`,
            type: 'REMINDER_RETURN',
            bookingId: b.id,
          }).catch(() => {});
        }
      }

      // Lender return reminder
      const lenderId = b.lender_id;
      if (lenderId) {
        const lenderRes = await query(
          `INSERT INTO notifications (user_id, sender_id, type, title, body, booking_id, reference_id, reference_type)
           SELECT $1, $2, 'REMINDER_RETURN', $3, $4, $5, $5, 'BOOKING'
           WHERE NOT EXISTS (
             SELECT 1 FROM notifications 
             WHERE (user_id = $1 OR user_id IN (SELECT firebase_uid FROM users WHERE id::text = $1))
               AND booking_id = $5 
               AND type = 'REMINDER_RETURN'
               AND created_at >= CURRENT_DATE
           )
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            lenderId,
            b.borrower_id,
            `Return Expected ${b.is_today ? 'Today' : 'Tomorrow'}`,
            `"${b.item_title}" is scheduled to be returned ${dayLabel} by ${b.borrower_name || 'Borrower'}.`,
            b.id,
          ]
        ).catch(() => ({ rows: [] }));

        if (lenderRes.rows.length > 0) {
          sendPushNotification(lenderId, {
            title: `Return Expected ${b.is_today ? 'Today' : 'Tomorrow'}`,
            body: `"${b.item_title}" is scheduled to be returned ${dayLabel} by ${b.borrower_name || 'Borrower'}.`,
            type: 'REMINDER_RETURN',
            bookingId: b.id,
          }).catch(() => {});
        }
      }
    }

    // 3. Purge notifications older than 30 days once per calendar day
    const todayStr = new Date().toISOString().split('T')[0];
    if (lastPurgeDate !== todayStr) {
      lastPurgeDate = todayStr;
      await query(`DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days'`).catch(() => {});
    }
  } catch (err) {
    console.warn('Global reminder scheduler error:', err);
  }
}

/**
 * Initializes the background scheduler running every 20 minutes.
 */
export function startReminderScheduler(): void {
  if (schedulerInterval) return;

  // Run initial cycle shortly after boot
  setTimeout(() => {
    runGlobalReminderCycle().catch(() => {});
  }, 5000);

  // Recurring cycle every 20 minutes
  schedulerInterval = setInterval(() => {
    runGlobalReminderCycle().catch(() => {});
  }, 20 * 60 * 1000);

  console.log('Background reminder scheduler initialized (20m cadence).');
}

export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

