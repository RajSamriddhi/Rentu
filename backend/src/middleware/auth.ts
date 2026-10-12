import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ENV } from '../config/env';
import { query } from '../config/db';
import { sendError } from './response';

// Initialize Firebase Admin app if configured
if (ENV.FIREBASE_PROJECT_ID && getApps().length === 0) {
  try {
    initializeApp({
      projectId: ENV.FIREBASE_PROJECT_ID,
    });
  } catch (err) {
    console.warn('Firebase Admin initialization notice:', err);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  // 1. Try local Rentu⁺ JWT first
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

  // 2. Try Firebase ID token
  if (ENV.FIREBASE_PROJECT_ID) {
    try {
      let firebaseUid: string | null = null;
      let email: string = '';
      let name: string = 'User';

      // Attempt verification with Firebase Admin if available
      try {
        const decodedFb = await getAuth().verifyIdToken(token);
        if (decodedFb && decodedFb.uid) {
          firebaseUid = decodedFb.uid;
          email = decodedFb.email || `${decodedFb.uid}@firebase.rentu.internal`;
          name = decodedFb.name || 'User';
        }
      } catch {
        // Fallback: decode JWT token payload if issued by Google Firebase
        const decodedRaw: any = jwt.decode(token);
        if (decodedRaw && (decodedRaw.aud === ENV.FIREBASE_PROJECT_ID || decodedRaw.iss?.includes('securetoken.google.com'))) {
          firebaseUid = decodedRaw.user_id || decodedRaw.sub;
          email = decodedRaw.email || `${firebaseUid}@firebase.rentu.internal`;
          name = decodedRaw.name || 'User';
        }
      }

      if (firebaseUid) {
        // Look up user by firebase_uid or id or email
        let userRes = await query(
          'SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2 OR email = $3',
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
      // Token is not a valid Firebase token
    }
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

export const requireRole = (role: 'USER' | 'ADMIN') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    if (req.user.role !== role && req.user.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', `Role '${role}' required for this action`, 403);
    }
    next();
  };
};
