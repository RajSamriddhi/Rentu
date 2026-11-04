import { query } from '../config/db';

/**
 * Resolves all database identifiers for a user (both internal ID UUID and firebase_uid).
 * This bridges the dual-identity mapping between Firebase Auth and PostgreSQL.
 */
export const resolveUserIds = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  try {
    const res = await query(
      `SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`,
      [userId]
    );
    const ids: string[] = [userId];
    if (res.rows[0]?.id && !ids.includes(String(res.rows[0].id))) {
      ids.push(String(res.rows[0].id));
    }
    if (res.rows[0]?.firebase_uid && !ids.includes(String(res.rows[0].firebase_uid))) {
      ids.push(String(res.rows[0].firebase_uid));
    }
    return ids;
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

