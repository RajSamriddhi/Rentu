"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
// Attempt to load .env from multiple potential working directories / locations
const possibleEnvPaths = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), 'backend/.env'),
    path_1.default.resolve(__dirname, '../../.env'),
    path_1.default.resolve(__dirname, '../../../.env'),
    path_1.default.resolve(__dirname, '../../../backend/.env'),
];
for (const envPath of possibleEnvPaths) {
    if (fs_1.default.existsSync(envPath)) {
        dotenv_1.default.config({ path: envPath });
    }
}
dotenv_1.default.config(); // fallback default
const rawGeminiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const isPlaceholderKey = rawGeminiKey.includes('your_key_here') ||
    rawGeminiKey.includes('your_gemini_api_key_here') ||
    rawGeminiKey === '';
const isProd = (process.env.NODE_ENV || 'production') === 'production';
if (isProd) {
    if (!process.env.DATABASE_URL) {
        throw new Error('CRITICAL CONFIGURATION ERROR: DATABASE_URL environment variable must be set in production.');
    }
    if (!process.env.JWT_SECRET) {
        throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable must be set in production.');
    }
}
exports.ENV = {
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-local-only-jwt-secret-do-not-use-in-production',
    NODE_ENV: process.env.NODE_ENV || (process.env.VERCEL ? 'production' : 'development'),
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'rentu-732b7',
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    GEMINI_API_KEY: isPlaceholderKey ? '' : rawGeminiKey,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
};
