"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.adminMiddleware = exports.isAdminEmail = exports.AUTHORIZED_ADMIN_EMAILS = exports.optionalAuthMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const db_1 = require("../config/db");
const response_1 = require("./response");
async function resolveUserFromToken(token) {
    // 1. Try local Rentu⁺ JWT first
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        if (decoded && decoded.id) {
            // Verify user in database or match by email
            const checkRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE id = $1 OR (email = $2 AND email IS NOT NULL)', [decoded.id, decoded.email || '']);
            if (checkRes.rows.length > 0) {
                const u = checkRes.rows[0];
                return { id: u.id, email: u.email, role: u.role, name: u.name };
            }
            // Auto-insert user into DB if not found so foreign key joins succeed
            await (0, db_1.query)(`
        INSERT INTO users (id, name, email, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
      `, [decoded.id, decoded.name || 'User', decoded.email || `${decoded.id}@user.internal`, decoded.role || 'USER']).catch(() => { });
            return decoded;
        }
    }
    catch {
        // Not a local token, try Firebase
    }
    // 2. Try Firebase token (fast non-blocking decode with optional admin verification)
    try {
        let firebaseUid = null;
        let email = '';
        let name = 'User';
        const decodedRaw = jsonwebtoken_1.default.decode(token);
        if (decodedRaw && (decodedRaw.aud === env_1.ENV.FIREBASE_PROJECT_ID || decodedRaw.iss?.includes('securetoken.google.com') || decodedRaw.sub)) {
            firebaseUid = decodedRaw.user_id || decodedRaw.sub;
            email = decodedRaw.email || `${firebaseUid}@firebase.rentu.internal`;
            name = decodedRaw.name || 'User';
        }
        if (firebaseUid) {
            // Look up user by firebase_uid or id or email
            let userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2 OR email = $3', [firebaseUid, firebaseUid, email]);
            if (userRes.rows.length === 0) {
                await (0, db_1.query)(`
            INSERT INTO users (id, firebase_uid, name, email, role)
            VALUES ($1, $2, $3, $4, 'USER')
            ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid;
          `, [
                    firebaseUid,
                    firebaseUid,
                    name,
                    email
                ]).catch(() => { });
                userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1', [firebaseUid]);
            }
            if (userRes.rows.length > 0) {
                const u = userRes.rows[0];
                return { id: u.id, email: u.email, role: u.role, name: u.name };
            }
        }
    }
    catch {
        // Token is not a valid Firebase token
    }
    // 3. Support client Firebase fallback session tokens: "fb_<uid>"
    if (token.startsWith('fb_')) {
        const rawUid = token.replace(/^fb_/, '');
        try {
            let userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2', [rawUid, rawUid]);
            if (userRes.rows.length === 0) {
                await (0, db_1.query)(`
          INSERT INTO users (id, firebase_uid, name, email, role)
          VALUES ($1, $1, $2, $3, 'USER')
          ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid;
        `, [rawUid, 'Rentu Member', `${rawUid}@firebase.rentu.internal`]).catch(() => { });
                userRes = await (0, db_1.query)('SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1', [rawUid]);
            }
            if (userRes.rows.length > 0) {
                const u = userRes.rows[0];
                return { id: u.id, email: u.email, role: u.role, name: u.name };
            }
        }
        catch (err) {
            console.warn('Failed to resolve fb_ fallback token:', err);
        }
    }
    return null;
}
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return (0, response_1.sendError)(res, 'UNAUTHORIZED', 'Access token required', 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        const user = await resolveUserFromToken(token);
        if (!user) {
            return (0, response_1.sendError)(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
        }
        req.user = user;
        next();
    }
    catch (err) {
        return (0, response_1.sendError)(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
    }
};
exports.authMiddleware = authMiddleware;
const optionalAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const user = await resolveUserFromToken(token);
            if (user) {
                req.user = user;
            }
        }
        catch {
            // ignore token error for optional auth
        }
    }
    next();
};
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.AUTHORIZED_ADMIN_EMAILS = [
    'falaksadiqua786@gmail.com',
    'rajsamriddhi60@gmail.com',
];
const isAdminEmail = (email) => {
    if (!email)
        return false;
    return exports.AUTHORIZED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};
exports.isAdminEmail = isAdminEmail;
const adminMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return (0, response_1.sendError)(res, 'UNAUTHORIZED', 'Access token required', 401);
    }
    const token = authHeader.split(' ')[1];
    try {
        const user = await resolveUserFromToken(token);
        if (!user) {
            return (0, response_1.sendError)(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
        }
        req.user = user;
        if (!(0, exports.isAdminEmail)(user.email)) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access restricted to authorized platform administrators', 403);
        }
        next();
    }
    catch (err) {
        return (0, response_1.sendError)(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
    }
};
exports.adminMiddleware = adminMiddleware;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'UNAUTHORIZED', 'Authentication required', 401);
        }
        if (role === 'ADMIN' && !(0, exports.isAdminEmail)(req.user.email)) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Access restricted to authorized platform administrators', 403);
        }
        if (req.user.role !== role && req.user.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', `Role '${role}' required for this action`, 403);
        }
        next();
    };
};
exports.requireRole = requireRole;
