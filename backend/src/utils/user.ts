import { query } from '../config/db';

/**
 * Resolves all database identifiers for a user (both internal ID UUID and firebase_uid).
 * This bridges the dual-identity mapping between Firebase Auth and PostgreSQL.
 */
export const resolveUserIds = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const res = await query(
      `SELECT id::text, firebase_uid, email FROM users WHERE id::text = $1 OR firebase_uid = $1`,
      [userId]
    );
    const ids = new Set<string>([userId]);
    const emails = new Set<string>();

    for (const row of res.rows) {
      if (row.id) ids.add(String(row.id));
      if (row.firebase_uid) ids.add(String(row.firebase_uid));
      if (row.email && typeof row.email === 'string' && row.email.trim() && !row.email.includes('.internal')) {
        emails.add(row.email.trim().toLowerCase());
      }
    }

    if (emails.size > 0) {
      const emailRes = await query(
        `SELECT id::text, firebase_uid FROM users WHERE LOWER(email) = ANY($1::text[])`,
        [Array.from(emails)]
      );
      for (const row of emailRes.rows) {
        if (row.id) ids.add(String(row.id));
        if (row.firebase_uid) ids.add(String(row.firebase_uid));
      }
    }

    return Array.from(ids);
  } catch {
    return [userId];
  }
};

/**
 * Resolves the canonical internal users(id) primary key UUID for a given userId.
 * Used for inserting into tables with strict FOREIGN KEY REFERENCES users(id).
 */
export const getCanonicalUserId = async (userId: string): Promise<string> => {
  if (!userId) return userId;
  try {
    const res = await query(
      `SELECT id::text FROM users WHERE id::text = $1 OR firebase_uid = $1 LIMIT 1`,
      [userId]
    );
    return res.rows[0]?.id ? String(res.rows[0].id) : userId;
  } catch {
    return userId;
  }
};

/**
 * Checks whether a given database record owner/user ID matches the currently authenticated user,
 * taking into account both internal UUID and firebase_uid.
 */
export const isUserMatch = (
  dbOwnerId: string | null | undefined,
  currentUserId: string | null | undefined,
  resolvedIds?: string[]
): boolean => {
  if (!dbOwnerId || !currentUserId) return false;
  if (dbOwnerId === currentUserId) return true;
  if (resolvedIds && resolvedIds.includes(String(dbOwnerId))) return true;
  return false;
};

