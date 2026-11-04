import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../../config/db';
import { ENV } from '../../config/env';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
  username: z.string().regex(/^[a-z0-9_]{3,30}$/, 'Username must be 3-30 characters of lowercase letters, numbers, and underscores').optional(),
  phone: z.string().optional(),
  locality: z.string().optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

const generateToken = (user: { id: string; email: string; role: 'USER' | 'ADMIN'; name: string }) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generateUniqueUsername = async (email: string, name?: string): Promise<string> => {
  let base = (email ? email.split('@')[0] : (name || 'member'))
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (!base || base.length < 3) base = `user_${Date.now().toString(36)}`;
  base = base.slice(0, 24);

  let candidate = base;
  let counter = 1;
  while (true) {
    const existing = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [candidate]);
    if (existing.rows.length === 0) return candidate;
    candidate = `${base.slice(0, 18)}_${counter++}`;
  }
};

// Register
router.post('/register', async (req: Request, res: Response, next) => {
  try {
    const validated = registerSchema.parse(req.body);
    const email = validated.email.toLowerCase();
    const displayName = validated.name || email.split('@')[0];
    const locality = validated.locality || '';
    let cleanUsername = validated.username ? validated.username.trim().toLowerCase() : null;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return sendError(res, 'USER_EXISTS', 'An account with this email already exists', 409);
    }

    if (cleanUsername) {
      const existingUser = await query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
      if (existingUser.rows.length > 0) {
        return sendError(res, 'USERNAME_TAKEN', 'This username is already taken. Please choose another.', 409);
      }
    } else {
      cleanUsername = await generateUniqueUsername(email, displayName);
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);
    const defaultAvatar = validated.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(displayName)}`;

    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, phone, locality, avatar_url, bio, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USER')
       RETURNING id, username, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at`,
      [
        email,
        passwordHash,
        displayName,
        cleanUsername,
        validated.phone || null,
        locality,
        defaultAvatar,
        validated.bio || 'Member of the Rentu gear sharing community',
      ]
    );

    const user = result.rows[0];

    // Ensure user always has a unique username set
    if (!user.username) {
      const generated = await generateUniqueUsername(user.email, user.name);
      await query('UPDATE users SET username = $1 WHERE id = $2', [generated, user.id]);
      user.username = generated;
    }

    // Do NOT assume address: clear legacy assumed 'Bengaluru' if user never entered an address
    const hasConcreteAddress = Boolean(user.address_text && user.address_text.trim() && user.address_text.trim() !== 'Bengaluru, India');
    const hasConcreteSavedLocations = Array.isArray(user.saved_locations) && user.saved_locations.some((l: any) => l && (l.building_flat_house?.trim() || l.street_road_landmark?.trim()));
    if (!hasConcreteAddress && !hasConcreteSavedLocations && (user.locality?.toLowerCase() === 'bengaluru' || user.locality?.toLowerCase() === 'bengaluru, india' || user.locality?.toLowerCase() === 'bangalore')) {
      user.locality = '';
      await query('UPDATE users SET locality = NULL WHERE id = $1', [user.id]).catch(() => {});
    }

    const token = generateToken(user);

    return sendSuccess(res, { user, token }, 'Registration successful. Welcome to Rentu.', 201);
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const validated = loginSchema.parse(req.body);

    const result = await query(
      `SELECT id, email, password_hash, name, phone, locality, avatar_url, bio, trust_score, role, created_at
       FROM users WHERE email = $1`,
      [validated.email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const user = result.rows[0];

    // Ensure user always has a unique username set
    if (!user.username) {
      const generated = await generateUniqueUsername(user.email, user.name);
      await query('UPDATE users SET username = $1 WHERE id = $2', [generated, user.id]);
      user.username = generated;
    }

    // Do NOT assume address: clear legacy assumed 'Bengaluru' if user never entered an address
    const hasConcreteAddress = Boolean(user.address_text && user.address_text.trim() && user.address_text.trim() !== 'Bengaluru, India');
    const hasConcreteSavedLocations = Array.isArray(user.saved_locations) && user.saved_locations.some((l: any) => l && (l.building_flat_house?.trim() || l.street_road_landmark?.trim()));
    if (!hasConcreteAddress && !hasConcreteSavedLocations && (user.locality?.toLowerCase() === 'bengaluru' || user.locality?.toLowerCase() === 'bengaluru, india' || user.locality?.toLowerCase() === 'bangalore')) {
      user.locality = '';
      await query('UPDATE users SET locality = NULL WHERE id = $1', [user.id]).catch(() => {});
    }
    const isMatch = await bcrypt.compare(validated.password, user.password_hash);
    if (!isMatch) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);

    return sendSuccess(res, { user: safeUser, token }, 'Logged in successfully.');
  } catch (error) {
    next(error);
  }
});

