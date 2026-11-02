import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from './response';
import { ENV } from '../config/env';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'VALIDATION_ERROR', 'Input validation failed', 400, details);
  }

  // Securely log internal server errors on the server for diagnostics
  console.error('[SERVER ERROR AUDIT]:', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ip: req.headers['x-forwarded-for'] || req.ip,
    error: err.message,
    stack: ENV.NODE_ENV === 'production' ? undefined : err.stack,
  });

  // In production, sanitize database and internal error messages to prevent leaking schema or credentials
  const isProd = ENV.NODE_ENV === 'production';
  const safeMessage = isProd
    ? 'An unexpected error occurred. Please try again later.'
    : (err.message || 'An unexpected internal error occurred');

  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    safeMessage,
    500
  );
};
