"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUserMatch = exports.getCanonicalUserId = exports.resolveUserIds = void 0;
const db_1 = require("../config/db");
/**
 * Resolves all database identifiers for a user (both internal ID UUID and firebase_uid).
 * This bridges the dual-identity mapping between Firebase Auth and PostgreSQL.
 */
const resolveUserIds = async (userId) => {
    if (!userId)
        return [];
    try {
        const res = await (0, db_1.query)(`SELECT id::text, firebase_uid FROM users WHERE id::text = $1 OR firebase_uid = $1`, [userId]);
        const ids = [userId];
        if (res.rows[0]?.id && !ids.includes(String(res.rows[0].id))) {
            ids.push(String(res.rows[0].id));
        }
        if (res.rows[0]?.firebase_uid && !ids.includes(String(res.rows[0].firebase_uid))) {
            ids.push(String(res.rows[0].firebase_uid));
        }
        return ids;
    }
    catch {
        return [userId];
    }
};
exports.resolveUserIds = resolveUserIds;
/**
 * Resolves the canonical internal users(id) primary key UUID for a given userId.
 * Used for inserting into tables with strict FOREIGN KEY REFERENCES users(id).
 */
const getCanonicalUserId = async (userId) => {
    if (!userId)
        return userId;
    try {
        const res = await (0, db_1.query)(`SELECT id::text FROM users WHERE id::text = $1 OR firebase_uid = $1 LIMIT 1`, [userId]);
        return res.rows[0]?.id ? String(res.rows[0].id) : userId;
    }
    catch {
        return userId;
    }
};
exports.getCanonicalUserId = getCanonicalUserId;
/**
 * Checks whether a given database record owner/user ID matches the currently authenticated user,
 * taking into account both internal UUID and firebase_uid.
 */
const isUserMatch = (dbOwnerId, currentUserId, resolvedIds) => {
    if (!dbOwnerId || !currentUserId)
        return false;
    if (dbOwnerId === currentUserId)
        return true;
    if (resolvedIds && resolvedIds.includes(String(dbOwnerId)))
        return true;
    return false;
};
exports.isUserMatch = isUserMatch;