// Demo login permanently disabled for security
router.post('/demo-login', async (req: Request, res: Response) => {
  return sendError(res, 'FORBIDDEN', 'Demo login has been permanently disabled for security.', 403);
});

const firebaseSyncSchema = z.object({
  firebaseUid: z.string().optional(),
  clerkId: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().optional(),
  locality: z.string().optional(),
  phone: z.string().optional(),
});

const ensureUserColumns = async () => {
  try {
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
      ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_rating NUMERIC(3, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_rating NUMERIC(3, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_rating NUMERIC(3, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_rating NUMERIC(3, 2) DEFAULT 0.00;
    `);
  } catch (err: any) {
    console.warn('ensureUserColumns notice:', err?.message || err);
  }
};

// Sync Firebase / SSO user with Rentu⁺ database
const handleSyncUser = async (req: Request, res: Response, next: any) => {
  try {
    const validated = firebaseSyncSchema.parse(req.body);
    const uid = validated.firebaseUid || validated.clerkId || `fb_${Date.now()}`;
    const email = validated.email.toLowerCase();
    const avatar = validated.avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(validated.name)}`;
    const locality = validated.locality || '';

    // 1. Look for existing user by firebase_uid, clerk_id or email
    let existing;
    try {
      existing = await query(
        `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
         FROM users WHERE firebase_uid = $1 OR clerk_id = $2 OR email = $3`,
        [uid, uid, email]
      );
    } catch (err: any) {
      if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
        await ensureUserColumns();
        existing = await query(
          `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, '[]'::jsonb AS saved_locations, created_at
           FROM users WHERE firebase_uid = $1 OR clerk_id = $2 OR email = $3`,
          [uid, uid, email]
        );
      } else {
        throw err;
      }
    }

    let user;
    if (existing.rows.length > 0) {
      let assignedUsername = existing.rows[0].username;
      if (!assignedUsername) {
        assignedUsername = await generateUniqueUsername(email, validated.name);
      }
      // Update existing user with firebase_uid and keep custom avatar if set
      try {
        const updated = await query(
          `UPDATE users
           SET firebase_uid = $1,
               username = COALESCE(username, $2),
               name = COALESCE(NULLIF($3, ''), name),
               avatar_url = COALESCE(avatar_url, NULLIF($4, '')),
               updated_at = NOW()
           WHERE id = $5
           RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at`,
          [uid, assignedUsername, validated.name, avatar, existing.rows[0].id]
        );
        user = updated.rows[0];
      } catch (err: any) {
        await ensureUserColumns();
        const updated = await query(
          `UPDATE users
           SET firebase_uid = $1,
               username = COALESCE(username, $2),
               name = COALESCE(NULLIF($3, ''), name),
               avatar_url = COALESCE(avatar_url, NULLIF($4, '')),
               updated_at = NOW()
           WHERE id = $5
           RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
          [uid, assignedUsername, validated.name, avatar, existing.rows[0].id]
        );
        user = { ...updated.rows[0], saved_locations: [] };
      }
    } else {
      // Create new user for this Firebase account
      const newUsername = await generateUniqueUsername(email, validated.name);
      try {
        const created = await query(
          `INSERT INTO users (id, firebase_uid, email, name, username, phone, locality, avatar_url, bio, trust_score, role)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 85, 'USER')
           RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at`,
          [
            uid,
            uid,
            email,
            validated.name,
            newUsername,
            validated.phone || null,
            locality,
            avatar,
            'Member of the Rentu gear sharing community',
          ]
        );
        user = created.rows[0];
      } catch (err: any) {
        await ensureUserColumns();
        const created = await query(
          `INSERT INTO users (id, firebase_uid, email, name, username, phone, locality, avatar_url, bio, trust_score, role)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 85, 'USER')
           RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
          [
            uid,
            uid,
            email,
            validated.name,
            newUsername,
            validated.phone || null,
            locality,
            avatar,
            'Member of the Rentu gear sharing community',
          ]
        );
        user = { ...created.rows[0], saved_locations: [] };
      }
    }

    // Do NOT assume address: clear legacy assumed 'Bengaluru' if user never entered an address
    const hasConcreteAddress = Boolean(user.address_text && user.address_text.trim() && user.address_text.trim() !== 'Bengaluru, India');
    const hasConcreteSavedLocations = Array.isArray(user.saved_locations) && user.saved_locations.some((l: any) => l && (l.building_flat_house?.trim() || l.street_road_landmark?.trim()));
    if (!hasConcreteAddress && !hasConcreteSavedLocations && (user.locality?.toLowerCase() === 'bengaluru' || user.locality?.toLowerCase() === 'bengaluru, india' || user.locality?.toLowerCase() === 'bangalore')) {
      user.locality = '';
      await query('UPDATE users SET locality = NULL WHERE id = $1', [user.id]).catch(() => {});
    }

    const token = generateToken(user);
    return sendSuccess(res, { user, token }, 'Account synchronized with Rentu.');
  } catch (error) {
    next(error);
  }
};

