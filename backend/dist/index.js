"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = __importDefault(require("./server"));
// @ts-ignore
if (typeof module !== 'undefined' && module.exports) {
    // @ts-ignore
    module.exports = server_1.default;
    // @ts-ignore
    module.exports.default = server_1.default;
    // @ts-ignore
    module.exports.app = server_1.default;
}
exports.default = server_1.default;
