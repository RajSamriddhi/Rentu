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
const error_1 = require("./middleware/error");
const response_1 = require("./middleware/response");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const createApp = () => {
    const app = (0, express_1.default)();
    // Middleware
    app.use((0, cors_1.default)({ origin: true, credentials: true }));
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // Health Check (Matches both /api/health and /health)
    app.get(['/api/health', '/health'], async (req, res) => {
        let dbStatus = 'disconnected';
        try {
            await (0, db_1.query)('SELECT 1');
            dbStatus = 'connected';
        }
        catch (err) {
            dbStatus = `error: ${err.message}`;
        }
        return (0, response_1.sendSuccess)(res, {
            status: 'healthy',
            app: 'Rentu⁺ Headless REST API',
            version: '1.0.0',
            database: dbStatus,
            supabase: {
                configured: Boolean(env_1.ENV.SUPABASE_URL && env_1.ENV.SUPABASE_ANON_KEY),
                url: env_1.ENV.SUPABASE_URL || 'not_configured',
            },
            firebase: {
                configured: Boolean(env_1.ENV.FIREBASE_PROJECT_ID),
                projectId: env_1.ENV.FIREBASE_PROJECT_ID,
            },
            timestamp: new Date().toISOString(),
        });
    });
    // Mount API modules (supporting both with and without /api prefix)
    app.use(['/api/auth', '/auth'], auth_routes_1.default);
    app.use(['/api/items', '/items'], items_routes_1.default);
    app.use(['/api/requests', '/requests'], requests_routes_1.default);
    app.use(['/api/bookings', '/bookings'], bookings_routes_1.default);
    app.use(['/api/analytics', '/analytics'], analytics_routes_1.default);
    app.use(['/api/users', '/users'], users_routes_1.default);
    app.use(['/api/messages', '/messages'], messages_routes_1.default);
    app.use(['/api/upload', '/upload'], upload_routes_1.default);
    // 404 handler
    app.use((req, res) => {
        return (0, response_1.sendError)(res, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`, 404);
    });
    // Global Error Handler
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
