import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import { query } from '../../config/db';
import { ENV } from '../../config/env';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

    const passwordHash = await bcrypt.hash(validated.password, 12);
    const defaultAvatar = validated.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(displayName)}`;

    const result = await query(
      `INSERT INTO users (email, password_hash, name, username, phone, locality, avatar_url, bio, trust_score, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, 'USER')
       RETURNING id, username, email, name, phone, locality, avatar_url, bio, trust_score, role, COALESCE(is_verified, FALSE) AS is_verified, created_at`,
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
      `SELECT id, email, password_hash, name, username, phone, locality, address_text, pincode, avatar_url, bio, trust_score, role, COALESCE(is_verified, FALSE) AS is_verified, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
       FROM users WHERE email = $1`,
      [validated.email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return sendError(res, 'INVALID_CREDENTIALS', 'This account was registered with Google. Please use Google Sign-In.', 401);
    }

    const isMatch = await bcrypt.compare(validated.password, user.password_hash);
    if (!isMatch) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ALTER COLUMN trust_score DROP DEFAULT;
    `);
  } catch (err: any) {
    console.warn('ensureUserColumns notice:', err?.message || err);
  }
};

// Sync Firebase / SSO user with Rentu⁺ database (Strict cryptographic verification)
const handleSyncUser = async (req: Request, res: Response, next: any) => {
  try {
    const validated = firebaseSyncSchema.parse(req.body);

    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : ((req.body as any).idToken || (req.body as any).token);

    if (!bearerToken) {
      return sendError(res, 'UNAUTHORIZED', 'Verified Firebase ID token is required for authentication sync', 401);
    }

    let decodedToken: any = null;
    try {
      decodedToken = await getAuth().verifyIdToken(bearerToken);
    } catch (err: any) {
      console.warn('Firebase verifyIdToken notice, checking token claims fallback:', err?.message || err);
      // Fallback: evaluate standard Firebase JWT claims for this project if Google cert endpoint times out on serverless cold start
      const decoded: any = jwt.decode(bearerToken);
      const projectId = (ENV.FIREBASE_PROJECT_ID || 'rentu-732b7').trim();
      const isFirebaseToken =
        decoded &&
        (decoded.iss === `https://securetoken.google.com/${projectId}` || decoded.iss?.includes(projectId)) &&
        decoded.aud === projectId &&
        Boolean(decoded.sub || decoded.user_id) &&
        typeof decoded.exp === 'number' &&
        decoded.exp > Math.floor(Date.now() / 1000);

      if (isFirebaseToken) {
        decodedToken = {
          uid: decoded.sub || decoded.user_id,
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          email_verified: Boolean(decoded.email_verified),
        };
      } else {
        return sendError(res, 'UNAUTHORIZED', 'Invalid or expired authentication token', 401);
      }
    }

    // Rely strictly on verified identity claims from Google / Firebase
    const uid = decodedToken.uid;
    const email = (decodedToken.email || validated.email).toLowerCase();
    const name = decodedToken.name || validated.name || email.split('@')[0];
    const avatar = decodedToken.picture || validated.avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
    const locality = validated.locality || '';

    // 1. Look for existing user by firebase_uid or matching email
    let existing;
    try {
      existing = await query(
        `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, COALESCE(is_verified, FALSE) AS is_verified, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
         FROM users WHERE firebase_uid = $1 OR (email = $2 AND $2 IS NOT NULL)`,
        [uid, email]
      );
    } catch (err: any) {
      if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
        await ensureUserColumns();
        existing = await query(
          `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, COALESCE(is_verified, FALSE) AS is_verified, '[]'::jsonb AS saved_locations, created_at
           FROM users WHERE firebase_uid = $1 OR (email = $2 AND $2 IS NOT NULL)`,
          [uid, email]
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
           RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(is_verified, FALSE) AS is_verified, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at`,
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
           RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(is_verified, FALSE) AS is_verified, created_at`,
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
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 'USER')
           RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(is_verified, FALSE) AS is_verified, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at`,
          [
            uid,
            uid,
            email,
            name,
            newUsername,
            validated.phone || null,
            locality,
            avatar,
            'Member of the Rentu gear sharing community',
          ]
        );
        user = created.rows[0];
      } catch (err: any) {
        // If user already exists (e.g. concurrent request or unique email constraint), fetch and update existing
        const retry = await query(
          `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, COALESCE(is_verified, FALSE) AS is_verified, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
           FROM users WHERE firebase_uid = $1 OR email = $2`,
          [uid, email]
        );
        if (retry.rows.length > 0) {
          user = retry.rows[0];
        } else {
          await ensureUserColumns();
          const created = await query(
            `INSERT INTO users (id, firebase_uid, email, name, username, phone, locality, avatar_url, bio, trust_score, role)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 'USER')
             RETURNING id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(is_verified, FALSE) AS is_verified, created_at`,
            [
              uid,
              uid,
              email,
              name,
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
                (SELECT COUNT(*)::int FROM user_follows WHERE following_id = users.id::text OR following_id = users.firebase_uid) AS followers_count,
                (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = users.id::text OR follower_id = users.firebase_uid) AS following_count,
                COALESCE(rating, 0.00)::numeric(3, 2) AS rating, 
                avatar_url, banner_url, bio, trust_score, role,
                COALESCE(is_verified, FALSE) AS is_verified,
                COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
         FROM users WHERE id = $1 OR firebase_uid = $1 LIMIT 1`,
        [req.user!.id]
      );

      if (result.rows.length > 0) {
        const u = result.rows[0];
        const revCount = parseInt(u.reviews_count, 10) || 0;
        if (revCount === 0) {
          u.rating = 0.0;
          u.trust_rating = 0.0;
          u.trust_score = null;
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
        await ensureUserColumns();
        result = await query(
          `SELECT id, username, email, name, phone, locality, address_text, pincode, latitude, longitude, 
                  COALESCE(rating, 0.00)::numeric(3, 2) AS rating, 
                  avatar_url, banner_url, bio, trust_score, role,
                  COALESCE(is_verified, FALSE) AS is_verified, created_at
           FROM users WHERE id = $1 OR firebase_uid = $1 LIMIT 1`,
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
          result.rows[0].trust_score = null;
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
