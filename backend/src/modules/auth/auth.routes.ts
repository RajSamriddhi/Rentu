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
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  locality: z.string().min(2, 'Locality is required (e.g. Saket, Powai)'),
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

    const existing = await query('SELECT id FROM users WHERE email = $1', [validated.email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return sendError(res, 'USER_EXISTS', 'An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);
    const defaultAvatar = validated.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(validated.name)}`;

    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, locality, avatar_url, bio, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'USER')
       RETURNING id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at`,
      [
        validated.email.toLowerCase(),
        passwordHash,
        validated.name,
        validated.phone || null,
        validated.locality,
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

// Get Current Profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(
      `SELECT id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at
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
