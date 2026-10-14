"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const app_1 = require("./app");
const env_1 = require("./config/env");
const migrate_1 = require("./db/migrate");
exports.app = (0, app_1.createApp)();
const startServer = async () => {
    try {
        // Ensure migrations are in place
        await (0, migrate_1.runMigrations)().catch((err) => {
            console.warn('Migrations notice on startup:', err.message);
        });
        const server = exports.app.listen(env_1.ENV.PORT, () => {
            console.log(`⚡ Rentu⁺ API Service listening on http://localhost:${env_1.ENV.PORT}`);
            console.log(`🌱 Environment: ${env_1.ENV.NODE_ENV}`);
            console.log(`📡 Ready for rental requests!`);
        });
        const shutdown = () => {
            console.log('\nShutting down Rentu⁺ API server gracefully...');
            server.close(() => {
                console.log('HTTP server closed.');
                process.exit(0);
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        console.error('Failed to start server:', error);
    }
};
// Listen on port when executed directly as standalone process (local, container, or Vercel Service)
if (require.main === module) {
    startServer();
}
// Export for both ESM and CJS compatibility in serverless environments
// @ts-ignore
if (typeof module !== 'undefined' && module.exports) {
    // @ts-ignore
    module.exports = exports.app;
    // @ts-ignore
    module.exports.default = exports.app;
    // @ts-ignore
    module.exports.app = exports.app;
}
exports.default = exports.app;
