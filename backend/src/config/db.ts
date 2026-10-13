import { Pool, QueryResult, QueryResultRow } from 'pg';
import { ENV } from './env';

const isRemote = ENV.DATABASE_URL.includes('supabase.co') || ENV.DATABASE_URL.includes('pooler') || ENV.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (ENV.NODE_ENV === 'development' && duration > 100) {
    console.log(`Executed query in ${duration}ms: ${text.slice(0, 80)}`);
  }
  return res;
};
