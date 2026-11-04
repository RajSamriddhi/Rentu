import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ENV } from '../config/env';
import { query } from '../config/db';
import { sendError } from './response';

// Initialize Firebase Admin securely for cryptographic token verification
try {
  const existingApps = getApps();
  if (!existingApps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(sa),
          projectId: ENV.FIREBASE_PROJECT_ID,
        });
      } catch {
        initializeApp({ projectId: ENV.FIREBASE_PROJECT_ID });
      }
    } else {
      initializeApp({ projectId: ENV.FIREBASE_PROJECT_ID });
    }
  }
} catch (e) {
  console.warn('Firebase Admin init notice:', e);
}

// Robust JWT & Firebase token verification
export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  name: string;
  avatar_url?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  // 1. Try local Rentu⁺ JWT first (verified with HMAC signature)
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthUser;
    if (decoded && decoded.id) {
      // Verify user in database or match by email
      const checkRes = await query(
        'SELECT id, email, role, name FROM users WHERE id = $1 OR (email = $2 AND email IS NOT NULL)',
        [decoded.id, decoded.email || '']
      );
      if (checkRes.rows.length > 0) {
        const u = checkRes.rows[0];
        return { id: u.id, email: u.email, role: u.role, name: u.name };
      }

      // Auto-insert user into DB if not found so foreign key joins succeed
      await query(`
        INSERT INTO users (id, name, email, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
      `, [decoded.id, decoded.name || 'User', decoded.email || `${decoded.id}@user.internal`, decoded.role || 'USER']).catch(() => {});

      return decoded;
    }
  } catch {
    // Not a local token, try Firebase
  }

  // 2. Cryptographically verify Firebase ID token (checks signature, expiration, issuer, audience)
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    if (decodedToken && decodedToken.uid) {
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email || `${firebaseUid}@firebase.rentu.internal`;
      const name = decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'User');

      let userRes = await query(
        'SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2 OR (email = $3 AND email IS NOT NULL)',
        [firebaseUid, firebaseUid, email]
      );

      if (userRes.rows.length === 0) {
        await query(`
          INSERT INTO users (id, firebase_uid, name, email, role)
          VALUES ($1, $2, $3, $4, 'USER')
          ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid;
        `, [
          firebaseUid,
          firebaseUid,
          name,
          email
        ]).catch(() => {});

        userRes = await query(
          'SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1',
          [firebaseUid]
        );
      }

      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        return { id: u.id, email: u.email, role: u.role, name: u.name };
      }
    }
  } catch {
    // Cryptographic signature/expiration verification failed
  }

  return null;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Access token required', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return sendError(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
    }
    req.user = user;
    next();
  } catch (err) {
    return sendError(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const user = await resolveUserFromToken(token);
      if (user) {
        req.user = user;
      }
    } catch {
      // ignore token error for optional auth
    }
  }
  next();
};

export const AUTHORIZED_ADMIN_EMAILS = [
  'falaksadiqua786@gmail.com',
  'rajsamriddhi60@gmail.com',
];

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export const adminMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Access token required', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return sendError(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
    }
    req.user = user;
    if (!isAdminEmail(user.email)) {
      return sendError(res, 'FORBIDDEN', 'Access restricted to authorized platform administrators', 403);
    }
    next();
  } catch (err) {
    return sendError(res, 'INVALID_TOKEN', 'Session expired or token invalid', 401);
  }
};

export const requireRole = (role: 'USER' | 'ADMIN') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    if (role === 'ADMIN' && !isAdminEmail(req.user.email)) {
      return sendError(res, 'FORBIDDEN', 'Access restricted to authorized platform administrators', 403);
    }
    if (req.user.role !== role && req.user.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', `Role '${role}' required for this action`, 403);
    }
    next();
  };
};
