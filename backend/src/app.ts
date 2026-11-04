import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import itemsRoutes from './modules/items/items.routes';
import requestsRoutes from './modules/requests/requests.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import usersRoutes from './modules/users/users.routes';
import messagesRoutes from './modules/messages/messages.routes';
import uploadRoutes from './modules/upload/upload.routes';
import aiRoutes from './modules/ai/ai.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import supportRoutes from './modules/support/support.routes';
import adminRoutes from './modules/admin/admin.routes';
import { errorHandler } from './middleware/error';
import { sendError, sendSuccess } from './middleware/response';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
import { query } from './config/db';
import { ENV } from './config/env';
import { runMigrations } from './db/migrate';
import {
  securityHeaders,
  authRateLimiter,
  generalApiRateLimiter,
  isAllowedOrigin
} from './middleware/security';

let migrationsPromise: Promise<void> | null = null;
const ensureMigrations = async () => {
  if (!migrationsPromise) {
    migrationsPromise = runMigrations().catch((err) => {
      console.warn('Auto migration error on startup:', err.message || err);
      migrationsPromise = null;
    });
  }
  return migrationsPromise;
};

export const createApp = () => {
  const app = express();

  // Trust first reverse proxy hop (Vercel, Cloudflare, ALB) for accurate client IP identification
  app.set('trust proxy', 1);

  // 1. OWASP HTTP Security Headers
  app.use(securityHeaders);

  // 2. Strict CORS Whitelist Protection
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Cross-Origin Request Blocked by Security Policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Request body parsers with safe limits (supports image uploads up to 5MB + base64 overhead)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Global API Rate Limiter (protects against scraping, flooding, and DoS)
  app.use(generalApiRateLimiter);

  // Run schema migration verification once asynchronously on worker startup (skip in serverless cold starts)
  if (!process.env.VERCEL && !migrationsPromise) {
    ensureMigrations().catch(() => { });
  }

  // Health Check (Matches both /api/health and /health) - Sanitized so no internal endpoints leak
  app.get(['/api/health', '/health'], async (req, res) => {
    let dbStatus = 'disconnected';
    try {
      await query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'unreachable';
    }

    return sendSuccess(res, {
      status: 'healthy',
      app: 'Rentu⁺ REST API',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  });

  // Dedicated migration trigger endpoint - Strictly Admin Protected
  app.get(['/api/migrate', '/migrate'], authMiddleware, async (req: AuthenticatedRequest, res) => {
    if (req.user?.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only authorized platform administrators can execute migrations', 403);
    }
    try {
      await runMigrations();
      return sendSuccess(res, { migrated: true, timestamp: new Date().toISOString() }, 'Database schema updated successfully.');
    } catch (err: any) {
      return sendError(res, 'MIGRATION_FAILED', err.message, 500);
    }
  });

  // Mount API modules with specific brute-force protection on Auth
  app.use(['/api/auth', '/auth'], authRateLimiter, authRoutes);
  app.use(['/api/items', '/items'], itemsRoutes);
  app.use(['/api/requests', '/requests'], requestsRoutes);
  app.use(['/api/bookings', '/bookings'], bookingsRoutes);
  app.use(['/api/analytics', '/analytics'], analyticsRoutes);
  app.use(['/api/users', '/users'], usersRoutes);
  app.use(['/api/messages', '/messages'], messagesRoutes);
  app.use(['/api/upload', '/upload'], uploadRoutes);
  app.use(['/api/notifications', '/notifications'], notificationsRoutes);
  app.use(['/api/support', '/support'], supportRoutes);
  app.use(['/api/admin', '/admin'], adminRoutes);
  app.use(['/api/ai', '/ai'], aiRoutes);

  // 404 handler
  app.use((req, res) => {
    return sendError(res, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`, 404);
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
