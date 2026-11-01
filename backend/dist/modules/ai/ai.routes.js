"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const ai_service_1 = require("./ai.service");
const ai_tools_1 = require("./ai.tools");
const router = (0, express_1.Router)();
// In-memory rate limiting map: ip -> { count, resetTime }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;
function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return next();
    }
    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        return (0, response_1.sendError)(res, 'RATE_LIMIT_EXCEEDED', 'Too many requests to Rentu AI. Please slow down and try again in a minute.', 429);
    }
    record.count += 1;
    return next();
}
const chatMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['user', 'assistant', 'system']),
    content: zod_1.z.string().min(1, 'Message cannot be empty').max(1000, 'Message cannot exceed 1000 characters'),
});
const chatContextSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid().nullable().optional(),
    locality: zod_1.z.string().max(120).nullable().optional(),
    startDate: zod_1.z.string().max(30).nullable().optional(),
    durationDays: zod_1.z.number().int().positive().max(30).nullable().optional(),
}).optional();
const chatRequestSchema = zod_1.z.object({
    messages: zod_1.z.array(chatMessageSchema).min(1, 'At least one message is required').max(15, 'Conversation history is capped at 15 messages'),
    context: chatContextSchema,
});
/**
 * POST /api/ai/chat
 * Primary conversation endpoint for Rentu AI Assistant
 */
router.post('/chat', rateLimiter, auth_1.optionalAuthMiddleware, async (req, res, next) => {
    try {
        const validated = chatRequestSchema.parse(req.body);
        // If context has no locality, check if user has a profile locality
        const context = {
            ...validated.context,
            locality: validated.context?.locality || req.user?.locality || null,
        };
        const result = await (0, ai_service_1.processAiChat)(validated.messages, context);
        return (0, response_1.sendSuccess)(res, result, 'Rentu AI responded');
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.sendError)(res, 'VALIDATION_ERROR', 'Invalid request format for Rentu AI', 400, error.errors);
        }
        next(error);
    }
});
/**
 * GET /api/ai/tools/search
 * Direct tool route for testing or client-side marketplace search
 */
router.get('/tools/search', async (req, res, next) => {
    try {
        const { query, category, max_price, locality, limit } = req.query;
        const items = await (0, ai_tools_1.searchListings)({
            query: query ? String(query) : undefined,
            category: category ? String(category) : undefined,
            max_price: max_price ? Number(max_price) : undefined,
            locality: locality ? String(locality) : undefined,
            limit: limit ? Number(limit) : 6,
        });
        return (0, response_1.sendSuccess)(res, items);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ai/tools/availability
 * Direct date-range availability verification
 */
router.get('/tools/availability', async (req, res, next) => {
    try {
        const { item_id, start_date, duration_days } = req.query;
        if (!item_id || !start_date || !duration_days) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'item_id, start_date, and duration_days are required', 400);
        }
        const availability = await (0, ai_tools_1.checkAvailability)({
            item_id: String(item_id),
            start_date: String(start_date),
            duration_days: parseInt(String(duration_days), 10),
        });
        return (0, response_1.sendSuccess)(res, availability);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/ai/tools/alternatives
 * Direct cheaper alternatives calculation
 */
router.get('/tools/alternatives', async (req, res, next) => {
    try {
        const { item_id, category, max_price, locality, duration_days } = req.query;
        const alternatives = await (0, ai_tools_1.findAlternatives)({
            item_id: item_id ? String(item_id) : undefined,
            category: category ? String(category) : undefined,
            max_price: max_price ? Number(max_price) : undefined,
            locality: locality ? String(locality) : undefined,
            duration_days: duration_days ? parseInt(String(duration_days), 10) : 1,
        });
        return (0, response_1.sendSuccess)(res, alternatives);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
