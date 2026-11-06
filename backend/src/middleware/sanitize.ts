import { Request, Response, NextFunction } from 'express';

/**
 * XSS & Malicious Input Sanitizer Middleware
 * Strips script tags, javascript: pseudo-protocols, and dangerous HTML event handlers from all string inputs.
 */
export function sanitizeString(val: string): string {
  if (typeof val !== 'string') return val;

  return val
    // Remove null bytes and control chars that can bypass filters
    .replace(/\0/g, '')
    // Remove script tags and their inner content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object / embed tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // Neutralize dangerous inline event handlers like onload, onerror, onclick, etc.
    .replace(/\bon[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    // Neutralize javascript: and vbscript: URIs
    .replace(/javascript\s*:/gi, 'blocked-scheme:')
    .replace(/vbscript\s*:/gi, 'blocked-scheme:')
    // Neutralize data:text/html URIs
    .replace(/data\s*:\s*text\/html/gi, 'blocked-scheme:');
}

/**
 * Recursively sanitize objects, arrays, and primitive strings
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return sanitizeString(data);
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (typeof data === 'object' && !(data instanceof Date) && !(data instanceof RegExp) && !Buffer.isBuffer(data)) {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      sanitized[key] = sanitizeData(data[key]);
    }
    return sanitized;
  }
  return data;
}

/**
 * Express middleware to sanitize incoming body and query parameters
 */
export const inputSanitizer = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    // Skip raw buffers (such as file uploads)
    if (!Buffer.isBuffer(req.body)) {
      req.body = sanitizeData(req.body);
    }
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeData(req.query);
  }

  next();
};
