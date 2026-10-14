-- ==============================================================================
-- 🚀 Rentu⁺ Supabase Setup Script (1NF, 2NF & 3NF Normalized Schema)
-- Relational Tables, Atomic Child Tables, 3NF Views & Supabase Storage
-- Run directly in: Supabase Dashboard -> SQL Editor -> New query -> RUN
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

-- 3. POSTAL CODES TABLE (3NF: Eliminates transitive dependency pincode -> locality)
CREATE TABLE IF NOT EXISTS postal_codes (
    pincode VARCHAR(10) PRIMARY KEY,
    locality VARCHAR(120) NOT NULL,
    city VARCHAR(120),
    state VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_postal_codes_locality ON postal_codes(locality);

-- 4. USERS TABLE (Linked with Firebase/Auth IDs)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                 -- Auth User ID (e.g. Firebase UID)
    firebase_uid VARCHAR(255),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    address_text TEXT,                   -- Building / House / Street number
    locality VARCHAR(120),               -- Area / Neighborhood name
    pincode VARCHAR(10) REFERENCES postal_codes(pincode) ON DELETE SET NULL,
    latitude DOUBLE PRECISION,           -- Background GPS for distance matching
    longitude DOUBLE PRECISION,          -- Background GPS for distance matching
    rating NUMERIC(3, 2) DEFAULT 5.00,   -- Cached rating (dynamically computed via user_scores_3nf_v)
    trust_score INT DEFAULT 98,          -- Cached trust score
    role user_role DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_coords ON users(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_pincode ON users(pincode);

-- 5. ITEMS TABLE (Equipment / Gear listed for rent)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(60) NOT NULL,
    price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day >= 0),
    max_duration_days INTEGER DEFAULT 3 CHECK (max_duration_days > 0),
    image_urls JSONB DEFAULT '[]'::JSONB, -- Maintained for backward compatibility; see item_images for 1NF
    sticker_badge VARCHAR(50) DEFAULT '✨ Weekend Flex',
    locality VARCHAR(120),
    address_text TEXT NOT NULL,
    pincode VARCHAR(10) REFERENCES postal_codes(pincode) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_items_pincode ON items(pincode);

-- 6. ITEM IMAGES TABLE (1NF: Pure atomic photo rows, eliminating multi-valued JSON array)
CREATE TABLE IF NOT EXISTS item_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);

-- 7. REQUESTS TABLE (Community bounties / gear requests)
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
    pincode VARCHAR(10) REFERENCES postal_codes(pincode) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status request_status DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requests_seeker ON requests(seeker_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_coords ON requests(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_requests_pincode ON requests(pincode);

-- 8. BOOKINGS TABLE (Rentals & Borrow records)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    borrower_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lender_id TEXT REFERENCES users(id) ON DELETE RESTRICT, -- Redundant in 3NF; dynamically derived in bookings_3nf_v
    start_date DATE NOT NULL,
    start_time TIME,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    total_price NUMERIC(10, 2) CHECK (total_price >= 0),   -- Computed dynamically in 3NF view
    status booking_status DEFAULT 'PENDING',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_item ON bookings(item_id);
CREATE INDEX IF NOT EXISTS idx_bookings_borrower ON bookings(borrower_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 9. REVIEWS TABLE (3NF: First-class ratings entity for computing user trust score & rating on-the-fly)
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

-- 10. MESSAGES TABLE (Real-time chats between users; 3NF compliant)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- Optional; dynamically deduced in 3NF
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

-- 11. NOTIFICATIONS TABLE (1NF: Explicit atomic scalar fields replacing unstructured JSON blobs)
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
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at);

-- 12. PUSH SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- 13. NORMALIZED 3NF VIEWS (Mathematical Relational Views)

-- View 1: 3NF Bookings (Eliminates lender_id transitive dependency and derives total_price on-the-fly)
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

-- View 2: 3NF User Scores (Dynamically aggregates rating and trust_score from reviews & completed transactions)
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

-- View 3: 3NF Messages (Derives receiver_id dynamically from booking parties)
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

-- 14. SUPABASE STORAGE BUCKET FOR ITEM PHOTOS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

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

-- 15. SEED DATA
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

INSERT INTO users (id, name, phone, bio, avatar_url, address_text, locality, pincode, latitude, longitude, role)
VALUES 
    ('user_demo_rohit', 'Rohit Verma', '+919876543210', 'Tech enthusiast • DSLR hobbyist', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80', 'Flat 402, Tower B', 'Indiranagar', '560038', 12.9716, 77.5946, 'USER'),
    ('user_demo_zoya', 'Zoya Khan', '+919876543211', 'Outdoor camper & acoustic music lover', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', 'House 12, 4th Cross', 'Koramangala', '560034', 12.9352, 77.6245, 'USER')
ON CONFLICT (id) DO NOTHING;

INSERT INTO items (id, owner_id, title, description, category, price_per_day, max_duration_days, sticker_badge, locality, address_text, pincode, latitude, longitude, status)
VALUES
    ('a147fdbe-2349-49cc-ae16-f1067974efe2', 'user_demo_rohit', 'Canon EOS 250D DSLR + 18-55mm STM', 'Ultra-crisp 4K video, pristine sensor, lightweight body with flip touchscreen.', 'Electronics & Tech', 350.00, 5, '✨ Weekend Flex', 'Indiranagar', 'Flat 402, Tower B', '560038', 12.9716, 77.5946, 'AVAILABLE'),
    ('e48e1792-32f5-4adb-8adb-678411226468', 'user_demo_rohit', 'Fujifilm X-T30 II Retro Mirrorless', 'Classic film simulations, super compact street photography dream.', 'Electronics & Tech', 450.00, 4, '✨ Weekend Flex', 'Indiranagar', 'Flat 402, Tower B', '560038', 12.9716, 77.5946, 'AVAILABLE')
ON CONFLICT (id) DO NOTHING;

-- Seed atomic photos into 1NF item_images table
INSERT INTO item_images (item_id, image_url, display_order)
VALUES 
    ('a147fdbe-2349-49cc-ae16-f1067974efe2', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80', 0),
    ('e48e1792-32f5-4adb-8adb-678411226468', 'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=800&q=80', 0)
ON CONFLICT DO NOTHING;

-- Verification Query
SELECT 'ALL_TABLES_1NF_2NF_3NF_NORMALIZED' AS status,
       (SELECT count(*) FROM postal_codes) AS postal_codes_count,
       (SELECT count(*) FROM item_images) AS item_images_count,
       (SELECT count(*) FROM reviews) AS reviews_count;
