import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from './response';

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

  console.error('Unhandled Server Error:', err);
  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    err.message || 'An unexpected internal error occurred',
    500
  );
};
