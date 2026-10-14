"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = void 0;
const db_1 = require("../config/db");
const runMigrations = async () => {
    console.log('Running database migrations (Supabase Compatible)...');
    const client = await db_1.pool.connect();
    try {
        // 1. Extensions (executed outside transaction block)
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`).catch(() => { });
        await client.query(`CREATE EXTENSION IF NOT EXISTS "postgis";`).catch(() => {
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
          CREATE TYPE booking_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');
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
        sticker_badge VARCHAR(50) DEFAULT '✨ Weekend Flex',
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
        // 4.6. STRICT 3NF VIEWS (For mathematical relational normalization)
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
        await client.query('COMMIT');
        console.log('Database migrations completed successfully!');
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
