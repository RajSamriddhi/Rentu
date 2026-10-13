"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const env_1 = require("./env");
const isRemote = env_1.ENV.DATABASE_URL.includes('supabase.co') || env_1.ENV.DATABASE_URL.includes('pooler') || env_1.ENV.NODE_ENV === 'production';
exports.pool = new pg_1.Pool({
    connectionString: env_1.ENV.DATABASE_URL,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
exports.pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
});
const query = async (text, params) => {
    const start = Date.now();
    const res = await exports.pool.query(text, params);
    const duration = Date.now() - start;
    if (env_1.ENV.NODE_ENV === 'development' && duration > 100) {
        console.log(`Executed query in ${duration}ms: ${text.slice(0, 80)}`);
    }
    return res;
};
exports.query = query;
