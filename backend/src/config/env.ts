import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Attempt to load .env from multiple potential working directories / locations
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../backend/.env'),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config(); // fallback default

const rawGeminiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const isPlaceholderKey =
  rawGeminiKey.includes('your_key_here') ||
  rawGeminiKey.includes('your_gemini_api_key_here') ||
  rawGeminiKey === '';

const isProd = (process.env.NODE_ENV || 'production') === 'production';
const defaultDatabaseUrl = 'postgresql://postgres.mkvpscrnqvkaddpmqtbm:dimty9-botgeF-gisfej@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const defaultAnonKey = 'sb_publishable_4vho7OeDJupwXGGZn7TDFQ_Uryz7NwR';

if (!process.env.DATABASE_URL) {
  if (isProd) {
    console.warn('NOTICE: DATABASE_URL not explicitly set in environment, using cloud pooler database.');
  }
}

if (!process.env.JWT_SECRET && isProd) {
  console.warn('SECURITY WARNING: JWT_SECRET is not set in production. Set a unique, secure secret in your environment settings.');
}

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  DATABASE_URL: process.env.DATABASE_URL || defaultDatabaseUrl,
  JWT_SECRET: process.env.JWT_SECRET || 'rentu-secure-session-key-2026',
  NODE_ENV: process.env.NODE_ENV || (process.env.VERCEL ? 'production' : 'development'),
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'rentu-732b7',
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mkvpscrnqvkaddpmqtbm.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  GEMINI_API_KEY: isPlaceholderKey ? '' : rawGeminiKey,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
};
