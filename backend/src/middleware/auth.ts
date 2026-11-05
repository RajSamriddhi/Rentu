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
    let credential = null;
    const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (rawSa) {
      try {
        let saObj: any;
        if (typeof rawSa === 'object') {
          saObj = rawSa;
        } else if (rawSa.trim().startsWith('{')) {
          saObj = JSON.parse(rawSa);
        } else {
          try {
            saObj = JSON.parse(Buffer.from(rawSa, 'base64').toString('utf-8'));
          } catch {
            saObj = JSON.parse(rawSa);
          }
        }
        credential = cert(saObj);
      } catch (err: any) {
        console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
      }
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        credential = cert({
          projectId: ENV.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
      } catch (err: any) {
        console.warn('Could not build credentials from FIREBASE_PRIVATE_KEY:', err.message);
      }
    }

    if (credential) {
      initializeApp({
        credential,
        projectId: ENV.FIREBASE_PROJECT_ID,
      });
      console.log('Firebase Admin initialized with verified service account credentials.');
    } else {
      initializeApp({ projectId: ENV.FIREBASE_PROJECT_ID });
    }
  }
} catch (e: any) {
  console.warn('Firebase Admin init notice:', e.message);
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

      // If user is not found in database, they have been removed - do not resurrect them
      return null;
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

      const userRes = await query(
        'SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2 OR (email = $3 AND email IS NOT NULL)',
        [firebaseUid, firebaseUid, email]
      );

      // If user exists in database, return authenticated user
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        return { id: u.id, email: u.email, role: u.role, name: u.name };
      }

      // If user is not in database, they were deleted - do not auto-insert
      return null;
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
    if (user.role !== 'ADMIN' && !isAdminEmail(user.email)) {
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
    if (role === 'ADMIN' && req.user.role !== 'ADMIN' && !isAdminEmail(req.user.email)) {
      return sendError(res, 'FORBIDDEN', 'Access restricted to authorized platform administrators', 403);
    }
    if (req.user.role !== role && req.user.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', `Role '${role}' required for this action`, 403);
    }
    next();
  };
};
