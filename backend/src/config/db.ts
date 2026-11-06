import { Pool, QueryResult, QueryResultRow } from 'pg';
import { ENV } from './env';

const isRemote = ENV.DATABASE_URL.includes('supabase.co') || ENV.DATABASE_URL.includes('pooler') || ENV.NODE_ENV === 'production';

const getSslConfig = () => {
  if (!isRemote) return undefined;
  if (process.env.DATABASE_SSL_CA) {
    return {
      ca: process.env.DATABASE_SSL_CA,
      rejectUnauthorized: true,
    };
  }
  if (process.env.DB_SSL_STRICT === 'true') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
};

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  ssl: getSslConfig(),
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000, // 10s query timeout prevents runaway queries from locking database tables
  query_timeout: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  if (!ENV.DATABASE_URL) {
    throw new Error('Database connection not configured: DATABASE_URL environment variable is missing.');
  }
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (ENV.NODE_ENV === 'development' && duration > 100) {
    console.log(`Executed query in ${duration}ms: ${text.slice(0, 80)}`);
  }
  return res;
};
