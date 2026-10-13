"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const response_1 = require("./response");
const errorHandler = (err, req, res, next) => {
    if (err instanceof zod_1.ZodError) {
        const details = err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Input validation failed', 400, details);
    }
    console.error('Unhandled Server Error:', err);
    return (0, response_1.sendError)(res, 'INTERNAL_SERVER_ERROR', err.message || 'An unexpected internal error occurred', 500);
};
exports.errorHandler = errorHandler;
