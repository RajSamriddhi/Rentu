"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = void 0;
const db_1 = require("../config/db");
const runMigrations = async () => {
    console.log('Running database migrations (Supabase Compatible)...');
    const client = await db_1.pool.connect();
    try {
        // 1. Extensions (executed outside transaction block)
        await client.query(`CREATE SCHEMA IF NOT EXISTS extensions;`).catch(() => { });
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;`).catch(() => { });
        await client.query(`CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA extensions;`).catch(() => {
            console.log('PostGIS extension not available locally; using Haversine proximity formulas.');
        });
        await client.query('BEGIN');
        // 2. Types
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
          CREATE TYPE booking_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'HANDED_OVER');
        ELSE
          ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'HANDED_OVER';
        END IF;
      END $$;
    `);
        // 3. Tables (Supporting Clerk IDs and Supabase GPS Radar)
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
        rating NUMERIC(3, 2) DEFAULT 0.00,
        trust_score INT DEFAULT 90,
        role user_role DEFAULT 'USER',
        clerk_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS address_text TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'::jsonb;
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
        sticker_badge VARCHAR(50) DEFAULT 'Available',
        locality VARCHAR(120),
        address_text TEXT,
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        status item_status DEFAULT 'AVAILABLE',
        available_for_borrowing BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE items ADD COLUMN IF NOT EXISTS address_text TEXT;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE items ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE items ALTER COLUMN address_text DROP DEFAULT;
      ALTER TABLE items ALTER COLUMN latitude DROP DEFAULT;
      ALTER TABLE items ALTER COLUMN longitude DROP DEFAULT;
      ALTER TABLE items ALTER COLUMN latitude DROP NOT NULL;
      ALTER TABLE items ALTER COLUMN longitude DROP NOT NULL;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS available_for_borrowing BOOLEAN DEFAULT false;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS offers_delivery BOOLEAN DEFAULT false;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS offers_pickup BOOLEAN DEFAULT false;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS pickup_fee NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'Good';
      ALTER TABLE items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

      CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_coords ON items(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_items_borrowing ON items(available_for_borrowing);
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
        address_text TEXT,
        pincode VARCHAR(10),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        status request_status DEFAULT 'OPEN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE requests ADD COLUMN IF NOT EXISTS address_text TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE requests ALTER COLUMN address_text DROP DEFAULT;
      ALTER TABLE requests ALTER COLUMN latitude DROP DEFAULT;
      ALTER TABLE requests ALTER COLUMN longitude DROP DEFAULT;
      ALTER TABLE requests ALTER COLUMN latitude DROP NOT NULL;
      ALTER TABLE requests ALTER COLUMN longitude DROP NOT NULL;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS end_time VARCHAR(20) DEFAULT '18:00';
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS pickup_type VARCHAR(60) DEFAULT 'LENDER_LOCATION';
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS pickup_locality VARCHAR(120);
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS return_type VARCHAR(60) DEFAULT 'LENDER_LOCATION';
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS return_locality VARCHAR(120);
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS will_pickup BOOLEAN DEFAULT TRUE;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS will_drop_back BOOLEAN DEFAULT TRUE;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0;

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

      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time VARCHAR(20) DEFAULT '18:00';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_type VARCHAR(60) DEFAULT 'LENDER_LOCATION';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_locality VARCHAR(120);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_type VARCHAR(60) DEFAULT 'LENDER_LOCATION';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_locality VARCHAR(120);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(6);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_code VARCHAR(6);
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS requires_delivery BOOLEAN DEFAULT false;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS requires_pickup BOOLEAN DEFAULT false;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_fee NUMERIC(10, 2) DEFAULT 0;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(40) DEFAULT 'PENDING';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40) DEFAULT 'UPI';

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
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'TEXT';
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS proposal_data JSONB;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by TEXT[] DEFAULT '{}';
    `);
        // 4. NORMALIZATION TABLES (1NF & 3NF Compliance)
        // 4.1. POSTAL CODES (3NF: Eliminates transitive dependency pincode -> locality in users, items, requests)
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
        // 4.2. ITEM IMAGES (1NF: Eliminates multi-valued repeating group in items.image_urls)
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
        // 4.3. REVIEWS TABLE (3NF: Eliminates derived aggregate rating & trust_score attributes from users)
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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_booking_reviewer ON reviews(booking_id, reviewer_id);

      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_type VARCHAR(50) DEFAULT 'OWNER_RENTAL';
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_borrowing BOOLEAN DEFAULT false;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_on_time BOOLEAN DEFAULT true;
      UPDATE bookings SET total_price = 0 WHERE total_price IS NULL;
      UPDATE bookings SET is_on_time = true WHERE is_on_time IS NULL;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_rating NUMERIC(3, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_rating NUMERIC(3, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_rating NUMERIC(3, 2) DEFAULT 0.00;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_reviews_count INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_rating NUMERIC(3, 2) DEFAULT 0.00;

      -- Infer review_type for older reviews from linked booking roles & free/paid terms
      UPDATE reviews r
      SET review_type = CASE 
        WHEN r.reviewer_id = b.borrower_id THEN 
          CASE WHEN (COALESCE(b.total_price, 0) - COALESCE(b.delivery_fee, 0) - COALESCE(b.pickup_fee, 0) <= 0) OR COALESCE(i.price_per_day, 0) <= 0 THEN 'COMMUNITY_LENDER'
          ELSE 'OWNER_RENTAL'
          END
        WHEN r.reviewer_id = b.lender_id OR r.reviewer_id = i.owner_id THEN 'RENTER'
        ELSE COALESCE(r.review_type, 'OWNER_RENTAL')
      END
      FROM bookings b
      LEFT JOIN items i ON b.item_id = i.id
      WHERE r.booking_id = b.id;

      -- Rebuild all category counters and average ratings for existing users
      WITH stats AS (
        SELECT 
          u.id AS user_id,
          ROUND(COALESCE(AVG(CASE WHEN r.review_type = 'OWNER_RENTAL' THEN r.rating END), 0.00), 2) AS owner_rating,
          COUNT(CASE WHEN r.review_type = 'OWNER_RENTAL' THEN 1 END)::int AS owner_count,
          ROUND(COALESCE(AVG(CASE WHEN r.review_type = 'RENTER' THEN r.rating END), 0.00), 2) AS renter_rating,
          COUNT(CASE WHEN r.review_type = 'RENTER' THEN 1 END)::int AS renter_count,
          ROUND(COALESCE(AVG(CASE WHEN r.review_type = 'COMMUNITY_LENDER' THEN r.rating END), 0.00), 2) AS community_lender_rating,
          COUNT(CASE WHEN r.review_type = 'COMMUNITY_LENDER' THEN 1 END)::int AS community_lender_count,
          ROUND(COALESCE(AVG(r.rating), 0.00), 2) AS trust_rating,
          COUNT(r.id)::int AS total_reviews
        FROM users u
        LEFT JOIN reviews r ON (r.reviewee_id = u.id::text OR r.reviewee_id = u.firebase_uid)
        GROUP BY u.id
      ),
      punctuality AS (
        SELECT 
          u.id AS user_id,
          COUNT(CASE WHEN b.status = 'COMPLETED' THEN 1 END)::int AS completed_count,
          COUNT(CASE WHEN b.status = 'COMPLETED' AND b.is_on_time = false THEN 1 END)::int AS late_count
        FROM users u
        LEFT JOIN bookings b ON (b.borrower_id = u.id::text OR b.borrower_id = u.firebase_uid)
        GROUP BY u.id
      )
      UPDATE users
      SET 
        owner_rating = stats.owner_rating,
        owner_reviews_count = stats.owner_count,
        renter_rating = stats.renter_rating,
        renter_reviews_count = stats.renter_count,
        community_lender_rating = stats.community_lender_rating,
        community_lender_reviews_count = stats.community_lender_count,
        trust_rating = stats.trust_rating,
        rating = stats.trust_rating,
        trust_score = CASE 
          WHEN stats.total_reviews = 0 THEN 85 
          ELSE LEAST(100, GREATEST(50, ROUND(
            (stats.trust_rating / 5.0) * 85 + 
            (CASE WHEN punctuality.completed_count > 0 AND punctuality.late_count = 0 THEN 8 WHEN punctuality.late_count > 0 THEN 0 ELSE 4 END) + 
            LEAST(7, stats.total_reviews)
          ))) 
        END
      FROM stats, punctuality
      WHERE users.id = stats.user_id AND punctuality.user_id = stats.user_id;
    `);
        // 4.4. NOTIFICATIONS (1NF: Eliminates non-atomic jsonb data object by storing explicit atomic scalar columns)
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

      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS booking_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

      -- Backfill notifications atomic columns from data JSON safely if column exists
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'data') THEN
          UPDATE notifications
          SET sender_id = COALESCE(sender_id, data->>'sender_id'),
              booking_id = COALESCE(booking_id, NULLIF(data->>'booking_id', '')::uuid),
              message_id = COALESCE(message_id, NULLIF(data->>'message_id', '')::uuid)
          WHERE data IS NOT NULL AND (sender_id IS NULL OR booking_id IS NULL);
        END IF;
      END $$;

      -- Unique guard for daily pickup and return reminders to prevent duplicate alerts from concurrent requests
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_daily_reminders 
      ON notifications (user_id, booking_id, type, ((created_at AT TIME ZONE 'UTC')::date)) 
      WHERE type IN ('REMINDER_PICKUP', 'REMINDER_RETURN');
    `);
        // 4.5. PUSH SUBSCRIPTIONS
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
        // 4.6. USER FOLLOWS & BLOCKS
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
      CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

      CREATE TABLE IF NOT EXISTS user_blocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_nearby_requests_5km BOOLEAN DEFAULT TRUE;
    `);
        // 4.8. SUPPORT TICKETS, CONCERNS & USER FEEDBACK
        await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        user_name TEXT,
        user_email TEXT,
        type TEXT NOT NULL, -- 'CONCERN' | 'FEEDBACK'
        category TEXT NOT NULL, -- 'BOOKING' | 'ITEM_QUALITY' | 'PAYMENT' | 'USER_BEHAVIOR' | 'FEATURE_REQUEST' | 'BUG' | 'GENERAL'
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'OPEN', -- 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
        priority TEXT DEFAULT 'NORMAL', -- 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
        admin_notes TEXT,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(type);

      -- 4.9. VERIFICATION ATTEMPTS (Persistent distributed rate limiting & lockout for handover codes)
      CREATE TABLE IF NOT EXISTS verification_attempts (
        key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 4.10. CONVERSATIONS MANAGEMENT (Deletions, Muting, User Presence)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS user_deleted_conversations (
        user_id TEXT NOT NULL,
        partner_id TEXT NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, partner_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_deleted_convs_user ON user_deleted_conversations(user_id);

      CREATE TABLE IF NOT EXISTS user_muted_conversations (
        user_id TEXT NOT NULL,
        partner_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, partner_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_muted_convs_user ON user_muted_conversations(user_id);

      -- Retrofit legacy notification messages into SYSTEM message type once in migration
      UPDATE messages
      SET message_type = 'SYSTEM'
      WHERE (message_type IS NULL OR message_type = 'TEXT')
        AND (
          content LIKE 'Proposal accepted.%'
          OR content LIKE 'Product received and handed over%'
          OR content LIKE 'Product returned to owner%'
          OR content LIKE 'Renter has sent the payment via%'
        );
    `);
        // Clean up unnecessary helper views to maintain clean database tables
        await client.query(`DROP VIEW IF EXISTS bookings_3nf_v, messages_3nf_v, user_scores_3nf_v CASCADE;`);
        // 4.7. RELATIONAL FOREIGN KEY CONSTRAINTS (SCHEMA.md Full Relational Integrity)
        // Clean up empty string pincodes before adding constraints
        await client.query(`UPDATE users SET pincode = NULL WHERE pincode = '' OR (pincode IS NOT NULL AND TRIM(pincode) = '');`);
        await client.query(`UPDATE items SET pincode = NULL WHERE pincode = '' OR (pincode IS NOT NULL AND TRIM(pincode) = '');`);
        await client.query(`UPDATE requests SET pincode = NULL WHERE pincode = '' OR (pincode IS NOT NULL AND TRIM(pincode) = '');`);
        const relationalConstraints = [
            { name: 'fk_items_owner', sql: `ALTER TABLE items ADD CONSTRAINT fk_items_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE` },
            { name: 'fk_requests_seeker', sql: `ALTER TABLE requests ADD CONSTRAINT fk_requests_seeker FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE` },
            { name: 'fk_bookings_borrower', sql: `ALTER TABLE bookings ADD CONSTRAINT fk_bookings_borrower FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE RESTRICT` },
            { name: 'fk_bookings_lender', sql: `ALTER TABLE bookings ADD CONSTRAINT fk_bookings_lender FOREIGN KEY (lender_id) REFERENCES users(id) ON DELETE RESTRICT` },
            { name: 'fk_messages_sender', sql: `ALTER TABLE messages ADD CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE` },
            { name: 'fk_users_pincode', sql: `ALTER TABLE users ADD CONSTRAINT fk_users_pincode FOREIGN KEY (pincode) REFERENCES postal_codes(pincode) ON DELETE SET NULL` },
            { name: 'fk_items_pincode', sql: `ALTER TABLE items ADD CONSTRAINT fk_items_pincode FOREIGN KEY (pincode) REFERENCES postal_codes(pincode) ON DELETE SET NULL` },
            { name: 'fk_requests_pincode', sql: `ALTER TABLE requests ADD CONSTRAINT fk_requests_pincode FOREIGN KEY (pincode) REFERENCES postal_codes(pincode) ON DELETE SET NULL` }
        ];
        for (const c of relationalConstraints) {
            const check = await client.query(`
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = $1 AND table_schema = 'public'
      `, [c.name]);
            if (check.rows.length === 0) {
                await client.query(c.sql);
            }
        }
        // 4.8. ROW LEVEL SECURITY (RLS) FOR PUBLIC TABLES (Clears Supabase Security Advisor Critical Alerts)
        const publicTables = [
            'bookings', 'item_images', 'items', 'messages', 'notifications',
            'postal_codes', 'push_subscriptions', 'requests', 'reviews',
            'support_tickets', 'user_blocks', 'user_follows', 'users'
        ];
        for (const tbl of publicTables) {
            await client.query(`ALTER TABLE IF EXISTS public.${tbl} ENABLE ROW LEVEL SECURITY;`).catch(() => { });
        }
        await client.query('COMMIT');
        console.log('Database schema migrations completed successfully!');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.runMigrations = runMigrations;
if (require.main === module) {
    (0, exports.runMigrations)()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
