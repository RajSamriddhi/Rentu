"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
const seedDatabase = async () => {
    console.log('Seeding database with Gen Z gear and community bounties...');
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Clean existing data
        await client.query('TRUNCATE messages, bookings, requests, items, users CASCADE;');
        const passwordHash = await bcryptjs_1.default.hash('password123', 10);
        const adminPasswordHash = await bcryptjs_1.default.hash('admin123', 10);
        // Seed Users
        const userRes = await client.query(`
      INSERT INTO users (email, password_hash, name, phone, locality, avatar_url, bio, trust_score, role)
      VALUES 
        ('admin@borrowflex.com', $1, 'Aarav Mehta', '+91 98201 12345', 'Powai, Mumbai', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80', 'Community Lead @ BorrowFlex ⚡ Building anti-ownership economy', 100, 'ADMIN'),
        ('rohit@lens.com', $2, 'Rohit Verma', '+91 98111 22334', 'Saket, New Delhi', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80', 'Indie filmmaker & camera nerd 📸 Gear chills when I chill.', 99, 'USER'),
        ('ananya@studio.com', $2, 'Ananya Roy', '+91 98450 33445', 'Koramangala, Bangalore', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80', 'Design student & content creator 🎨 Borrow > Buy always.', 97, 'USER'),
        ('kabir@vibes.com', $2, 'Kabir Sen', '+91 98222 44556', 'Bandra, Mumbai', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80', 'Audio engineer & DJ 🎧 Helping folks host legendary roof gigs.', 96, 'USER'),
        ('zoya@explores.com', $2, 'Zoya Khan', '+91 98188 55667', 'Hauz Khas, New Delhi', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80', 'Weekend trekker & DIY enthusiast ⛺ Everything you need for the wild.', 98, 'USER')
      RETURNING id, email, name;
    `, [adminPasswordHash, passwordHash]);
        const usersByEmail = {};
        for (const u of userRes.rows) {
            usersByEmail[u.email] = u.id;
        }
        const rohitId = usersByEmail['rohit@lens.com'];
        const ananyaId = usersByEmail['ananya@studio.com'];
        const kabirId = usersByEmail['kabir@vibes.com'];
        const zoyaId = usersByEmail['zoya@explores.com'];
        const adminId = usersByEmail['admin@borrowflex.com'];
        // Seed Items
        const itemRes = await client.query(`
      INSERT INTO items (owner_id, title, description, category, price_per_day, max_duration_days, image_urls, sticker_badge, locality, status)
      VALUES 
        (
          $1, 
          'Canon EOS 250D DSLR + 18-55mm STM', 
          'Ultra-crisp 4K video, pristine sensor, lightweight body with flip touchscreen. Comes with 64GB Extreme Pro SD card and 2 extra batteries. Perfect for shoots, YouTube videos or weekend trips.', 
          'Electronics & Tech', 
          350.00, 
          5, 
          $5::jsonb, 
          '✨ Weekend Flex', 
          'Saket, New Delhi', 
          'AVAILABLE'
        ),
        (
          $2, 
          'Nebula Capsule II Smart Mini Projector', 
          'Android TV built-in, 720p HD, 200 ANSI lumen pocket cinema. Works on any blank wall with 2.5 hr battery life or plug-in. HDMI & AirPlay ready for rooftop movie nights.', 
          'Electronics & Tech', 
          300.00, 
          4, 
          $6::jsonb, 
          '🔥 Hot Demand', 
          'Koramangala, Bangalore', 
          'AVAILABLE'
        ),
        (
          $3, 
          'Pioneer DDJ-FLX4 2-Channel DJ Controller', 
          'Club-standard layout compatible with rekordbox & Serato DJ Lite. Smart Fader and Smart CFX to make transitions buttery smooth. Includes USB-C and RCA audio cable.', 
          'Electronics & Tech', 
          550.00, 
          3, 
          $7::jsonb, 
          '💸 Certified Steal', 
          'Bandra, Mumbai', 
          'AVAILABLE'
        ),
        (
          $4, 
          'Quechua 3-Person Waterproof Pop-Up Tent', 
          '2 Seconds technology for instant pitch and easy folding. Fresh & Black fabric ensures 99% darkness even at midday. Wind resistant up to 50 km/h. Cleaned after every trip!', 
          'Camping & Outdoor', 
          250.00, 
          7, 
          $8::jsonb, 
          '🌱 Eco Hero', 
          'Hauz Khas, New Delhi', 
          'AVAILABLE'
        ),
        (
          $4, 
          'Bosch GSB 120-LI Cordless Impact Drill Kit', 
          'High-torque impact drill + 23-piece screw and masonry bit set. Perfect for hanging art, assembling furniture, and quick wall repairs without calling an expensive handyman.', 
          'Tools & DIY', 
          180.00, 
          3, 
          $9::jsonb, 
          '💸 Certified Steal', 
          'Hauz Khas, New Delhi', 
          'AVAILABLE'
        ),
        (
          $1, 
          'Fujifilm X-T30 II Retro Mirrorless + 27mm Pancake', 
          'Classic film simulations (Classic Chrome, Nostalgic Neg), super compact street photography dream. Turn your city walk into Pinterest aesthetic.', 
          'Electronics & Tech', 
          450.00, 
          4, 
          $10::jsonb, 
          '✨ Weekend Flex', 
          'Saket, New Delhi', 
          'AVAILABLE'
        ),
        (
          $2, 
          'Sony PlayStation 5 Console + 2 DualSense Controllers', 
          'Includes FIFA 24, Spider-Man 2, and It Takes Two. Comes with high-speed HDMI 2.1 cable and charging dock. Perfect for game nights with the squad.', 
          'Electronics & Tech', 
          600.00, 
          3, 
          $11::jsonb, 
          '🔥 Hot Demand', 
          'Koramangala, Bangalore', 
          'AVAILABLE'
        ),
        (
          $3, 
          'Vintage Distressed Oversized Biker Leather Jacket', 
          'Authentic 90s vintage boxy fit, heavy cowhide leather with matte silver hardware. Unisex Size L. Worn once for a music video. Steal the spotlight at any concert.', 
          'Clothing & Fits', 
          320.00, 
          3, 
          $12::jsonb, 
          '✨ Weekend Flex', 
          'Bandra, Mumbai', 
          'AVAILABLE'
        ),
        (
          $4, 
          'Marshall Acton III Bluetooth Home Speaker', 
          'Signature room-filling Marshall rock sound, brass knobs, iconic script logo. Bluetooth 5.2 with 3.5mm AUX input. Sounds immense for terrace listening sessions.', 
          'Home & Appliances', 
          280.00, 
          5, 
          $13::jsonb, 
          '💸 Certified Steal', 
          'Hauz Khas, New Delhi', 
          'AVAILABLE'
        ),
        (
          $1, 
          'Yonex Astrox 99 Pro Badminton Racket (Strung @ 26 lbs)', 
          'Head-heavy powerhouse racket for aggressive smashes. Strung with BG66 Ultimax string. Comes with thermal padded full cover and 2 spare grips.', 
          'Sports & Fitness', 
          150.00, 
          7, 
          $14::jsonb, 
          '🌱 Eco Hero', 
          'Saket, New Delhi', 
          'AVAILABLE'
        ),
        (
          $2,
          'Canon EOS 250D DSLR + 18-55mm STM',
          'Perfect for beginner filmmakers and students. 4K video, flip screen, 64GB Extreme SD card + 2 batteries.',
          'Electronics & Tech',
          300.00,
          5,
          $5::jsonb,
          '✨ Weekend Flex',
          'Koramangala, Bangalore',
          'AVAILABLE'
        ),
        (
          $2,
          'Quechua 3-Person Waterproof Pop-Up Camping Tent',
          'Fresh & Black fabric, sets up in 2 minutes. Wind and waterproof tested. Perfect for Coorg or Nandi Hills weekends.',
          'Camping & Outdoor',
          200.00,
          7,
          $8::jsonb,
          '🌱 Eco Hero',
          'Indiranagar, Bangalore',
          'AVAILABLE'
        ),
        (
          $2,
          'Bosch GSB 120-LI Cordless Impact Power Drill Set',
          'Includes masonry bits, screws, and screwdriver accessories. Great for mounting shelves and quick home fixes.',
          'Tools & DIY',
          150.00,
          3,
          $9::jsonb,
          '💸 Certified Steal',
          'HSR Layout, Bangalore',
          'AVAILABLE'
        ),
        (
          $2,
          'Sony WH-1000XM4 Noise Canceling Wireless Headphones',
          'Industry-leading active noise canceling, 30h battery life, pristine hi-res audio for study or deep work sessions.',
          'Electronics & Tech',
          100.00,
          5,
          $15::jsonb,
          '🔥 Hot Demand',
          'Koramangala, Bangalore',
          'AVAILABLE'
        ),
        (
          $2,
          'Festive Embroidered Silk Lehenga with Dupatta',
          'Exquisite peach & blush designer lehenga set for weddings, sangeet or college fests. Dry cleaned and ready to wear.',
          'Clothing & Fits',
          250.00,
          4,
          $16::jsonb,
          '✨ Weekend Flex',
          'Indiranagar, Bangalore',
          'AVAILABLE'
        ),
        (
          $2,
          'Yamaha F310 Natural Acoustic Folk Guitar',
          'Rich acoustic tone, low action, comfortable neck. Comes with padded gig bag, capo, and picks.',
          'Books & Media',
          100.00,
          7,
          $17::jsonb,
          '🌱 Eco Hero',
          'Koramangala, Bangalore',
          'AVAILABLE'
        ),
        (
          $2,
          'Firefox Hybrid City Commuter Cycle with Helmet',
          '21-speed Shimano gears, lightweight alloy frame, disc brakes. Tuned and lubricated for smooth riding.',
          'Sports & Fitness',
          100.00,
          7,
          $18::jsonb,
          '🌱 Eco Hero',
          'HSR Layout, Bangalore',
          'AVAILABLE'
        )
      RETURNING id, title;
    `, [
            rohitId,
            ananyaId,
            kabirId,
            zoyaId,
            JSON.stringify([
                'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80'
            ]),
            JSON.stringify([
                'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80'
            ])
        ]);
        const items = itemRes.rows;
        const canonId = items[0].id;
        const projectorId = items[1].id;
        // Seed Community Requests ("Bounties / Wishes")
        await client.query(`
      INSERT INTO requests (seeker_id, item_name, description, category, start_date, start_time, duration_days, offered_amount, locality, status)
      VALUES 
        (
          $1, 
          'Need a Portable Projector for 2 Days', 
          'Looking for a mini projector with HDMI for a college dorm screening this weekend. Will take top care of it!', 
          'Electronics & Tech', 
          CURRENT_DATE + INTERVAL '2 days', 
          '18:00', 
          2, 
          600.00, 
          'Saket, New Delhi', 
          'OPEN'
        ),
        (
          $2, 
          'DJ Mixer / Pioneer Controller for Friday Party', 
          'Hosting a terrace get-together in Bandra. Need something with 2 channels. Paying cash or UPI upfront.', 
          'Electronics & Tech', 
          CURRENT_DATE + INTERVAL '3 days', 
          '19:00', 
          1, 
          800.00, 
          'Bandra, Mumbai', 
          'OPEN'
        ),
        (
          $3, 
          'GoPro Hero 11 or 12 for Western Ghats Trek', 
          'Going on a monsoon weekend trek with friends. Need chest or helmet mount if possible.', 
          'Electronics & Tech', 
          CURRENT_DATE + INTERVAL '5 days', 
          '08:00', 
          3, 
          1200.00, 
          'Koramangala, Bangalore', 
          'OPEN'
        ),
        (
          $4, 
          'Heavy Duty Ladder + Drill Set for Studio Setup', 
          'Just moved into an apartment in Powai. Need a ladder and drill for 1 afternoon to mount acoustic panels.', 
          'Tools & DIY', 
          CURRENT_DATE + INTERVAL '1 days', 
          '11:00', 
          1, 
          400.00, 
          'Powai, Mumbai', 
          'OPEN'
        )
    `, [ananyaId, rohitId, zoyaId, kabirId]);
        // Seed Bookings
        const bookingRes = await client.query(`
      INSERT INTO bookings (item_id, borrower_id, lender_id, start_date, start_time, duration_days, total_price, status, message)
      VALUES 
        (
          $1, 
          $2, 
          $3, 
          CURRENT_DATE + INTERVAL '1 days', 
          '10:00', 
          2, 
          700.00, 
          'ACCEPTED', 
          'Hey Rohit! Need your Canon EOS 250D for an outdoor fashion shoot in Lodhi Art District.'
        ),
        (
          $4, 
          $3, 
          $5, 
          CURRENT_DATE + INTERVAL '4 days', 
          '17:00', 
          2, 
          600.00, 
          'PENDING', 
          'Hey Ananya! Would love to rent your Nebula projector for movie night with friends.'
        )
      RETURNING id, item_id, borrower_id, lender_id;
    `, [canonId, ananyaId, rohitId, projectorId, ananyaId]);
        const activeBookingId = bookingRes.rows[0].id;
        // Seed Messages for the accepted booking
        await client.query(`
      INSERT INTO messages (booking_id, sender_id, receiver_id, content, created_at)
      VALUES 
        ($1, $2, $3, 'Hey Rohit! Thanks for accepting the booking. What time works best for pickup tomorrow?', NOW() - INTERVAL '30 minutes'),
        ($1, $3, $2, 'Hey Ananya! Anytime after 10 AM works. I am right near Select Citywalk in Saket. I have packed the camera with both batteries fully charged!', NOW() - INTERVAL '20 minutes'),
        ($1, $2, $3, 'Awesome! I will reach around 11 AM. See you then! ✨', NOW() - INTERVAL '5 minutes')
    `, [activeBookingId, ananyaId, rohitId]);
        await client.query('COMMIT');
        console.log('Database seeded successfully with users, items, bounties, bookings, and messages!');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Seeding failed:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.seedDatabase = seedDatabase;
if (require.main === module) {
    (0, exports.seedDatabase)()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
