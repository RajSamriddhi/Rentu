const functions = require('firebase-functions');
const { Pool } = require('pg');

const DATABASE_URL = process.env.SUPABASE_DATABASE_URL || 
  'postgresql://postgres.mkvpscrnqvkaddpmqtbm:dimty9-botgeF-gisfej@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

/**
 * Triggered automatically when ANY user is created in Firebase Auth
 * (via Google sign-in, email/password, or directly inside Firebase Console)
 */
exports.syncUserToSupabase = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const email = (user.email || `${uid}@firebase.rentu.internal`).toLowerCase();
  const name = user.displayName || email.split('@')[0] || 'Rentu Member';
  const avatarUrl = user.photoURL || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
  const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || `user_${uid.slice(0, 6)}`;

  try {
    await pool.query(`
      INSERT INTO users (id, firebase_uid, email, name, username, avatar_url, role, trust_score)
      VALUES ($1, $2, $3, $4, $5, $6, 'USER', 85)
      ON CONFLICT (id) DO UPDATE SET
        firebase_uid = EXCLUDED.firebase_uid,
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url);
    `, [uid, uid, email, name, username, avatarUrl]);
    console.log(`Successfully synced Firebase user ${uid} (${email}) to Supabase`);
  } catch (err) {
    console.error(`Failed to sync user ${uid} to Supabase:`, err);
    throw err;
  }
});

/**
 * Triggered automatically when ANY user is deleted in Firebase Auth
 * (via Firebase Console or Admin SDK)
 */
exports.deleteUserFromSupabase = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  try {
    await pool.query(`DELETE FROM users WHERE id = $1 OR firebase_uid = $1;`, [uid]);
    console.log(`Successfully deleted user ${uid} from Supabase upon Firebase deletion`);
  } catch (err) {
    console.error(`Failed to delete user ${uid} from Supabase:`, err);
    throw err;
  }
});
