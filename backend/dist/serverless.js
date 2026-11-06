"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
process.on('unhandledRejection', (reason) => {
    console.warn('[SERVERLESS UNHANDLED REJECTION]:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[SERVERLESS UNCAUGHT EXCEPTION]:', err);
});
const app = (0, app_1.createApp)();
const handler = (req, res) => {
    try {
        return app(req, res);
    }
    catch (err) {
        console.error('Fatal serverless function error:', err);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: err?.message || 'Server error occurred',
            });
        }
    }
};
exports.default = handler;
