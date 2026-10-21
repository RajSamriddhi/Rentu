"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const app = (0, app_1.createApp)();
const handler = (req, res) => {
    return app(req, res);
};
exports.default = handler;
