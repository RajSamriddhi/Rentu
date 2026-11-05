/**
 * Quick User Sync Utility: Synchronize Firebase Auth users with Supabase PostgreSQL
 * Usage: node backend/src/scripts/sync-users.js
 */
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres.mkvpscrnqvkaddpmqtbm:dimty9-botgeF-gisfej@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncUser({ uid, email, name, avatarUrl }) {
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name || cleanEmail.split('@')[0];
  const username = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || `user_${uid.slice(0, 6)}`;
  const avatar = avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(cleanName)}`;

  const res = await pool.query(`
    INSERT INTO users (id, firebase_uid, email, name, username, avatar_url, role, trust_score)
    VALUES ($1, $2, $3, $4, $5, $6, 'USER', 85)
    ON CONFLICT (id) DO UPDATE SET
      firebase_uid = EXCLUDED.firebase_uid,
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url)
    RETURNING id, email, name;
  `, [uid, uid, cleanEmail, cleanName, username, avatar]);

  return res.rows[0];
}

async function run() {
  console.log('--- Rentu User Sync Utility ---');
  const current = await pool.query('SELECT id, email, name FROM users ORDER BY created_at ASC');
  console.log(`Current users in Supabase (${current.rows.length}):`);
  console.table(current.rows);
  await pool.end();
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { syncUser };
