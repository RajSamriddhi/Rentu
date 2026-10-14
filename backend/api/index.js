"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app,
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);

// src/app.ts
var import_express8 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));

// src/modules/auth/auth.routes.ts
var import_express = require("express");
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"));
var import_zod = require("zod");

// src/config/db.ts
var import_pg = require("pg");

// src/config/env.ts
var import_dotenv = __toESM(require("dotenv"));
import_dotenv.default.config();
var ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres.mkvpscrnqvkaddpmqtbm:dimty9-botgeF-gisfej@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
  JWT_SECRET: process.env.JWT_SECRET || "super-secret-borrowflex-key-2026-v1",
  NODE_ENV: process.env.NODE_ENV || "production",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "rentu-732b7",
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mkvpscrnqvkaddpmqtbm.supabase.co",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_4vho7OeDJupwXGGZn7TDFQ_Uryz7NwR",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
};

// src/config/db.ts
var isRemote = ENV.DATABASE_URL.includes("supabase.co") || ENV.DATABASE_URL.includes("pooler") || ENV.NODE_ENV === "production";
var pool = new import_pg.Pool({
  connectionString: ENV.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : void 0,
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 5e3
});
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
});
var query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (ENV.NODE_ENV === "development" && duration > 100) {
    console.log(`Executed query in ${duration}ms: ${text.slice(0, 80)}`);
  }
  return res;
};

// src/middleware/response.ts
var sendSuccess = (res, data, message, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...message ? { message } : {}
  });
};
var sendError = (res, code, message, statusCode = 400, details) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...details ? { details } : {}
    }
  });
};

// src/middleware/auth.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
if (ENV.FIREBASE_PROJECT_ID && (0, import_app.getApps)().length === 0) {
  try {
    (0, import_app.initializeApp)({
      projectId: ENV.FIREBASE_PROJECT_ID
    });
  } catch (err) {
    console.warn("Firebase Admin initialization notice:", err);
  }
}
async function resolveUserFromToken(token) {
  try {
    const decoded = import_jsonwebtoken.default.verify(token, ENV.JWT_SECRET);
    if (decoded && decoded.id) {
      const checkRes = await query(
        "SELECT id, email, role, name FROM users WHERE id = $1 OR (email = $2 AND email IS NOT NULL)",
        [decoded.id, decoded.email || ""]
      );
      if (checkRes.rows.length > 0) {
        const u = checkRes.rows[0];
        return { id: u.id, email: u.email, role: u.role, name: u.name };
      }
      await query(`
        INSERT INTO users (id, name, email, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
      `, [decoded.id, decoded.name || "User", decoded.email || `${decoded.id}@user.internal`, decoded.role || "USER"]).catch(() => {
      });
      return decoded;
    }
  } catch {
  }
  if (ENV.FIREBASE_PROJECT_ID) {
    try {
      let firebaseUid = null;
      let email = "";
      let name = "User";
      try {
        const decodedFb = await (0, import_auth.getAuth)().verifyIdToken(token);
        if (decodedFb && decodedFb.uid) {
          firebaseUid = decodedFb.uid;
          email = decodedFb.email || `${decodedFb.uid}@firebase.rentu.internal`;
          name = decodedFb.name || "User";
        }
      } catch {
        const decodedRaw = import_jsonwebtoken.default.decode(token);
        if (decodedRaw && (decodedRaw.aud === ENV.FIREBASE_PROJECT_ID || decodedRaw.iss?.includes("securetoken.google.com"))) {
          firebaseUid = decodedRaw.user_id || decodedRaw.sub;
          email = decodedRaw.email || `${firebaseUid}@firebase.rentu.internal`;
          name = decodedRaw.name || "User";
        }
      }
      if (firebaseUid) {
        let userRes = await query(
          "SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2 OR email = $3",
          [firebaseUid, firebaseUid, email]
        );
        if (userRes.rows.length === 0) {
          await query(`
            INSERT INTO users (id, firebase_uid, name, email, role)
            VALUES ($1, $2, $3, $4, 'USER')
            ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid;
          `, [
            firebaseUid,
            firebaseUid,
            name,
            email
          ]).catch(() => {
          });
          userRes = await query(
            "SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1",
            [firebaseUid]
          );
        }
        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          return { id: u.id, email: u.email, role: u.role, name: u.name };
        }
      }
    } catch {
    }
  }
  if (token.startsWith("fb_")) {
    const rawUid = token.replace(/^fb_/, "");
    try {
      let userRes = await query(
        "SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $2",
        [rawUid, rawUid]
      );
      if (userRes.rows.length === 0) {
        await query(`
          INSERT INTO users (id, firebase_uid, name, email, role)
          VALUES ($1, $1, $2, $3, 'USER')
          ON CONFLICT (id) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid;
        `, [rawUid, "Rentu Member", `${rawUid}@firebase.rentu.internal`]).catch(() => {
        });
        userRes = await query(
          "SELECT id, email, role, name FROM users WHERE firebase_uid = $1 OR id = $1",
          [rawUid]
        );
      }
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        return { id: u.id, email: u.email, role: u.role, name: u.name };
      }
    } catch (err) {
      console.warn("Failed to resolve fb_ fallback token:", err);
    }
  }
  return null;
}
var authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Access token required", 401);
  }
  const token = authHeader.split(" ")[1];
  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return sendError(res, "INVALID_TOKEN", "Session expired or token invalid", 401);
    }
    req.user = user;
    next();
  } catch (err) {
    return sendError(res, "INVALID_TOKEN", "Session expired or token invalid", 401);
  }
};
var optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const user = await resolveUserFromToken(token);
      if (user) {
        req.user = user;
      }
    } catch {
    }
  }
  next();
};

