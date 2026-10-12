-- ==============================================================================
-- 🚀 Rentu⁺ Supabase Setup Script
-- Tables, Indexes, Storage Bucket & Starter Seed Data
-- Run this directly in: Supabase Dashboard -> SQL Editor -> New query -> RUN
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. ENUM TYPES
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
        CREATE TYPE item_status AS ENUM ('AVAILABLE', 'RENTED', 'UNAVAILABLE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
        CREATE TYPE request_status AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');
    END IF;
END $$;

-- 3. USERS TABLE (Linked with Clerk IDs)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                 -- Clerk User ID (e.g. 'user_2bXYZ...')
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    bio TEXT,
    avatar_url TEXT,
    address_text TEXT,
    locality VARCHAR(120),
    pincode VARCHAR(10),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    role user_role DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_coords ON users(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_locality ON users(locality);

-- 4. ITEMS TABLE (Equipment / Gear listed for rent)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(60) NOT NULL,
    price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day >= 0),
    max_duration_days INTEGER DEFAULT 3 CHECK (max_duration_days > 0),
    image_urls JSONB DEFAULT '[]'::JSONB,
    sticker_badge VARCHAR(50) DEFAULT '✨ Weekend Flex',
    locality VARCHAR(120),
    address_text TEXT NOT NULL,
    pincode VARCHAR(10),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status item_status DEFAULT 'AVAILABLE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_coords ON items(latitude, longitude);

-- 5. REQUESTS TABLE (Community bounties / gear requests)
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seeker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(60),
    start_date DATE NOT NULL,
    start_time TIME,
    duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days > 0),
    offered_amount NUMERIC(10, 2) NOT NULL CHECK (offered_amount >= 0),
    locality VARCHAR(120),
    address_text TEXT NOT NULL,
    pincode VARCHAR(10),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status request_status DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requests_seeker ON requests(seeker_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_coords ON requests(latitude, longitude);

-- 6. BOOKINGS TABLE (Rentals & Borrow records)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    borrower_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lender_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    start_time TIME,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    status booking_status DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_id);
CREATE INDEX IF NOT EXISTS idx_bookings_borrower ON bookings(borrower_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lender ON bookings(lender_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 7. MESSAGES TABLE (Real-time chats between users)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

-- 8. SUPABASE STORAGE BUCKET FOR ITEM PHOTOS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies (Safe idempotent creation)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Allow public viewing of item-photos'
    ) THEN
        CREATE POLICY "Allow public viewing of item-photos" 
        ON storage.objects FOR SELECT TO public 
        USING (bucket_id = 'item-photos');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Allow public uploads to item-photos'
    ) THEN
        CREATE POLICY "Allow public uploads to item-photos" 
        ON storage.objects FOR INSERT TO public 
        WITH CHECK (bucket_id = 'item-photos');
    END IF;
END $$;

-- 9. STARTER SEED DATA
INSERT INTO users (id, name, phone, bio, avatar_url, address_text, locality, pincode, latitude, longitude, rating, role)
VALUES 
    ('user_demo_rohit', 'Rohit Verma', '+919876543210', 'Tech enthusiast • DSLR hobbyist', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80', 'A-42, Saket Residential Area', 'Saket, New Delhi', '110017', 28.5244, 77.2066, 4.95, 'USER'),
    ('user_demo_zoya', 'Zoya Khan', '+919876543211', 'Outdoor camper & acoustic music lover', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', 'Flat 201, Green Park Enclave', 'Hauz Khas, New Delhi', '110016', 28.5494, 77.2001, 5.00, 'USER')
ON CONFLICT (id) DO NOTHING;

INSERT INTO items (owner_id, title, description, category, price_per_day, max_duration_days, image_urls, sticker_badge, locality, address_text, pincode, latitude, longitude, status)
VALUES
    ('user_demo_rohit', 'Canon EOS 250D DSLR + 18-55mm STM', 'Ultra-crisp 4K video, pristine sensor, lightweight body with flip touchscreen. Includes 64GB SD card.', 'Electronics & Tech', 350.00, 5, '["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80"]'::jsonb, '✨ Weekend Flex', 'Saket, New Delhi', 'A-42, Saket Residential Area', '110017', 28.5244, 77.2066, 'AVAILABLE'),
    ('user_demo_rohit', 'Fujifilm X-T30 II Retro Mirrorless', 'Classic film simulations (Classic Chrome, Nostalgic Neg), super compact street photography dream.', 'Electronics & Tech', 450.00, 4, '["https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=800&q=80"]'::jsonb, '✨ Weekend Flex', 'Saket, New Delhi', 'A-42, Saket Residential Area', '110017', 28.5244, 77.2066, 'AVAILABLE'),
    ('user_demo_zoya', 'Quechua 3-Person Waterproof Pop-Up Tent', '2 Seconds tech for instant pitch and easy folding. Fresh & Black fabric ensures 99% darkness even at midday.', 'Camping & Outdoor', 250.00, 7, '["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80"]'::jsonb, '🌱 Eco Hero', 'Hauz Khas, New Delhi', 'Flat 201, Green Park Enclave', '110016', 28.5494, 77.2001, 'AVAILABLE'),
    ('user_demo_zoya', 'Marshall Acton III Bluetooth Speaker', 'Signature room-filling Marshall rock sound, brass knobs, iconic script logo. Bluetooth 5.2.', 'Home & Appliances', 280.00, 5, '["https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80"]'::jsonb, '💸 Certified Steal', 'Hauz Khas, New Delhi', 'Flat 201, Green Park Enclave', '110016', 28.5494, 77.2001, 'AVAILABLE')
ON CONFLICT DO NOTHING;

INSERT INTO requests (seeker_id, item_name, description, category, start_date, duration_days, offered_amount, locality, address_text, latitude, longitude, status)
VALUES
    ('user_demo_rohit', 'Tripod for Canon DSLR (60+ inches)', 'Need a sturdy tripod for an outdoor landscape shoot this Saturday morning.', 'Electronics & Tech', CURRENT_DATE + INTERVAL '2 day', 2, 200.00, 'Saket, New Delhi', 'A-42, Saket Residential Area', 28.5244, 77.2066, 'OPEN')
ON CONFLICT DO NOTHING;

-- Verification
SELECT 'TABLES_CREATED_SUCCESSFULLY' AS status, count(*) AS items_count FROM items;