router.post('/firebase-sync', handleSyncUser);
router.post('/clerk-sync', handleSyncUser);

// Get Current Profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    let result: any;
    try {
      result = await query(
        `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, 
                COALESCE(trust_rating, 0.00)::numeric(3, 2) AS trust_rating,
                COALESCE(owner_rating, 0.00)::numeric(3, 2) AS owner_rating,
                COALESCE(renter_rating, 0.00)::numeric(3, 2) AS renter_rating,
                COALESCE(community_lender_rating, 0.00)::numeric(3, 2) AS community_lender_rating,
                COALESCE(owner_reviews_count, 0)::int AS owner_reviews_count,
                COALESCE(renter_reviews_count, 0)::int AS renter_reviews_count,
                COALESCE(community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
                (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = users.id::text OR reviewee_id = users.firebase_uid) AS reviews_count,
                COALESCE(rating, 0.00)::numeric(3, 2) AS rating, 
                avatar_url, banner_url, bio, trust_score, role,
                COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
         FROM users WHERE id = $1`,
        [req.user!.id]
      );

      if (result.rows.length > 0) {
        const u = result.rows[0];
        const revCount = parseInt(u.reviews_count, 10) || 0;
        if (revCount === 0) {
          u.rating = 0.0;
          u.trust_rating = 0.0;
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
        await ensureUserColumns();
        result = await query(
          `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, 
                  COALESCE(rating, 0.00)::numeric(3, 2) AS rating, 
                  avatar_url, banner_url, bio, trust_score, role, created_at
           FROM users WHERE id = $1`,
          [req.user!.id]
        );
        if (result.rows.length > 0) {
          result.rows[0].saved_locations = [];
          result.rows[0].trust_rating = 0.00;
          result.rows[0].owner_rating = 0.00;
          result.rows[0].renter_rating = 0.00;
          result.rows[0].community_lender_rating = 0.00;
          result.rows[0].owner_reviews_count = 0;
          result.rows[0].renter_reviews_count = 0;
          result.rows[0].community_lender_reviews_count = 0;
        }
      } else {
        throw err;
      }
    }

    if (result.rows.length === 0) {
      return sendError(res, 'USER_NOT_FOUND', 'User profile not found', 404);
    }

    const user = result.rows[0];

    // Ensure user always has a unique username set
    if (!user.username) {
      const generated = await generateUniqueUsername(user.email, user.name);
      await query('UPDATE users SET username = $1 WHERE id = $2', [generated, user.id]);
      user.username = generated;
    }

    // Do NOT assume address: clear legacy assumed 'Bengaluru' if user never entered an address
    const hasConcreteAddress = Boolean(user.address_text && user.address_text.trim() && user.address_text.trim() !== 'Bengaluru, India');
    const hasConcreteSavedLocations = Array.isArray(user.saved_locations) && user.saved_locations.some((l: any) => l && (l.building_flat_house?.trim() || l.street_road_landmark?.trim()));
    if (!hasConcreteAddress && !hasConcreteSavedLocations && (user.locality?.toLowerCase() === 'bengaluru' || user.locality?.toLowerCase() === 'bengaluru, india' || user.locality?.toLowerCase() === 'bangalore')) {
      user.locality = '';
      await query('UPDATE users SET locality = NULL WHERE id = $1', [user.id]).catch(() => {});
    }

    // Compute stats
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1) AS lent_count,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1) AS borrowed_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_rents,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`,
      [user.id]
    );

    return sendSuccess(res, {
      ...user,
      stats: statsResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
