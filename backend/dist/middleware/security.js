"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedOrigin = exports.generalApiRateLimiter = exports.authRateLimiter = exports.createRateLimiter = exports.securityHeaders = void 0;
const response_1 = require("./response");
const env_1 = require("../config/env");
/**
 * 1. HTTP Security Headers Middleware (OWASP Top 10 Hardening)
 * Protects against MIME-sniffing, clickjacking, protocol downgrades, and information leaks.
 */
const securityHeaders = (req, res, next) => {
    // Prevent browser MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking / framing
    res.setHeader('X-Frame-Options', 'DENY');
    // Modern XSS protection standard (disables flawed legacy auditor to prevent XS-Leaks)
    res.setHeader('X-XSS-Protection', '0');
    // Strict Transport Security (HSTS): forces HTTPS for 1 year
    if (env_1.ENV.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    // Protect referrer leakage
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Allow Firebase Google Auth popups while isolating window context
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // Restrict sensitive browser APIs
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=()');
    // Hide Express signature
    res.removeHeader('X-Powered-By');
    next();
};
exports.securityHeaders = securityHeaders;
const createRateLimiter = (options) => {
    const buckets = new Map();
    const { windowMs, maxRequests, keyPrefix = 'rl', errorMessage = 'Too many requests. Please try again later.' } = options;
    // Auto-prune stale IP buckets every 5 minutes to prevent memory leaks
    setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets.entries()) {
            if (now - bucket.lastRefill > windowMs * 2) {
                buckets.delete(key);
            }
        }
    }, 5 * 60 * 1000).unref();
    return (req, res, next) => {
        // Determine client IP safely from reverse proxy or socket
        const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.ip ||
            req.socket.remoteAddress ||
            'unknown_ip';
        const clientKey = `${keyPrefix}:${rawIp}`;
        const now = Date.now();
        let bucket = buckets.get(clientKey);
        if (!bucket) {
            bucket = { tokens: maxRequests - 1, lastRefill: now };
            buckets.set(clientKey, bucket);
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', bucket.tokens);
            return next();
        }
        // Refill tokens proportionally based on elapsed time
        const elapsed = now - bucket.lastRefill;
        if (elapsed > windowMs) {
            bucket.tokens = maxRequests;
            bucket.lastRefill = now;
        }
        else {
            const tokensToAdd = Math.floor((elapsed / windowMs) * maxRequests);
            if (tokensToAdd > 0) {
                bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
                bucket.lastRefill = now;
            }
        }
        if (bucket.tokens > 0) {
            bucket.tokens -= 1;
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', bucket.tokens);
            return next();
        }
        // Rate limit exceeded
        const retryAfterSec = Math.ceil((windowMs - (now - bucket.lastRefill)) / 1000);
        res.setHeader('Retry-After', Math.max(1, retryAfterSec));
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        return (0, response_1.sendError)(res, 'TOO_MANY_REQUESTS', errorMessage, 429);
    };
};
exports.createRateLimiter = createRateLimiter;
// Rate limiter for authentication endpoints: max 20 requests per minute per IP (prevents brute-force)
exports.authRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'auth',
    errorMessage: 'Too many authentication attempts. Please wait a minute before trying again.',
});
// General API rate limiter: max 200 requests per minute per IP (prevents scraping and flooding)
exports.generalApiRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    maxRequests: 200,
    keyPrefix: 'api',
    errorMessage: 'Request limit exceeded. Please slow down your requests.',
});
/**
 * 3. Strict CORS Whitelist Origin Validator
 */
const isAllowedOrigin = (origin) => {
    if (!origin)
        return true; // Allow mobile apps or same-origin requests
    try {
        const url = new URL(origin);
        const host = url.hostname.toLowerCase();
        // Allowed production domains
        if (host === 'rentu.site' || host === 'www.rentu.site')
            return true;
        // Allowed preview deployments (Vercel / Railway)
        if (host.endsWith('.vercel.app') || host.endsWith('.up.railway.app'))
            return true;
        // Allowed local development
        if (host === 'localhost' || host === '127.0.0.1')
            return true;
        return false;
    }
    catch {
        return false;
    }
};
exports.isAllowedOrigin = isAllowedOrigin;
