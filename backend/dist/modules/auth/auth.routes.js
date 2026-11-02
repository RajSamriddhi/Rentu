"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const env_1 = require("../../config/env");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address format'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    name: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    locality: zod_1.z.string().optional(),
    avatar_url: zod_1.z.string().url().optional(),
    bio: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const generateToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
    }, env_1.ENV.JWT_SECRET, { expiresIn: '7d' });
};
// Register
router.post('/register', async (req, res, next) => {
    try {
        const validated = registerSchema.parse(req.body);
        const email = validated.email.toLowerCase();
        const displayName = validated.name || email.split('@')[0];
        const locality = validated.locality || '';
        const existing = await (0, db_1.query)('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return (0, response_1.sendError)(res, 'USER_EXISTS', 'An account with this email already exists', 409);
        }
        const passwordHash = await bcryptjs_1.default.hash(validated.password, 10);
        const defaultAvatar = validated.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(displayName)}`;
        const result = await (0, db_1.query)(`INSERT INTO users (email, password_hash, name, phone, locality, avatar_url, bio, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'USER')
       RETURNING id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at`, [
            email,
            passwordHash,
            displayName,
            validated.phone || null,
            locality,
            defaultAvatar,
            validated.bio || 'New member of the Rentu⁺ gear rental network ⚡',
        ]);
        const user = result.rows[0];
        const token = generateToken(user);
        return (0, response_1.sendSuccess)(res, { user, token }, 'Registration successful! Welcome to Rentu⁺ 🚀', 201);
    }
    catch (error) {
        next(error);
    }
});
// Login
router.post('/login', async (req, res, next) => {
    try {
        const validated = loginSchema.parse(req.body);
        const result = await (0, db_1.query)(`SELECT id, email, password_hash, name, phone, locality, avatar_url, bio, trust_score, role, created_at
       FROM users WHERE email = $1`, [validated.email.toLowerCase()]);
        if (result.rows.length === 0) {
            return (0, response_1.sendError)(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
        }
        const user = result.rows[0];
        const isMatch = await bcryptjs_1.default.compare(validated.password, user.password_hash);
        if (!isMatch) {
            return (0, response_1.sendError)(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
        }
        const { password_hash, ...safeUser } = user;
        const token = generateToken(safeUser);
        return (0, response_1.sendSuccess)(res, { user: safeUser, token }, 'Logged in successfully! 🚀');
    }
    catch (error) {
        next(error);
    }
});
// Demo login permanently disabled for security
router.post('/demo-login', async (req, res) => {
    return (0, response_1.sendError)(res, 'FORBIDDEN', 'Demo login has been permanently disabled for security.', 403);
});
const firebaseSyncSchema = zod_1.z.object({
    firebaseUid: zod_1.z.string().optional(),
    clerkId: zod_1.z.string().optional(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().min(1),
    avatarUrl: zod_1.z.string().optional(),
    locality: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
});
const ensureUserColumns = async () => {
    try {
        await (0, db_1.query)(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_rating NUMERIC(3, 2) DEFAULT 5.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_rating NUMERIC(3, 2) DEFAULT 5.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_rating NUMERIC(3, 2) DEFAULT 5.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_rating NUMERIC(3, 2) DEFAULT 5.00;
    `);
    }
    catch (err) {
        console.warn('ensureUserColumns notice:', err?.message || err);
    }
};
// Sync Firebase / SSO user with Rentu⁺ database
const handleSyncUser = async (req, res, next) => {
    try {
        const validated = firebaseSyncSchema.parse(req.body);
        const uid = validated.firebaseUid || validated.clerkId || `fb_${Date.now()}`;
        const email = validated.email.toLowerCase();
        const avatar = validated.avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(validated.name)}`;
        const locality = validated.locality || '';
        // 1. Look for existing user by firebase_uid, clerk_id or email
        let existing;
        try {
            existing = await (0, db_1.query)(`SELECT id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
         FROM users WHERE firebase_uid = $1 OR clerk_id = $2 OR email = $3`, [uid, uid, email]);
        }
        catch (err) {
            if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
                await ensureUserColumns();
                existing = await (0, db_1.query)(`SELECT id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, '[]'::jsonb AS saved_locations, created_at
           FROM users WHERE firebase_uid = $1 OR clerk_id = $2 OR email = $3`, [uid, uid, email]);
            }
            else {
                throw err;
            }
        }
        let user;
        if (existing.rows.length > 0) {
            // Update existing user with firebase_uid and keep custom avatar if set
            try {
                const updated = await (0, db_1.query)(`UPDATE users
           SET firebase_uid = $1,
               name = COALESCE(NULLIF($2, ''), name),
               avatar_url = COALESCE(avatar_url, NULLIF($3, '')),
               updated_at = NOW()
           WHERE id = $4
           RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at`, [uid, validated.name, avatar, existing.rows[0].id]);
                user = updated.rows[0];
            }
            catch (err) {
                await ensureUserColumns();
                const updated = await (0, db_1.query)(`UPDATE users
           SET firebase_uid = $1,
               name = COALESCE(NULLIF($2, ''), name),
               avatar_url = COALESCE(avatar_url, NULLIF($3, '')),
               updated_at = NOW()
           WHERE id = $4
           RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, created_at`, [uid, validated.name, avatar, existing.rows[0].id]);
                user = { ...updated.rows[0], saved_locations: [] };
            }
        }
        else {
            // Create new user for this Firebase account
            try {
                const created = await (0, db_1.query)(`INSERT INTO users (id, firebase_uid, email, name, phone, locality, avatar_url, bio, trust_score, role)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 85, 'USER')
           RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at`, [
                    uid,
                    uid,
                    email,
                    validated.name,
                    validated.phone || null,
                    locality,
                    avatar,
                    'Member of the Rentu⁺ gear rental community ⚡',
                ]);
                user = created.rows[0];
            }
            catch (err) {
                await ensureUserColumns();
                const created = await (0, db_1.query)(`INSERT INTO users (id, firebase_uid, email, name, phone, locality, avatar_url, bio, trust_score, role)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 85, 'USER')
           RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, created_at`, [
                    uid,
                    uid,
                    email,
                    validated.name,
                    validated.phone || null,
                    locality,
                    avatar,
                    'Member of the Rentu⁺ gear rental community ⚡',
                ]);
                user = { ...created.rows[0], saved_locations: [] };
            }
        }
        const token = generateToken(user);
        return (0, response_1.sendSuccess)(res, { user, token }, 'Firebase session synchronized with Rentu⁺! 🚀');
    }
    catch (error) {
        next(error);
    }
};
router.post('/firebase-sync', handleSyncUser);
router.post('/clerk-sync', handleSyncUser);
// Get Current Profile
router.get('/me', auth_1.authMiddleware, async (req, res, next) => {
    try {
        let result;
        try {
            result = await (0, db_1.query)(`SELECT id, email, name, phone, locality, address_text, pincode, latitude, longitude, 
                COALESCE(trust_rating, rating, 5.00)::numeric(3, 2) AS trust_rating,
                COALESCE(owner_rating, 5.00)::numeric(3, 2) AS owner_rating,
                COALESCE(renter_rating, 5.00)::numeric(3, 2) AS renter_rating,
                COALESCE(community_lender_rating, 5.00)::numeric(3, 2) AS community_lender_rating,
                COALESCE(owner_reviews_count, 0)::int AS owner_reviews_count,
                COALESCE(renter_reviews_count, 0)::int AS renter_reviews_count,
                COALESCE(community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
                COALESCE(rating, 5.00)::numeric(3, 2) AS rating, 
                avatar_url, banner_url, bio, trust_score, role,
                COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
         FROM users WHERE id = $1`, [req.user.id]);
        }
        catch (err) {
            if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
                await ensureUserColumns();
                result = await (0, db_1.query)(`SELECT id, email, name, phone, locality, address_text, pincode, latitude, longitude, 
                  COALESCE(rating, 5.00)::numeric(3, 2) AS rating, 
                  avatar_url, banner_url, bio, trust_score, role, created_at
           FROM users WHERE id = $1`, [req.user.id]);
                if (result.rows.length > 0) {
                    result.rows[0].saved_locations = [];
                    result.rows[0].trust_rating = result.rows[0].rating;
                    result.rows[0].owner_rating = 5.00;
                    result.rows[0].renter_rating = 5.00;
                    result.rows[0].community_lender_rating = 5.00;
                    result.rows[0].owner_reviews_count = 0;
                    result.rows[0].renter_reviews_count = 0;
                    result.rows[0].community_lender_reviews_count = 0;
                }
            }
            else {
                throw err;
            }
        }
        if (result.rows.length === 0) {
            return (0, response_1.sendError)(res, 'USER_NOT_FOUND', 'User profile not found', 404);
        }
        const user = result.rows[0];
        // Compute stats
        const statsResult = await (0, db_1.query)(`SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1) AS lent_count,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1) AS borrowed_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_rents,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`, [user.id]);
        return (0, response_1.sendSuccess)(res, {
            ...user,
            stats: statsResult.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
