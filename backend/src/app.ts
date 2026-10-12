import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import itemsRoutes from './modules/items/items.routes';
import requestsRoutes from './modules/requests/requests.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import usersRoutes from './modules/users/users.routes';
import messagesRoutes from './modules/messages/messages.routes';
import { errorHandler } from './middleware/error';
import { sendError, sendSuccess } from './middleware/response';
import { query } from './config/db';
import { ENV } from './config/env';

export const createApp = () => {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health Check
  app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    try {
      await query('SELECT 1');
      dbStatus = 'connected';
    } catch (err: any) {
      dbStatus = `error: ${err.message}`;
    }

    return sendSuccess(res, {
      status: 'healthy',
      app: 'Rentu⁺ Headless REST API',
      version: '1.0.0',
      database: dbStatus,
      supabase: {
        configured: Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY),
        url: ENV.SUPABASE_URL || 'not_configured',
      },
      clerk: {
        configured: Boolean(ENV.CLERK_PUBLISHABLE_KEY && ENV.CLERK_SECRET_KEY),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemsRoutes);
  app.use('/api/requests', requestsRoutes);
  app.use('/api/bookings', bookingsRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/messages', messagesRoutes);

  // 404 handler
  app.use((req, res) => {
    return sendError(res, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`, 404);
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
