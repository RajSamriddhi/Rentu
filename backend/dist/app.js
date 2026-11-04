"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const items_routes_1 = __importDefault(require("./modules/items/items.routes"));
const requests_routes_1 = __importDefault(require("./modules/requests/requests.routes"));
const bookings_routes_1 = __importDefault(require("./modules/bookings/bookings.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const messages_routes_1 = __importDefault(require("./modules/messages/messages.routes"));
const upload_routes_1 = __importDefault(require("./modules/upload/upload.routes"));
const ai_routes_1 = __importDefault(require("./modules/ai/ai.routes"));
const notifications_routes_1 = __importDefault(require("./modules/notifications/notifications.routes"));
const support_routes_1 = __importDefault(require("./modules/support/support.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const error_1 = require("./middleware/error");
const response_1 = require("./middleware/response");
const auth_1 = require("./middleware/auth");
const db_1 = require("./config/db");
const migrate_1 = require("./db/migrate");
const security_1 = require("./middleware/security");
let migrationsPromise = null;
const ensureMigrations = async () => {
    if (!migrationsPromise) {
        migrationsPromise = (0, migrate_1.runMigrations)().catch((err) => {
            console.warn('Auto migration error on startup:', err.message || err);
            migrationsPromise = null;
        });
    }
    return migrationsPromise;
};
const createApp = () => {
    const app = (0, express_1.default)();
    // Trust first reverse proxy hop (Vercel, Cloudflare, ALB) for accurate client IP identification
    app.set('trust proxy', 1);
    // 1. OWASP HTTP Security Headers
    app.use(security_1.securityHeaders);
    // 2. Strict CORS Whitelist Protection
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if ((0, security_1.isAllowedOrigin)(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('Cross-Origin Request Blocked by Security Policy'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));
    // 3. Request body parsers with safe limits (supports image uploads up to 5MB + base64 overhead)
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // 4. Global API Rate Limiter (protects against scraping, flooding, and DoS)
    app.use(security_1.generalApiRateLimiter);
    // Run schema migration verification once asynchronously on worker startup
    if (!migrationsPromise) {
        ensureMigrations().catch(() => { });
    }
    // Health Check (Matches both /api/health and /health) - Sanitized so no internal endpoints leak
    app.get(['/api/health', '/health'], async (req, res) => {
        let dbStatus = 'disconnected';
        try {
            await (0, db_1.query)('SELECT 1');
            dbStatus = 'connected';
        }
        catch {
            dbStatus = 'unreachable';
        }
        return (0, response_1.sendSuccess)(res, {
            status: 'healthy',
            app: 'Rentu⁺ REST API',
            database: dbStatus,
            timestamp: new Date().toISOString(),
        });
    });
    // Dedicated migration trigger endpoint - Strictly Admin Protected
    app.get(['/api/migrate', '/migrate'], auth_1.authMiddleware, async (req, res) => {
        if (req.user?.role !== 'ADMIN') {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Only authorized platform administrators can execute migrations', 403);
        }
        try {
            await (0, migrate_1.runMigrations)();
            return (0, response_1.sendSuccess)(res, { migrated: true, timestamp: new Date().toISOString() }, 'Database schema updated successfully.');
        }
        catch (err) {
            return (0, response_1.sendError)(res, 'MIGRATION_FAILED', err.message, 500);
        }
    });
    // Mount API modules with specific brute-force protection on Auth
    app.use(['/api/auth', '/auth'], security_1.authRateLimiter, auth_routes_1.default);
    app.use(['/api/items', '/items'], items_routes_1.default);
    app.use(['/api/requests', '/requests'], requests_routes_1.default);
    app.use(['/api/bookings', '/bookings'], bookings_routes_1.default);
    app.use(['/api/analytics', '/analytics'], analytics_routes_1.default);
    app.use(['/api/users', '/users'], users_routes_1.default);
    app.use(['/api/messages', '/messages'], messages_routes_1.default);
    app.use(['/api/upload', '/upload'], upload_routes_1.default);
    app.use(['/api/notifications', '/notifications'], notifications_routes_1.default);
    app.use(['/api/support', '/support'], support_routes_1.default);
    app.use(['/api/admin', '/admin'], admin_routes_1.default);
    app.use(['/api/ai', '/ai'], ai_routes_1.default);
    // 404 handler
    app.use((req, res) => {
        return (0, response_1.sendError)(res, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`, 404);
    });
    // Global Error Handler
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
