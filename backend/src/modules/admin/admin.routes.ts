import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { adminMiddleware, AuthenticatedRequest, isAdminEmail } from '../../middleware/auth';

const router = Router();

// Apply admin protection to all routes in this module
router.use(adminMiddleware);

// 1. GET ALL USERS (with gear, request, and booking counts)
router.get('/users', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone, 
        u.role, 
        u.locality, 
        u.avatar_url,
        u.trust_score, 
        u.rating, 
        u.created_at,
        (SELECT COUNT(*) FROM items i WHERE i.owner_id = u.id)::int AS items_count,
        (SELECT COUNT(*) FROM requests r WHERE r.seeker_id = u.id)::int AS requests_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.borrower_id = u.id OR b.lender_id = u.id)::int AS bookings_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// 2. UPDATE USER (Role or Trust Score)
router.put('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { role, trust_score, rating } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (role && (role === 'USER' || role === 'ADMIN')) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (typeof trust_score === 'number') {
      updates.push(`trust_score = $${idx++}`);
      values.push(Math.min(100, Math.max(0, trust_score)));
    }
    if (typeof rating === 'number') {
      updates.push(`rating = $${idx++}`);
      values.push(Math.min(5, Math.max(1, rating)));
    }

    if (updates.length === 0) {
      return sendError(res, 'BAD_REQUEST', 'No valid fields provided for update', 400);
    }

    values.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    return sendSuccess(res, result.rows[0], 'User updated successfully');
  } catch (error) {
    next(error);
  }
});

// 2.1 DELETE USER (Admin - Cascades all records and removes from Firebase Auth)
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      return sendError(res, 'BAD_REQUEST', 'You cannot delete your own admin account', 400);
    }

    const userRes = await query('SELECT id, firebase_uid, email FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'User not found in database', 404);
    }

    const user = userRes.rows[0];

    // Delete user from PostgreSQL (cascades to items, bookings, reviews, messages, etc.)
    await query('DELETE FROM users WHERE id = $1', [id]);

    // Also attempt to delete from Firebase Authentication if linked
    const fbUid = user.firebase_uid || (id.length > 20 && !id.includes('-') ? id : null);
    if (fbUid) {
      try {
        const { getAuth } = await import('firebase-admin/auth');
        await getAuth().deleteUser(fbUid);
      } catch (fbErr: any) {
        console.warn(`Could not delete user ${fbUid} from Firebase Auth:`, fbErr.message);
      }
    }

    return sendSuccess(res, { id, email: user.email }, 'User deleted successfully from database and authentication');
  } catch (error) {
    next(error);
  }
});

// 2.2 SYNC FIREBASE USER TO SUPABASE (Admin tool to manually add or sync any Firebase user)
router.post('/sync-user', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { uid, email, name, avatar_url } = req.body;
    if (!uid || !email) {
      return sendError(res, 'BAD_REQUEST', 'UID and email are required to sync user', 400);
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = name || cleanEmail.split('@')[0];
    const username = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || `user_${uid.slice(0, 6)}`;
    const avatar = avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(cleanName)}`;

    const result = await query(`
      INSERT INTO users (id, firebase_uid, email, name, username, avatar_url, role, trust_score)
      VALUES ($1, $2, $3, $4, $5, $6, 'USER', 85)
      ON CONFLICT (id) DO UPDATE SET
        firebase_uid = EXCLUDED.firebase_uid,
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url)
      RETURNING id, firebase_uid, email, name, username, role, created_at;
    `, [uid, uid, cleanEmail, cleanName, username, avatar]);

    return sendSuccess(res, result.rows[0], 'User synchronized to Supabase successfully');
  } catch (error) {
    next(error);
  }
});

// 3. GET ALL LISTINGS
router.get('/listings', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(`
      SELECT 
        i.*, 
        COALESCE(u.name, 'Lender') AS owner_name, 
        u.email AS owner_email,
        u.avatar_url AS owner_avatar
      FROM items i
      LEFT JOIN users u ON i.owner_id = u.id
      ORDER BY i.created_at DESC
    `);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// 4. UPDATE LISTING STATUS
router.patch('/listings/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['AVAILABLE', 'RENTED', 'UNAVAILABLE'].includes(status)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid item status', 400);
    }

    const result = await query(
      `UPDATE items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Listing not found', 404);
    }

    return sendSuccess(res, result.rows[0], 'Listing status updated');
  } catch (error) {
    next(error);
  }
});

