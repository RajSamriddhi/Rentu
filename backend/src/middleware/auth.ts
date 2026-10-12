import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '@clerk/express';
import { ENV } from '../config/env';
import { query } from '../config/db';
import { sendError } from './response';

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
  // 1. Try local JWT first
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AuthUser;
    if (decoded && decoded.id) {
      return decoded;
    }
  } catch {
    // Not a local token, try Clerk
  }

  // 2. Try Clerk JWT if CLERK_SECRET_KEY is configured
  if (ENV.CLERK_SECRET_KEY) {
    try {
      const clerkPayload: any = await verifyToken(token, {
        secretKey: ENV.CLERK_SECRET_KEY,
      });
      if (clerkPayload && clerkPayload.sub) {
        // Look up user by clerk_id
        const userRes = await query(
          'SELECT id, email, role, name FROM users WHERE clerk_id = $1',
          [clerkPayload.sub]
        );
        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          return { id: u.id, email: u.email, role: u.role, name: u.name };
        }
      }
    } catch {
      // Token neither local nor Clerk
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
