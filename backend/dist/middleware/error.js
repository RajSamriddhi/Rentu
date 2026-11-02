"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const response_1 = require("./response");
const env_1 = require("../config/env");
const errorHandler = (err, req, res, next) => {
    if (err instanceof zod_1.ZodError) {
        const details = err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Input validation failed', 400, details);
    }
    // Securely log internal server errors on the server for diagnostics
    console.error('[SERVER ERROR AUDIT]:', {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        ip: req.headers['x-forwarded-for'] || req.ip,
        error: err.message,
        stack: env_1.ENV.NODE_ENV === 'production' ? undefined : err.stack,
    });
    // In production, sanitize database and internal error messages to prevent leaking schema or credentials
    const isProd = env_1.ENV.NODE_ENV === 'production';
    const safeMessage = isProd
        ? 'An unexpected error occurred. Please try again later.'
        : (err.message || 'An unexpected internal error occurred');
    return (0, response_1.sendError)(res, 'INTERNAL_SERVER_ERROR', safeMessage, 500);
};
exports.errorHandler = errorHandler;