// src/modules/auth/auth.routes.ts
var router = (0, import_express.Router)();
var registerSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email address format"),
  password: import_zod.z.string().min(6, "Password must be at least 6 characters"),
  name: import_zod.z.string().optional(),
  phone: import_zod.z.string().optional(),
  locality: import_zod.z.string().optional(),
  avatar_url: import_zod.z.string().url().optional(),
  bio: import_zod.z.string().optional()
});
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email("Invalid email address format"),
  password: import_zod.z.string().min(1, "Password is required")
});
var generateToken = (user) => {
  return import_jsonwebtoken2.default.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    ENV.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
router.post("/register", async (req, res, next) => {
  try {
    const validated = registerSchema.parse(req.body);
    const email = validated.email.toLowerCase();
    const displayName = validated.name || email.split("@")[0];
    const locality = validated.locality || "";
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return sendError(res, "USER_EXISTS", "An account with this email already exists", 409);
    }
    const passwordHash = await import_bcryptjs.default.hash(validated.password, 10);
    const defaultAvatar = validated.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(displayName)}`;
    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, locality, avatar_url, bio, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'USER')
       RETURNING id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at`,
      [
        email,
        passwordHash,
        displayName,
        validated.phone || null,
        locality,
        defaultAvatar,
        validated.bio || "New member of the Rentu\u207A gear rental network \u26A1"
      ]
    );
    const user = result.rows[0];
    const token = generateToken(user);
    return sendSuccess(res, { user, token }, "Registration successful! Welcome to Rentu\u207A \u{1F680}", 201);
  } catch (error) {
    next(error);
  }
});
router.post("/login", async (req, res, next) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await query(
      `SELECT id, email, password_hash, name, phone, locality, avatar_url, bio, trust_score, role, created_at
       FROM users WHERE email = $1`,
      [validated.email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const user = result.rows[0];
    const isMatch = await import_bcryptjs.default.compare(validated.password, user.password_hash);
    if (!isMatch) {
      return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
    }
    const { password_hash, ...safeUser } = user;
    const token = generateToken(safeUser);
    return sendSuccess(res, { user: safeUser, token }, "Logged in successfully! \u{1F680}");
  } catch (error) {
    next(error);
  }
});
router.post("/demo-login", async (req, res, next) => {
  try {
    const { role = "lender" } = req.body;
    let targetEmail = "rohit@lens.com";
    if (role === "borrower") targetEmail = "ananya@studio.com";
    if (role === "admin") targetEmail = "admin@borrowflex.com";
    if (role === "creator") targetEmail = "kabir@vibes.com";
    const result = await query(
      `SELECT id, email, name, phone, locality, avatar_url, bio, trust_score, role, created_at
       FROM users WHERE email = $1`,
      [targetEmail]
    );
    if (result.rows.length === 0) {
      return sendError(res, "USER_NOT_FOUND", "Demo user not seeded yet", 404);
    }
    const user = result.rows[0];
    const token = generateToken(user);
    return sendSuccess(res, { user, token }, `Demo logged in as ${user.name}`);
  } catch (error) {
    next(error);
  }
});
var firebaseSyncSchema = import_zod.z.object({
  firebaseUid: import_zod.z.string().optional(),
  clerkId: import_zod.z.string().optional(),
  email: import_zod.z.string().email(),
  name: import_zod.z.string().min(1),
  avatarUrl: import_zod.z.string().optional(),
  locality: import_zod.z.string().optional(),
  phone: import_zod.z.string().optional()
});
var handleSyncUser = async (req, res, next) => {
  try {
    const validated = firebaseSyncSchema.parse(req.body);
    const uid = validated.firebaseUid || validated.clerkId || `fb_${Date.now()}`;
    const email = validated.email.toLowerCase();
    const avatar = validated.avatarUrl || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(validated.name)}`;
    const locality = validated.locality || "";
    const existing = await query(
      `SELECT id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, firebase_uid, created_at
       FROM users WHERE firebase_uid = $1 OR clerk_id = $2 OR email = $3`,
      [uid, uid, email]
    );
    let user;
    if (existing.rows.length > 0) {
      const updated = await query(
        `UPDATE users
         SET firebase_uid = $1,
             name = COALESCE(NULLIF($2, ''), name),
             avatar_url = COALESCE(avatar_url, NULLIF($3, '')),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
        [uid, validated.name, avatar, existing.rows[0].id]
      );
      user = updated.rows[0];
    } else {
      const created = await query(
        `INSERT INTO users (id, firebase_uid, email, name, phone, locality, avatar_url, bio, trust_score, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 85, 'USER')
         RETURNING id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at`,
        [
          uid,
          uid,
          email,
          validated.name,
          validated.phone || null,
          locality,
          avatar,
          "Member of the Rentu\u207A gear rental community \u26A1"
        ]
      );
      user = created.rows[0];
    }
    const token = generateToken(user);
    return sendSuccess(res, { user, token }, "Firebase session synchronized with Rentu\u207A! \u{1F680}");
  } catch (error) {
    next(error);
  }
};
router.post("/firebase-sync", handleSyncUser);
router.post("/clerk-sync", handleSyncUser);
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, name, phone, locality, address_text, pincode, rating, avatar_url, banner_url, bio, trust_score, role, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return sendError(res, "USER_NOT_FOUND", "User profile not found", 404);
    }
    const user = result.rows[0];
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1) AS lent_count,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1) AS borrowed_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_rents,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`,
      [user.id]
    );
    return sendSuccess(res, {
      ...user,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});
var auth_routes_default = router;

// src/modules/items/items.routes.ts
var import_express2 = require("express");
var import_zod2 = require("zod");

// src/utils/city.ts
function extractCity(locality) {
  if (!locality) return "Delhi";
  const loc = locality.toLowerCase();
  if (loc.includes("bangalore") || loc.includes("bengaluru") || loc.includes("koramangala") || loc.includes("kengeri") || loc.includes("indiranagar") || loc.includes("whitefield") || loc.includes("hsr")) {
    return "Bangalore";
  }
  if (loc.includes("mumbai") || loc.includes("bandra") || loc.includes("powai") || loc.includes("andheri") || loc.includes("juhu") || loc.includes("colaba")) {
    return "Mumbai";
  }
  return "Delhi";
}

// src/modules/items/items.routes.ts
var router2 = (0, import_express2.Router)();
var createItemSchema = import_zod2.z.object({
  title: import_zod2.z.string().min(3, "Title must be at least 3 characters"),
  description: import_zod2.z.string().min(10, "Description must be at least 10 characters"),
  category: import_zod2.z.string().min(2, "Category is required"),
  price_per_day: import_zod2.z.number().positive("Price per day must be greater than 0"),
  max_duration_days: import_zod2.z.number().int().positive().default(3),
  image_urls: import_zod2.z.array(import_zod2.z.string().url()).min(1, "At least one photo is required"),
  sticker_badge: import_zod2.z.string().default("\u2728 Weekend Flex"),
  locality: import_zod2.z.string().min(2, "Locality is required"),
  address_text: import_zod2.z.string().optional(),
  pincode: import_zod2.z.string().optional(),
  latitude: import_zod2.z.number().optional(),
  longitude: import_zod2.z.number().optional()
});
var updateItemSchema = import_zod2.z.object({
  title: import_zod2.z.string().min(3).optional(),
  description: import_zod2.z.string().min(10).optional(),
  category: import_zod2.z.string().optional(),
  price_per_day: import_zod2.z.number().positive().optional(),
  max_duration_days: import_zod2.z.number().int().positive().optional(),
  image_urls: import_zod2.z.array(import_zod2.z.string().url()).optional(),
  sticker_badge: import_zod2.z.string().optional(),
  locality: import_zod2.z.string().optional(),
  address_text: import_zod2.z.string().optional(),
  pincode: import_zod2.z.string().optional(),
  latitude: import_zod2.z.number().optional(),
  longitude: import_zod2.z.number().optional(),
  status: import_zod2.z.enum(["AVAILABLE", "RENTED", "UNAVAILABLE"]).optional()
});
router2.get("/", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const {
      category,
      search,
      locality,
      status = "AVAILABLE",
      ownerId,
      latitude,
      longitude,
      radar,
      max_distance
    } = req.query;
    const params = [];
    let distanceField = "NULL AS distance_meters";
    let distanceFilter = "";
    if (latitude && longitude) {
      const latNum = parseFloat(String(latitude));
      const lonNum = parseFloat(String(longitude));
      if (!isNaN(latNum) && !isNaN(lonNum)) {
        params.push(latNum);
        const latIdx = params.length;
        params.push(lonNum);
        const lonIdx = params.length;
        distanceField = `
          ROUND(
            6371000 * acos(
              LEAST(1.0, GREATEST(-1.0, 
                cos(radians($${latIdx})) * cos(radians(i.latitude)) *
                cos(radians(i.longitude) - radians($${lonIdx})) +
                sin(radians($${latIdx})) * sin(radians(i.latitude))
              ))
            )
          ) AS distance_meters
        `;
        if (radar === "true" || radar === "100m" || max_distance) {
          const limitMeters = max_distance ? parseFloat(String(max_distance)) : 100;
          params.push(limitMeters);
          distanceFilter = ` AND (
            6371000 * acos(
              LEAST(1.0, GREATEST(-1.0, 
                cos(radians($${latIdx})) * cos(radians(i.latitude)) *
                cos(radians(i.longitude) - radians($${lonIdx})) +
                sin(radians($${latIdx})) * sin(radians(i.latitude))
              ))
            )
          ) <= $${params.length}`;
        }
      }
    }
    let sql = `
      SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.address_text, i.latitude, i.longitude, i.status, i.created_at,
        ${distanceField},
        COALESCE(u.id, i.owner_id) AS owner_id, 
        COALESCE(u.name, 'Community Member') AS owner_name, 
        u.avatar_url AS owner_avatar,
        COALESCE(u.locality, i.locality) AS owner_locality, 
        COALESCE(u.trust_score, 98) AS owner_trust_score,
        COALESCE(u.rating, 5.00) AS owner_rating
      FROM items i
      LEFT JOIN users u ON i.owner_id = u.id
      WHERE 1=1 ${distanceFilter}
    `;
    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }
    if (category && category !== "All") {
      params.push(category);
      sql += ` AND i.category = $${params.length}`;
    }
    if (ownerId) {
      params.push(ownerId);
      sql += ` AND i.owner_id = $${params.length}`;
    } else if (locality) {
      const city = extractCity(String(locality));
      if (city) {
        params.push(`%${city}%`);
        sql += ` AND (i.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      }
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (i.title ILIKE $${params.length} OR i.description ILIKE $${params.length} OR i.category ILIKE $${params.length})`;
    }
    if (radar === "true" || radar === "100m") {
      sql += ` ORDER BY distance_meters ASC, i.created_at DESC`;
    } else {
      sql += ` ORDER BY i.created_at DESC`;
    }
    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router2.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        i.id, i.title, i.description, i.category, i.price_per_day, 
        i.max_duration_days, i.image_urls, i.sticker_badge, i.locality, 
        i.status, i.created_at,
        u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
        u.bio AS owner_bio, u.trust_score AS owner_trust_score, u.locality AS owner_locality,
        u.email AS owner_email, u.phone AS owner_phone
      FROM items i
      JOIN users u ON i.owner_id = u.id
      WHERE i.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    const item = result.rows[0];
    const itemCity = extractCity(item.locality);
    const relatedResult = await query(
      `SELECT id, title, category, price_per_day, image_urls, sticker_badge, locality, status
       FROM items
       WHERE category = $1 AND id != $2 AND status = 'AVAILABLE' AND locality ILIKE $3
       LIMIT 4`,
      [item.category, item.id, `%${itemCity}%`]
    );
    return sendSuccess(res, {
      ...item,
      related_items: relatedResult.rows
    });
  } catch (error) {
    next(error);
  }
});
router2.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = createItemSchema.parse(req.body);
    await query(`
      INSERT INTO users (id, name, email, role, locality)
      VALUES ($1, $2, $3, 'USER', $4)
      ON CONFLICT (id) DO NOTHING;
    `, [
      req.user.id,
      req.user.name || "Rentu Member",
      req.user.email || `${req.user.id}@firebase.rentu.internal`,
      validated.locality || ""
    ]).catch(() => {
    });
    const userRes = await query("SELECT locality FROM users WHERE id = $1", [req.user.id]);
    const userLocality = userRes.rows[0]?.locality || "";
    let finalLocality = validated.locality?.trim() || userLocality;
    const cleanPincode = validated.pincode?.trim() || null;
    if (cleanPincode && finalLocality) {
      await query(
        `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
        [cleanPincode, finalLocality]
      ).catch(() => {
      });
    }
    const result = await query(
      `INSERT INTO items 
        (owner_id, title, description, category, price_per_day, max_duration_days, image_urls, sticker_badge, locality, address_text, pincode, latitude, longitude, status)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, 'AVAILABLE')
       RETURNING *`,
      [
        req.user.id,
        validated.title,
        validated.description,
        validated.category,
        validated.price_per_day,
        validated.max_duration_days,
        JSON.stringify(validated.image_urls),
        validated.sticker_badge,
        finalLocality,
        validated.address_text || finalLocality,
        cleanPincode,
        validated.latitude || 28.5355,
        validated.longitude || 77.2167
      ]
    );
    const createdItem = result.rows[0];
    if (Array.isArray(validated.image_urls) && validated.image_urls.length > 0) {
      for (let i = 0; i < validated.image_urls.length; i++) {
        await query(
          `INSERT INTO item_images (item_id, image_url, display_order) VALUES ($1, $2, $3)`,
          [createdItem.id, validated.image_urls[i], i]
        ).catch(() => {
        });
      }
    }
    return sendSuccess(res, createdItem, "Gear listed successfully! \u2728 It is now live on the feed.", 201);
  } catch (error) {
    next(error);
  }
});
router2.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = updateItemSchema.parse(req.body);
    const check = await query("SELECT owner_id FROM items WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== "ADMIN") {
      return sendError(res, "FORBIDDEN", "You do not have permission to edit this listing", 403);
    }
    const fields = [];
    const values = [];
    if (validated.title !== void 0) {
      values.push(validated.title);
      fields.push(`title = $${values.length}`);
    }
    if (validated.description !== void 0) {
      values.push(validated.description);
      fields.push(`description = $${values.length}`);
    }
    if (validated.category !== void 0) {
      values.push(validated.category);
      fields.push(`category = $${values.length}`);
    }
    if (validated.price_per_day !== void 0) {
      values.push(validated.price_per_day);
      fields.push(`price_per_day = $${values.length}`);
    }
    if (validated.max_duration_days !== void 0) {
      values.push(validated.max_duration_days);
      fields.push(`max_duration_days = $${values.length}`);
    }
    if (validated.image_urls !== void 0) {
      values.push(JSON.stringify(validated.image_urls));
      fields.push(`image_urls = $${values.length}::jsonb`);
    }
    if (validated.sticker_badge !== void 0) {
      values.push(validated.sticker_badge);
      fields.push(`sticker_badge = $${values.length}`);
    }
    if (validated.locality !== void 0) {
      values.push(validated.locality);
      fields.push(`locality = $${values.length}`);
    }
    if (validated.status !== void 0) {
      values.push(validated.status);
      fields.push(`status = $${values.length}`);
    }
    if (fields.length === 0) {
      return sendError(res, "BAD_REQUEST", "No fields provided for update", 400);
    }
    values.push(id);
    const updateSql = `
      UPDATE items 
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING *
    `;
    const result = await query(updateSql, values);
    return sendSuccess(res, result.rows[0], "Listing updated successfully");
  } catch (error) {
    next(error);
  }
});
router2.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const check = await query("SELECT owner_id FROM items WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    if (check.rows[0].owner_id !== req.user.id && req.user.role !== "ADMIN") {
      return sendError(res, "FORBIDDEN", "Permission denied", 403);
    }
    await query("DELETE FROM items WHERE id = $1", [id]);
    return sendSuccess(res, { id }, "Listing deleted successfully");
  } catch (error) {
    next(error);
  }
});
var items_routes_default = router2;

