"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
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