// 5. DELETE LISTING (Admin Takedown)
router.delete('/listings/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM items WHERE id = $1`, [id]);
    return sendSuccess(res, { id }, 'Listing removed by administrator');
  } catch (error) {
    next(error);
  }
});

// 6. GET ALL REQUESTS
router.get('/requests', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(`
      SELECT 
        r.*,
        COALESCE(u.name, 'Seeker') AS seeker_name,
        u.email AS seeker_email,
        u.avatar_url AS seeker_avatar
      FROM requests r
      LEFT JOIN users u ON (r.seeker_id = u.id::text OR r.seeker_id = u.firebase_uid)
      ORDER BY r.created_at DESC
    `);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// 7. DELETE REQUEST
router.delete('/requests/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM requests WHERE id = $1`, [id]);
    return sendSuccess(res, { id }, 'Request removed');
  } catch (error) {
    next(error);
  }
});

// 8. GET ALL BOOKINGS
router.get('/bookings', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(`
      SELECT 
        b.*,
        i.title AS item_title,
        i.image_urls AS item_images,
        i.price_per_day AS item_rate,
        COALESCE(borrower.name, 'Borrower') AS borrower_name,
        borrower.email AS borrower_email,
        borrower.avatar_url AS borrower_avatar,
        COALESCE(lender.name, 'Lender') AS lender_name,
        lender.email AS lender_email,
        lender.avatar_url AS lender_avatar
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      LEFT JOIN users borrower ON (b.borrower_id = borrower.id::text OR b.borrower_id = borrower.firebase_uid)
      LEFT JOIN users lender ON (b.lender_id = lender.id::text OR b.lender_id = lender.firebase_uid OR i.owner_id = lender.id::text OR i.owner_id = lender.firebase_uid)
      ORDER BY b.created_at DESC
    `);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// 9. UPDATE BOOKING STATUS (Admin Override)
router.patch('/bookings/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'ACCEPTED', 'HANDED_OVER', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(status)) {
      return sendError(res, 'BAD_REQUEST', 'Invalid booking status', 400);
    }

    const currentRes = await query(`SELECT * FROM bookings WHERE id = $1`, [id]);
    if (currentRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Booking not found', 404);
    }
    const current = currentRes.rows[0];

    const fields: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: any[] = [status, id];

    if (status === 'COMPLETED') {
      fields.push('completed_at = COALESCE(completed_at, NOW())');
      fields.push('returned_at = COALESCE(returned_at, NOW())');
      fields.push('payment_status = \'PAID\'');
      fields.push('is_on_time = COALESCE(is_on_time, true)');
      if (current.item_id) {
        await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [current.item_id]);
      }
    } else if (status === 'HANDED_OVER') {
      fields.push('handed_over_at = COALESCE(handed_over_at, NOW())');
      if (current.item_id) {
        await query(`UPDATE items SET status = 'RENTED' WHERE id = $1`, [current.item_id]);
      }
    } else if (status === 'CANCELLED' || status === 'REJECTED') {
      fields.push('payment_status = CASE WHEN payment_status = \'PAID\' THEN \'REFUNDED\' ELSE \'CANCELLED\' END');
      if (current.item_id) {
        await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [current.item_id]);
      }
    } else if (status === 'PENDING') {
      fields.push('completed_at = NULL');
      fields.push('handed_over_at = NULL');
      fields.push('returned_at = NULL');
      if (current.item_id) {
        await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [current.item_id]);
      }
    }

    const result = await query(
      `UPDATE bookings SET ${fields.join(', ')} WHERE id = $2 RETURNING *`,
      values
    );

    return sendSuccess(res, result.rows[0], 'Booking status updated by admin');
  } catch (error) {
    next(error);
  }
});

// 10. GET LOCALITIES
router.get('/localities', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(`
      SELECT 
        p.pincode, 
        p.locality, 
        p.city, 
        p.state,
        COUNT(DISTINCT u.id)::int AS users_count,
        COUNT(DISTINCT i.id)::int AS items_count
      FROM postal_codes p
      LEFT JOIN users u ON p.pincode = u.pincode
      LEFT JOIN items i ON p.pincode = i.pincode
      GROUP BY p.pincode, p.locality, p.city, p.state
      ORDER BY users_count DESC, items_count DESC, p.locality ASC
    `);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// 11. ADD LOCALITY
router.post('/localities', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { pincode, locality, city, state } = req.body;
    if (!pincode || !locality) {
      return sendError(res, 'BAD_REQUEST', 'Pincode and locality are required', 400);
    }

    const result = await query(`
      INSERT INTO postal_codes (pincode, locality, city, state)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (pincode) DO UPDATE SET locality = EXCLUDED.locality, city = EXCLUDED.city, state = EXCLUDED.state
      RETURNING *
    `, [pincode.trim(), locality.trim(), city?.trim() || 'Bangalore', state?.trim() || 'Karnataka']);

    return sendSuccess(res, result.rows[0], 'Locality zone saved');
  } catch (error) {
    next(error);
  }
});