// src/modules/requests/requests.routes.ts
var import_express3 = require("express");
var import_zod3 = require("zod");
var router3 = (0, import_express3.Router)();
var createRequestSchema = import_zod3.z.object({
  item_name: import_zod3.z.string().min(3, "Item name must be at least 3 characters"),
  description: import_zod3.z.string().min(5, "Description is required"),
  category: import_zod3.z.string().default("Other"),
  start_date: import_zod3.z.string().min(1, "Needed date is required"),
  start_time: import_zod3.z.string().optional(),
  duration_days: import_zod3.z.number().int().positive().default(1),
  offered_amount: import_zod3.z.number().positive("Offered budget must be greater than 0"),
  locality: import_zod3.z.string().min(2, "Locality is required"),
  address_text: import_zod3.z.string().optional(),
  pincode: import_zod3.z.string().optional(),
  latitude: import_zod3.z.number().optional(),
  longitude: import_zod3.z.number().optional()
});
router3.get("/", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const { category, locality, status = "OPEN", seekerId } = req.query;
    let sql = `
      SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        COALESCE(u.id, r.seeker_id) AS seeker_id, 
        COALESCE(u.name, 'Community Member') AS seeker_name, 
        u.avatar_url AS seeker_avatar,
        COALESCE(u.locality, r.locality) AS seeker_locality, 
        COALESCE(u.trust_score, 98) AS seeker_trust_score,
        u.phone AS seeker_phone, 
        u.email AS seeker_email
      FROM requests r
      LEFT JOIN users u ON r.seeker_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (status && status !== "ALL") {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (category && category !== "All") {
      params.push(category);
      sql += ` AND r.category = $${params.length}`;
    }
    if (seekerId) {
      params.push(seekerId);
      sql += ` AND r.seeker_id = $${params.length}`;
    } else if (locality) {
      const city = extractCity(String(locality));
      if (city) {
        params.push(`%${city}%`);
        sql += ` AND (r.locality ILIKE $${params.length} OR u.locality ILIKE $${params.length})`;
      }
    }
    sql += ` ORDER BY r.created_at DESC`;
    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router3.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        r.id, r.item_name, r.description, r.category, 
        r.start_date, r.start_time, r.duration_days, 
        r.offered_amount, r.locality, r.status, r.created_at,
        u.id AS seeker_id, u.name AS seeker_name, u.avatar_url AS seeker_avatar,
        u.locality AS seeker_locality, u.trust_score AS seeker_trust_score,
        u.phone AS seeker_phone, u.email AS seeker_email
      FROM requests r
      JOIN users u ON r.seeker_id = u.id
      WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Wish request not found", 404);
    }
    return sendSuccess(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});
router3.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = createRequestSchema.parse(req.body);
    await query(`
      INSERT INTO users (id, name, email, role, locality)
      VALUES ($1, $2, $3, 'USER', $4)
      ON CONFLICT (id) DO NOTHING;
    `, [
      req.user.id,
      req.user.name || "Rentu Member",
      req.user.email || `${req.user.id}@firebase.rentu.internal`,
      validated.locality || ""
    ]).catch(() => {
    });
    let finalLocality = validated.locality?.trim() || "";
    const cleanPincode = validated.pincode?.trim() || null;
    if (cleanPincode && finalLocality) {
      await query(
        `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
        [cleanPincode, finalLocality]
      ).catch(() => {
      });
    }
    const result = await query(
      `INSERT INTO requests
        (seeker_id, item_name, description, category, start_date, start_time, duration_days, offered_amount, locality, address_text, pincode, latitude, longitude, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'OPEN')
       RETURNING *`,
      [
        req.user.id,
        validated.item_name,
        validated.description,
        validated.category,
        validated.start_date,
        validated.start_time || "10:00",
        validated.duration_days,
        validated.offered_amount,
        finalLocality,
        validated.address_text || finalLocality,
        cleanPincode,
        validated.latitude || 28.5355,
        validated.longitude || 77.2167
      ]
    );
    const createdRequest = result.rows[0];
    return sendSuccess(res, createdRequest, "Wish dropped to community feed! \u{1F3AF} Nearby owners will see your bounty.", 201);
  } catch (error) {
    next(error);
  }
});
router3.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = "FULFILLED" } = req.body;
    const check = await query("SELECT seeker_id, status FROM requests WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Wish request not found", 404);
    }
    const result = await query(
      `UPDATE requests
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return sendSuccess(res, result.rows[0], `Wish marked as ${status.toLowerCase()}! \u{1F91D}`);
  } catch (error) {
    next(error);
  }
});
router3.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const check = await query("SELECT seeker_id FROM requests WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Wish request not found", 404);
    }
    if (check.rows[0].seeker_id !== req.user.id && req.user.role !== "ADMIN") {
      return sendError(res, "FORBIDDEN", "Permission denied", 403);
    }
    await query("DELETE FROM requests WHERE id = $1", [id]);
    return sendSuccess(res, { id }, "Wish request deleted");
  } catch (error) {
    next(error);
  }
});
var requests_routes_default = router3;

// src/modules/bookings/bookings.routes.ts
var import_express4 = require("express");
var import_zod4 = require("zod");
var router4 = (0, import_express4.Router)();
var createBookingSchema = import_zod4.z.object({
  item_id: import_zod4.z.string().uuid("Invalid item ID"),
  start_date: import_zod4.z.string().min(1, "Start date is required"),
  start_time: import_zod4.z.string().optional(),
  duration_days: import_zod4.z.number().int().positive("Duration must be at least 1 day"),
  message: import_zod4.z.string().optional()
});
var updateStatusSchema = import_zod4.z.object({
  status: import_zod4.z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"])
});
router4.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = createBookingSchema.parse(req.body);
    const borrowerId = req.user.id;
    const itemRes = await query("SELECT id, owner_id, price_per_day, title, status FROM items WHERE id = $1", [validated.item_id]);
    if (itemRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Item not found", 404);
    }
    const item = itemRes.rows[0];
    if (item.owner_id === borrowerId) {
      return sendError(res, "BAD_REQUEST", "You cannot borrow your own gear \u{1F609}", 400);
    }
    const totalPrice = Number(item.price_per_day) * validated.duration_days;
    const bookingRes = await query(
      `INSERT INTO bookings
        (item_id, borrower_id, lender_id, start_date, start_time, duration_days, total_price, status, message)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
       RETURNING *`,
      [
        item.id,
        borrowerId,
        item.owner_id,
        validated.start_date,
        validated.start_time || "10:00",
        validated.duration_days,
        totalPrice,
        validated.message || `Hey! Would love to rent your ${item.title}.`
      ]
    );
    const booking = bookingRes.rows[0];
    if (validated.message) {
      await query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, $4)`,
        [booking.id, borrowerId, item.owner_id, validated.message]
      );
    }
    return sendSuccess(res, booking, "Proposal sent to lender! You will be notified when they accept.", 201);
  } catch (error) {
    next(error);
  }
});
router4.get("/", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { role } = req.query;
    let sql = `
      SELECT 
        b.id, b.item_id, b.borrower_id, i.owner_id AS lender_id, 
        b.start_date, b.start_time, b.duration_days, 
        COALESCE(b.total_price, b.duration_days * i.price_per_day) AS total_price, 
        b.status, b.message, b.created_at,
        i.title AS item_title, i.image_urls AS item_images, i.category AS item_category,
        i.locality AS item_locality, i.price_per_day AS item_rate,
        borrower.name AS borrower_name, borrower.avatar_url AS borrower_avatar, 
        borrower.phone AS borrower_phone, borrower.email AS borrower_email,
        lender.name AS lender_name, lender.avatar_url AS lender_avatar,
        lender.phone AS lender_phone, lender.email AS lender_email
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      JOIN users borrower ON b.borrower_id = borrower.id
      JOIN users lender ON i.owner_id = lender.id
      WHERE (b.borrower_id = $1 OR i.owner_id = $1)
    `;
    const params = [userId];
    if (role === "borrower") {
      sql += ` AND b.borrower_id = $1`;
    } else if (role === "lender") {
      sql += ` AND i.owner_id = $1`;
    }
    sql += ` ORDER BY b.created_at DESC`;
    const result = await query(sql, params);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router4.patch("/:id/status", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);
    const userId = req.user.id;
    const bookingRes = await query(
      `SELECT b.*, i.title AS item_title, i.owner_id AS lender_id, lender.name AS lender_name, borrower.name AS borrower_name
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       JOIN users lender ON i.owner_id = lender.id
       JOIN users borrower ON b.borrower_id = borrower.id
       WHERE b.id = $1`,
      [id]
    );
    if (bookingRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Booking not found", 404);
    }
    const booking = bookingRes.rows[0];
    const isLender = booking.lender_id === userId;
    const isBorrower = booking.borrower_id === userId;
    const isAdmin = req.user.role === "ADMIN";
    if (!isLender && !isBorrower && !isAdmin) {
      return sendError(res, "FORBIDDEN", "Permission denied", 403);
    }
    if (status === "ACCEPTED" || status === "REJECTED") {
      if (!isLender && !isAdmin) {
        return sendError(res, "FORBIDDEN", "Only the gear owner can accept or reject proposals", 403);
      }
    }
    const updateRes = await query(
      `UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    if (status === "ACCEPTED") {
      await query(`UPDATE items SET status = 'RENTED' WHERE id = $1`, [booking.item_id]);
      await query(
        `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, '\u{1F389} Proposal accepted! You can now coordinate pickup/dropoff here.')`,
        [id, booking.lender_id, booking.borrower_id]
      );
    } else if (status === "COMPLETED" || status === "CANCELLED" || status === "REJECTED") {
      await query(`UPDATE items SET status = 'AVAILABLE' WHERE id = $1`, [booking.item_id]);
    }
    return sendSuccess(res, updateRes.rows[0], `Proposal updated to ${status}`);
  } catch (error) {
    next(error);
  }
});
var bookings_routes_default = router4;

// src/modules/analytics/analytics.routes.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
router5.get("/overview", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const pulseSql = `
      SELECT 
        (SELECT COUNT(*) FROM users)::int AS total_users,
        (SELECT COUNT(DISTINCT owner_id) FROM items)::int AS active_lenders,
        (SELECT COUNT(DISTINCT borrower_id) FROM bookings)::int AS active_borrowers,
        (SELECT COUNT(*) FROM items WHERE status = 'AVAILABLE')::int AS available_gear,
        (SELECT COUNT(*) FROM items WHERE status = 'RENTED')::int AS currently_rented_gear,
        (SELECT COUNT(*) FROM bookings)::int AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED')::int AS completed_bookings,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE status IN ('ACCEPTED', 'COMPLETED'))::numeric AS total_community_volume,
        (SELECT COUNT(*) FROM requests WHERE status = 'OPEN')::int AS open_wishes,
        (SELECT COUNT(*) FROM requests WHERE status = 'FULFILLED')::int AS fulfilled_wishes
    `;
    const pulseRes = await query(pulseSql);
    const pulse = pulseRes.rows[0];
    const categoryRes = await query(`
      SELECT 
        category, 
        COUNT(*)::int AS count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate
      FROM items
      GROUP BY category
      ORDER BY count DESC
    `);
    const topLendersRes = await query(`
      SELECT 
        u.id, u.name, u.avatar_url, u.locality, u.trust_score,
        COUNT(i.id)::int AS gear_count
      FROM users u
      JOIN items i ON u.id = i.owner_id
      GROUP BY u.id
      ORDER BY gear_count DESC
      LIMIT 5
    `);
    return sendSuccess(res, {
      pulse,
      categories: categoryRes.rows,
      topLenders: topLendersRes.rows
    });
  } catch (error) {
    next(error);
  }
});
router5.get("/categories", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        category, 
        COUNT(*)::int AS item_count, 
        ROUND(AVG(price_per_day), 0)::numeric AS avg_rate,
        (SELECT COUNT(*) FROM requests r WHERE r.category = i.category)::int AS demand_count
      FROM items i
      GROUP BY category
      ORDER BY item_count DESC
    `);
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
var analytics_routes_default = router5;

