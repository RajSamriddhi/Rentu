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

// Register
router.post('/register', async (req: Request, res: Response, next) => {
  try {
    const validated = registerSchema.parse(req.body);
    const email = validated.email.toLowerCase();
    const displayName = validated.name || email.split('@')[0];
    const locality = validated.locality || 'Saket, New Delhi';

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return sendError(res, 'USER_EXISTS', 'An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);
    const defaultAvatar = validated.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(displayName)}`;

    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, locality, avatar_url, bio, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'USER')
       RETURNING id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at`,
      [
        email,
        passwordHash,
        displayName,
        validated.phone || null,
        locality,
        defaultAvatar,
        validated.bio || 'New member of the Rentu⁺ gear rental network ⚡',
      ]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    return sendSuccess(res, { user, token }, 'Registration successful! Welcome to Rentu⁺ 🚀', 201);
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
    const isMatch = await bcrypt.compare(validated.password, user.password_hash);
    if (!isMatch) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);

    return sendSuccess(res, { user: safeUser, token }, 'Logged in successfully! 🚀');
  } catch (error) {
    next(error);
  }
});

// Quick Demo Login for instant evaluation
router.post('/demo-login', async (req: Request, res: Response, next) => {
  try {
    const { role = 'lender' } = req.body;
    let targetEmail = 'rohit@lens.com'; // default lender
    if (role === 'borrower') targetEmail = 'ananya@studio.com';
    if (role === 'admin') targetEmail = 'admin@borrowflex.com';
    if (role === 'creator') targetEmail = 'kabir@vibes.com';

    const result = await query(
      `SELECT id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at
       FROM users WHERE email = $1`,
      [targetEmail]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'USER_NOT_FOUND', 'Demo user not seeded yet', 404);
    }

    const user = result.rows[0];
    const token = generateToken(user);
    return sendSuccess(res, { user, token }, `Demo logged in as ${user.name}`);
  } catch (error) {
    next(error);
  }
});

const clerkSyncSchema = z.object({
  clerkId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().optional(),
  locality: z.string().optional(),
  phone: z.string().optional(),
});

// Sync Clerk user with Rentu⁺ database
router.post('/clerk-sync', async (req: Request, res: Response, next) => {
  try {
    const validated = clerkSyncSchema.parse(req.body);
    const email = validated.email.toLowerCase();
    const avatar = validated.avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(validated.name)}`;
    const locality = validated.locality || 'Saket, New Delhi';

    // 1. Look for existing user by clerk_id or email
    const existing = await query(
      `SELECT id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, clerk_id, created_at
       FROM users WHERE clerk_id = $1 OR email = $2`,
      [validated.clerkId, email]
    );

    let user;
    if (existing.rows.length > 0) {
      // Update existing user with clerk_id and keep custom avatar if set
      const updated = await query(
        `UPDATE users
         SET clerk_id = $1,
             name = COALESCE(NULLIF($2, ''), name),
             avatar_url = COALESCE(avatar_url, NULLIF($3, '')),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
        [validated.clerkId, validated.name, avatar, existing.rows[0].id]
      );
      user = updated.rows[0];
    } else {
      // Create new user for this Clerk account
      const created = await query(
        `INSERT INTO users (clerk_id, email, name, phone, locality, avatar_url, bio, trust_score, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 85, 'USER')
         RETURNING id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
        [
          validated.clerkId,
          email,
          validated.name,
          validated.phone || null,
          locality,
          avatar,
          'Member of the Rentu⁺ gear rental community ⚡',
        ]
      );
      user = created.rows[0];
    }

    const token = generateToken(user);
    return sendSuccess(res, { user, token }, 'Clerk session synchronized with Rentu⁺! 🚀');
  } catch (error) {
    next(error);
  }
});


// Get Current Profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(
      `SELECT id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'USER_NOT_FOUND', 'User profile not found', 404);
    }

    const user = result.rows[0];

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