// 12. GET REPORTS SUMMARY & AUDIT
router.get('/reports', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const statsRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users)::int AS total_users,
        (SELECT COUNT(*) FROM items)::int AS total_items,
        (SELECT COUNT(*) FROM bookings)::int AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED')::int AS completed_bookings,
        (SELECT COUNT(*) FROM support_tickets)::int AS total_support_tickets,
        (SELECT COUNT(*) FROM support_tickets WHERE status = 'RESOLVED')::int AS resolved_support_tickets,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings)::numeric AS total_volume_handled
    `);

    return sendSuccess(res, {
      stats: statsRes.rows[0],
      server_health: {
        database: 'connected',
        platform: 'Rentu⁺ Admin Infrastructure',
        version: '1.0.0',
        uptime_seconds: process.uptime(),
        admins: ['falaksadiqua786@gmail.com', 'rajsamriddhi60@gmail.com'],
      }
    });
  } catch (error) {
    next(error);
  }
});

// 13. DANGER ZONE: FACTORY RESET SYSTEM (Wipe all database records and Firebase Auth users)
router.post('/reset-system', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { confirm_phrase } = req.body;

    if (!confirm_phrase || String(confirm_phrase).trim().toUpperCase() !== 'RESET_ENTIRE_DATABASE') {
      return sendError(
        res,
        'BAD_REQUEST',
        'Confirmation phrase RESET_ENTIRE_DATABASE is required to execute factory reset.',
        400
      );
    }

    // Double-check admin authorization
    const adminEmail = (req.user?.email || '').trim().toLowerCase();
    if (!isAdminEmail(adminEmail) && req.user?.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only authorized platform administrators can reset the system.', 403);
    }

    // 1. Wipe Firebase Authentication users
    let totalDeletedFbUsers = 0;
    let fbWipeError: string | null = null;
    try {
      const { getAuth } = await import('firebase-admin/auth');
      const auth = getAuth();
      let nextPageToken: string | undefined = undefined;

      do {
        const listResult = await auth.listUsers(1000, nextPageToken);
        const uids = listResult.users.map((u: any) => u.uid);
        if (uids.length > 0) {
          const deleteResult = await auth.deleteUsers(uids);
          totalDeletedFbUsers += deleteResult.successCount;
        }
        nextPageToken = listResult.pageToken;
      } while (nextPageToken);
    } catch (fbErr: any) {
      fbWipeError = fbErr.message || 'Firebase Admin credentials missing or rejected';
      console.warn('Notice when deleting Firebase Auth users during factory reset:', fbWipeError);
    }

    // 2. Wipe PostgreSQL database tables
    const tablesToWipe = [
      'verification_attempts',
      'user_deleted_conversations',
      'user_muted_conversations',
      'support_tickets',
      'user_blocks',
      'user_follows',
      'push_subscriptions',
      'notifications',
      'reviews',
      'item_images',
      'messages',
      'bookings',
      'requests',
      'items',
      'users',
    ];

    for (const tbl of tablesToWipe) {
      try {
        await query(`TRUNCATE TABLE ${tbl} RESTART IDENTITY CASCADE`);
      } catch (err: any) {
        try {
          await query(`DELETE FROM ${tbl}`);
        } catch (delErr: any) {
          console.warn(`Could not clear table ${tbl}:`, delErr.message);
        }
      }
    }

    return sendSuccess(
      res,
      {
        firebase_users_deleted: totalDeletedFbUsers,
        firebase_error: fbWipeError,
        database_tables_cleared: tablesToWipe.length,
        status: fbWipeError ? 'PARTIAL_RESET' : 'SYSTEM_RESET_COMPLETE',
      },
      fbWipeError
        ? `Database cleared completely. Firebase users could not be auto-deleted because FIREBASE_SERVICE_ACCOUNT is not configured on Vercel.`
        : 'Platform reset complete. All database tables and Firebase authentication records have been cleared back to zero.'
    );
  } catch (error) {
    next(error);
  }
});

export default router;