// src/modules/users/users.routes.ts
var import_express6 = require("express");
var import_zod5 = require("zod");
var router6 = (0, import_express6.Router)();
var updateProfileSchema = import_zod5.z.object({
  name: import_zod5.z.string().min(2).optional(),
  phone: import_zod5.z.string().optional(),
  locality: import_zod5.z.string().min(2).optional(),
  avatar_url: import_zod5.z.string().url().or(import_zod5.z.literal("")).optional(),
  banner_url: import_zod5.z.string().url().or(import_zod5.z.literal("")).optional(),
  bio: import_zod5.z.string().max(300).optional(),
  address_text: import_zod5.z.string().optional(),
  pincode: import_zod5.z.string().optional(),
  latitude: import_zod5.z.number().optional(),
  longitude: import_zod5.z.number().optional()
});
router6.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRes = await query(
      `SELECT id, name, locality, avatar_url, banner_url, bio, trust_score, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    if (userRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "User not found", 404);
    }
    const user = userRes.rows[0];
    const itemsRes = await query(
      `SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, status, created_at
       FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
       ORDER BY created_at DESC`,
      [id]
    );
    const statsRes = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1 AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count`,
      [id]
    );
    return sendSuccess(res, {
      ...user,
      items: itemsRes.rows,
      stats: statsRes.rows[0]
    });
  } catch (error) {
    next(error);
  }
});
router6.put("/profile", authMiddleware, async (req, res, next) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const userId = req.user.id;
    const fields = [];
    const values = [];
    if (validated.name !== void 0) {
      values.push(validated.name);
      fields.push(`name = $${values.length}`);
    }
    if (validated.phone !== void 0) {
      values.push(validated.phone);
      fields.push(`phone = $${values.length}`);
    }
    if (validated.locality !== void 0) {
      values.push(validated.locality);
      fields.push(`locality = $${values.length}`);
    }
    if (validated.avatar_url !== void 0) {
      values.push(validated.avatar_url);
      fields.push(`avatar_url = $${values.length}`);
    }
    if (validated.banner_url !== void 0) {
      values.push(validated.banner_url);
      fields.push(`banner_url = $${values.length}`);
    }
    if (validated.bio !== void 0) {
      values.push(validated.bio);
      fields.push(`bio = $${values.length}`);
    }
    if (validated.address_text !== void 0) {
      values.push(validated.address_text);
      fields.push(`address_text = $${values.length}`);
    }
    let cleanPincode = void 0;
    if (validated.pincode !== void 0) {
      cleanPincode = validated.pincode?.trim() || null;
      values.push(cleanPincode);
      fields.push(`pincode = $${values.length}`);
      if (cleanPincode && validated.locality) {
        await query(
          `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
          [cleanPincode, validated.locality]
        ).catch(() => {
        });
      }
    }
    if (validated.latitude !== void 0) {
      values.push(validated.latitude);
      fields.push(`latitude = $${values.length}`);
    }
    if (validated.longitude !== void 0) {
      values.push(validated.longitude);
      fields.push(`longitude = $${values.length}`);
    }
    if (fields.length === 0) {
      return sendError(res, "BAD_REQUEST", "No fields to update", 400);
    }
    values.push(userId);
    const updateSql = `
      UPDATE users 
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, created_at
    `;
    const result = await query(updateSql, values);
    const updatedUser = result.rows[0];
    return sendSuccess(res, updatedUser, "Profile updated successfully \u2728");
  } catch (error) {
    next(error);
  }
});
var users_routes_default = router6;

// src/modules/messages/messages.routes.ts
var import_express7 = require("express");
var import_zod6 = require("zod");
var router7 = (0, import_express7.Router)();
var sendMessageSchema = import_zod6.z.object({
  booking_id: import_zod6.z.string().uuid(),
  receiver_id: import_zod6.z.string().optional(),
  content: import_zod6.z.string().min(1, "Message cannot be empty")
});
router7.get("/conversations", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT DISTINCT ON (b.id)
        b.id AS booking_id,
        b.status AS booking_status,
        b.start_date,
        b.duration_days,
        b.total_price,
        i.title AS item_title,
        i.image_urls AS item_images,
        i.locality AS item_locality,
        CASE WHEN b.borrower_id = $1 THEN lender.id ELSE borrower.id END AS partner_id,
        CASE WHEN b.borrower_id = $1 THEN lender.name ELSE borrower.name END AS partner_name,
        CASE WHEN b.borrower_id = $1 THEN lender.avatar_url ELSE borrower.avatar_url END AS partner_avatar,
        CASE WHEN b.borrower_id = $1 THEN lender.phone ELSE borrower.phone END AS partner_phone,
        m.content AS last_message,
        m.created_at AS last_message_at
      FROM bookings b
      JOIN items i ON b.item_id = i.id
      JOIN users borrower ON b.borrower_id = borrower.id
      JOIN users lender ON i.owner_id = lender.id
      LEFT JOIN LATERAL (
        SELECT content, created_at FROM messages 
        WHERE booking_id = b.id 
        ORDER BY created_at DESC LIMIT 1
      ) m ON true
      WHERE (b.borrower_id = $1 OR b.lender_id = $1)
      ORDER BY b.id, m.created_at DESC NULLS LAST`,
      [userId]
    );
    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});
router7.get("/:bookingId", authMiddleware, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;
    const bookingRes = await query(
      `SELECT b.*, i.title AS item_title, i.image_urls AS item_images, i.price_per_day
       FROM bookings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = $1 AND (b.borrower_id = $2 OR b.lender_id = $2)`,
      [bookingId, userId]
    );
    if (bookingRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Conversation not found or access denied", 404);
    }
    const messagesRes = await query(
      `SELECT 
        m.id, m.booking_id, m.sender_id, m.receiver_id, m.content, m.created_at,
        u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC`,
      [bookingId]
    );
    return sendSuccess(res, {
      booking: bookingRes.rows[0],
      messages: messagesRes.rows
    });
  } catch (error) {
    next(error);
  }
});
router7.post("/", authMiddleware, async (req, res, next) => {
  try {
    const validated = sendMessageSchema.parse(req.body);
    const senderId = req.user.id;
    const bookingRes = await query(
      `SELECT b.id, b.borrower_id, i.owner_id AS lender_id 
       FROM bookings b 
       JOIN items i ON b.item_id = i.id 
       WHERE b.id = $1`,
      [validated.booking_id]
    );
    if (bookingRes.rows.length === 0) {
      return sendError(res, "NOT_FOUND", "Booking not found", 404);
    }
    const booking = bookingRes.rows[0];
    if (booking.borrower_id !== senderId && booking.lender_id !== senderId) {
      return sendError(res, "FORBIDDEN", "Cannot send message to this booking", 403);
    }
    const targetReceiver = validated.receiver_id || (booking.borrower_id === senderId ? booking.lender_id : booking.borrower_id);
    const result = await query(
      `INSERT INTO messages (booking_id, sender_id, receiver_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [validated.booking_id, senderId, targetReceiver, validated.content]
    );
    return sendSuccess(res, result.rows[0], "Message sent");
  } catch (error) {
    next(error);
  }
});
var messages_routes_default = router7;

// src/middleware/error.ts
var import_zod7 = require("zod");
var errorHandler = (err, req, res, next) => {
  if (err instanceof import_zod7.ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message
    }));
    return sendError(res, "VALIDATION_ERROR", "Input validation failed", 400, details);
  }
  console.error("Unhandled Server Error:", err);
  return sendError(
    res,
    "INTERNAL_SERVER_ERROR",
    err.message || "An unexpected internal error occurred",
    500
  );
};

// src/app.ts
var createApp = () => {
  const app2 = (0, import_express8.default)();
  app2.use((0, import_cors.default)({ origin: true, credentials: true }));
  app2.use(import_express8.default.json({ limit: "10mb" }));
  app2.use(import_express8.default.urlencoded({ extended: true }));
  app2.get(["/api/health", "/health"], async (req, res) => {
    let dbStatus = "disconnected";
    try {
      await query("SELECT 1");
      dbStatus = "connected";
    } catch (err) {
      dbStatus = `error: ${err.message}`;
    }
    return sendSuccess(res, {
      status: "healthy",
      app: "Rentu\u207A Headless REST API",
      version: "1.0.0",
      database: dbStatus,
      supabase: {
        configured: Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY),
        url: ENV.SUPABASE_URL || "not_configured"
      },
      firebase: {
        configured: Boolean(ENV.FIREBASE_PROJECT_ID),
        projectId: ENV.FIREBASE_PROJECT_ID
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.use(["/api/auth", "/auth"], auth_routes_default);
  app2.use(["/api/items", "/items"], items_routes_default);
  app2.use(["/api/requests", "/requests"], requests_routes_default);
  app2.use(["/api/bookings", "/bookings"], bookings_routes_default);
  app2.use(["/api/analytics", "/analytics"], analytics_routes_default);
  app2.use(["/api/users", "/users"], users_routes_default);
  app2.use(["/api/messages", "/messages"], messages_routes_default);
  app2.use((req, res) => {
    return sendError(res, "ROUTE_NOT_FOUND", `Cannot ${req.method} ${req.originalUrl}`, 404);
  });
  app2.use(errorHandler);
  return app2;
};

// src/db/migrate.ts
var runMigrations = async () => {
  console.log("Running database migrations (Supabase Compatible)...");
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`).catch(() => {
    });
    await client.query(`CREATE EXTENSION IF NOT EXISTS "postgis";`).catch(() => {
      console.log("PostGIS extension not available locally; using Haversine proximity formulas.");
    });
    await client.query("BEGIN");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
          CREATE TYPE item_status AS ENUM ('AVAILABLE', 'RENTED', 'UNAVAILABLE');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
          CREATE TYPE request_status AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
          CREATE TYPE booking_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');
        END IF;
      END $$;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        phone VARCHAR(20),
        bio TEXT DEFAULT 'Creator & Gear Sharer',
        avatar_url TEXT,
        address_text TEXT,
        locality VARCHAR(120),
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        rating NUMERIC(3, 2) DEFAULT 5.00,
        trust_score INT DEFAULT 98,
        role user_role DEFAULT 'USER',
        clerk_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS address_text TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_locality ON users(locality);
      CREATE INDEX IF NOT EXISTS idx_users_coords ON users(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id TEXT NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        category VARCHAR(60) NOT NULL,
        price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day >= 0),
        max_duration_days INTEGER DEFAULT 3 CHECK (max_duration_days > 0),
        image_urls JSONB DEFAULT '[]'::JSONB,
        sticker_badge VARCHAR(50) DEFAULT '\u2728 Weekend Flex',
        locality VARCHAR(120),
        address_text TEXT DEFAULT 'South Delhi',
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION DEFAULT 28.5355,
        longitude DOUBLE PRECISION DEFAULT 77.2167,
        status item_status DEFAULT 'AVAILABLE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE items ADD COLUMN IF NOT EXISTS address_text TEXT DEFAULT 'South Delhi';
      ALTER TABLE items ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE items ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 28.5355;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 77.2167;

      CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_coords ON items(latitude, longitude);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seeker_id TEXT NOT NULL,
        item_name VARCHAR(150) NOT NULL,
        description TEXT,
        category VARCHAR(60),
        start_date DATE NOT NULL,
        start_time TIME,
        duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days > 0),
        offered_amount NUMERIC(10, 2) NOT NULL CHECK (offered_amount >= 0),
        locality VARCHAR(120),
        address_text TEXT DEFAULT 'South Delhi',
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION DEFAULT 28.5355,
        longitude DOUBLE PRECISION DEFAULT 77.2167,
        status request_status DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE requests ADD COLUMN IF NOT EXISTS address_text TEXT DEFAULT 'South Delhi';
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 28.5355;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 77.2167;

      CREATE INDEX IF NOT EXISTS idx_requests_seeker ON requests(seeker_id);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
      CREATE INDEX IF NOT EXISTS idx_requests_coords ON requests(latitude, longitude);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
        borrower_id TEXT NOT NULL,
        lender_id TEXT NOT NULL,
        start_date DATE NOT NULL,
        start_time TIME,
        duration_days INTEGER NOT NULL CHECK (duration_days > 0),
        total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
        status booking_status DEFAULT 'PENDING',
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_borrower ON bookings(borrower_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_lender ON bookings(lender_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
      ALTER TABLE messages ALTER COLUMN receiver_id DROP NOT NULL;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS postal_codes (
        pincode VARCHAR(10) PRIMARY KEY,
        locality VARCHAR(120) NOT NULL,
        city VARCHAR(120),
        state VARCHAR(120),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_postal_codes_locality ON postal_codes(locality);

      -- Backfill postal_codes from existing distinct pincodes and localities
      INSERT INTO postal_codes (pincode, locality)
      SELECT DISTINCT pincode, locality FROM users 
      WHERE pincode IS NOT NULL AND locality IS NOT NULL AND pincode != ''
      ON CONFLICT (pincode) DO NOTHING;

      INSERT INTO postal_codes (pincode, locality)
      SELECT DISTINCT pincode, locality FROM items 
      WHERE pincode IS NOT NULL AND locality IS NOT NULL AND pincode != ''
      ON CONFLICT (pincode) DO NOTHING;

      INSERT INTO postal_codes (pincode, locality)
      SELECT DISTINCT pincode, locality FROM requests 
      WHERE pincode IS NOT NULL AND locality IS NOT NULL AND pincode != ''
      ON CONFLICT (pincode) DO NOTHING;

      INSERT INTO postal_codes (pincode, locality, city, state)
      VALUES 
        ('560001', 'MG Road / Central', 'Bangalore', 'Karnataka'),
        ('560038', 'Indiranagar', 'Bangalore', 'Karnataka'),
        ('560034', 'Koramangala', 'Bangalore', 'Karnataka'),
        ('560059', 'Mylasandra / Global Village', 'Bangalore', 'Karnataka'),
        ('560060', 'Kengeri Satellite Town', 'Bangalore', 'Karnataka'),
        ('110017', 'Saket', 'New Delhi', 'Delhi'),
        ('110016', 'Hauz Khas', 'New Delhi', 'Delhi'),
        ('400050', 'Bandra West', 'Mumbai', 'Maharashtra'),
        ('400076', 'Powai', 'Mumbai', 'Maharashtra')
      ON CONFLICT (pincode) DO NOTHING;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);

      -- Backfill item_images from existing items.image_urls JSON array
      INSERT INTO item_images (item_id, image_url, display_order)
      SELECT i.id, img.val, img.ord - 1
      FROM items i,
      LATERAL jsonb_array_elements_text(COALESCE(NULLIF(i.image_urls, 'null'::jsonb), '[]'::jsonb)) WITH ORDINALITY AS img(val, ord)
      WHERE NOT EXISTS (SELECT 1 FROM item_images WHERE item_id = i.id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
        reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reviewee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating NUMERIC(3, 2) NOT NULL CHECK (rating >= 1.00 AND rating <= 5.00),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(150) NOT NULL,
        body TEXT NOT NULL,
        sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        reference_id TEXT,
        reference_type VARCHAR(50),
        data JSONB,
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS booking_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

      -- Backfill notifications atomic columns from data JSON
      UPDATE notifications
      SET sender_id = COALESCE(sender_id, data->>'sender_id'),
          booking_id = COALESCE(booking_id, NULLIF(data->>'booking_id', '')::uuid),
          message_id = COALESCE(message_id, NULLIF(data->>'message_id', '')::uuid)
      WHERE data IS NOT NULL AND (sender_id IS NULL OR booking_id IS NULL);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
    `);
    await client.query(`
      -- 3NF Bookings View: lender_id derived via items.owner_id; total_price computed dynamically
      CREATE OR REPLACE VIEW bookings_3nf_v AS
      SELECT 
        b.id,
        b.item_id,
        b.borrower_id,
        i.owner_id AS lender_id,
        b.start_date,
        b.start_time,
        b.duration_days,
        (b.duration_days * i.price_per_day) AS total_price,
        b.status,
        b.message,
        b.created_at,
        b.updated_at
      FROM bookings b
      JOIN items i ON b.item_id = i.id;

      -- 3NF User Scores View: rating & trust_score computed on-the-fly from reviews & completed transactions
      CREATE OR REPLACE VIEW user_scores_3nf_v AS
      SELECT 
        u.id AS user_id,
        ROUND(COALESCE(AVG(r.rating), 5.00), 2) AS rating,
        COUNT(r.id) AS review_count,
        LEAST(100, GREATEST(50, 70 + (COUNT(r.id) * 5) + (
          SELECT COUNT(*) FROM bookings b 
          JOIN items i ON b.item_id = i.id
          WHERE (b.borrower_id = u.id OR i.owner_id = u.id) AND b.status = 'COMPLETED'
        ) * 3)) AS trust_score
      FROM users u
      LEFT JOIN reviews r ON u.id = r.reviewee_id
      GROUP BY u.id;

      -- 3NF Messages View: receiver_id derived dynamically from booking participants
      CREATE OR REPLACE VIEW messages_3nf_v AS
      SELECT 
        m.id,
        m.booking_id,
        m.sender_id,
        COALESCE(m.receiver_id, CASE WHEN b.borrower_id = m.sender_id THEN i.owner_id ELSE b.borrower_id END) AS receiver_id,
        m.content,
        m.created_at
      FROM messages m
      LEFT JOIN bookings b ON m.booking_id = b.id
      LEFT JOIN items i ON b.item_id = i.id;
    `);
    await client.query("COMMIT");
    console.log("Database migrations completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
};
if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(() => process.exit(1));
}

// src/server.ts
var app = createApp();
var startServer = async () => {
  try {
    await runMigrations().catch((err) => {
      console.warn("Migrations notice on startup:", err.message);
    });
    const server = app.listen(ENV.PORT, () => {
      console.log(`\u26A1 Rentu\u207A API Service listening on http://localhost:${ENV.PORT}`);
      console.log(`\u{1F331} Environment: ${ENV.NODE_ENV}`);
      console.log(`\u{1F4E1} Ready for rental requests!`);
    });
    const shutdown = () => {
      console.log("\nShutting down Rentu\u207A API server gracefully...");
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};
if (require.main === module) {
  startServer();
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = app;
  module.exports.default = app;
  module.exports.app = app;
}
var server_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app
});
