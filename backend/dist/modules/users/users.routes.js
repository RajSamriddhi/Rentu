"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../../config/db");
const response_1 = require("../../middleware/response");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
    locality: zod_1.z.string().min(2).optional(),
    avatar_url: zod_1.z.string().url().or(zod_1.z.literal('')).optional(),
    banner_url: zod_1.z.string().url().or(zod_1.z.literal('')).optional(),
    bio: zod_1.z.string().max(300).optional(),
    address_text: zod_1.z.string().optional(),
    pincode: zod_1.z.string().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    notify_nearby_requests_5km: zod_1.z.boolean().optional(),
    saved_locations: zod_1.z.array(zod_1.z.any()).optional(),
});
// Community Leaderboard (Top 10 Lenders, Borrowers, Free Sharers, and Best Reviews/Scores)
router.get('/leaderboard', async (req, res, next) => {
    try {
        // 1. Fetch real users and their aggregated gear & community stats
        const realUsersRes = await (0, db_1.query)(`
      SELECT 
        u.id, 
        u.name, 
        u.email,
        COALESCE(NULLIF(TRIM(u.locality), ''), 'Bengaluru') AS locality, 
        COALESCE(u.avatar_url, '') AS avatar_url, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer ⚡') AS bio, 
        COALESCE(u.trust_rating, u.rating, 5.00)::numeric(3, 2) AS trust_rating,
        COALESCE(u.owner_rating, 5.00)::numeric(3, 2) AS owner_rating,
        COALESCE(u.renter_rating, 5.00)::numeric(3, 2) AS renter_rating,
        COALESCE(u.community_lender_rating, 5.00)::numeric(3, 2) AS community_lender_rating,
        COALESCE(u.owner_reviews_count, 0)::int AS owner_reviews_count,
        COALESCE(u.renter_reviews_count, 0)::int AS renter_reviews_count,
        COALESCE(u.community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
        COALESCE(u.rating, 5.00)::numeric(3, 2) AS rating, 
        COALESCE(u.trust_score, 98)::int AS trust_score,
        (SELECT COUNT(*)::int FROM items WHERE owner_id = u.id AND status != 'UNAVAILABLE') AS items_count,
        (SELECT COUNT(*)::int FROM items WHERE owner_id = u.id AND (price_per_day <= 0 OR price_per_day IS NULL)) AS free_items_count,
        (SELECT COUNT(*)::int FROM bookings WHERE lender_id = u.id AND status = 'COMPLETED') AS lent_count,
        (SELECT COUNT(*)::int FROM bookings WHERE borrower_id = u.id AND status = 'COMPLETED') AS borrowed_count,
        (SELECT COUNT(*)::int FROM requests WHERE seeker_id = u.id) AS requests_count,
        (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = u.id) AS reviews_count,
        (SELECT comment FROM reviews WHERE reviewee_id = u.id AND comment IS NOT NULL AND comment != '' ORDER BY created_at DESC LIMIT 1) AS latest_review
      FROM users u
      ORDER BY u.created_at ASC
    `);
        // Format real users with fallbacks
        const formattedRealUsers = realUsersRes.rows.map((u) => {
            const email = u.email || '';
            const name = u.name || 'Community Member';
            const avatar = u.avatar_url && u.avatar_url.trim() !== ''
                ? u.avatar_url
                : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
            const trust_rating = parseFloat(u.trust_rating) || parseFloat(u.rating) || 5.0;
            const owner_rating = parseFloat(u.owner_rating) || 5.0;
            const renter_rating = parseFloat(u.renter_rating) || 5.0;
            const community_lender_rating = parseFloat(u.community_lender_rating) || 5.0;
            const owner_reviews_count = parseInt(u.owner_reviews_count, 10) || 0;
            const renter_reviews_count = parseInt(u.renter_reviews_count, 10) || 0;
            const community_lender_reviews_count = parseInt(u.community_lender_reviews_count, 10) || 0;
            const rating = trust_rating;
            const trust_score = parseInt(u.trust_score, 10) || 98;
            const items_count = parseInt(u.items_count, 10) || 0;
            const free_items_count = parseInt(u.free_items_count, 10) || 0;
            const lent_count = parseInt(u.lent_count, 10) || 0;
            const borrowed_count = parseInt(u.borrowed_count, 10) || 0;
            const requests_count = parseInt(u.requests_count, 10) || 0;
            const reviews_count = parseInt(u.reviews_count, 10) || 0;
            const highlight_review = u.latest_review || '';
            return {
                id: u.id,
                name,
                email,
                locality: u.locality,
                avatar_url: avatar,
                bio: u.bio,
                rating,
                trust_rating,
                owner_rating,
                renter_rating,
                community_lender_rating,
                owner_reviews_count,
                renter_reviews_count,
                community_lender_reviews_count,
                trust_score,
                reviews_count,
                highlight_review,
                items_count,
                free_items_count,
                lent_count,
                borrowed_count,
                requests_count,
            };
        });
        const combinedPool = [...formattedRealUsers];
        // 1. CATEGORY: TOP RATED & OVERALL TRUST RATING (Average of all reviews across roles)
        const topRatedSorted = [...combinedPool].sort((a, b) => {
            const bTr = b.trust_rating ?? b.rating ?? 5.0;
            const aTr = a.trust_rating ?? a.rating ?? 5.0;
            if (bTr !== aTr)
                return bTr - aTr;
            if (b.trust_score !== a.trust_score)
                return b.trust_score - a.trust_score;
            return b.reviews_count - a.reviews_count;
        }).slice(0, 10).map((member, index) => ({
            ...member,
            rank: index + 1,
            category_type: 'top_rated',
            metric_label: 'Overall Trust Rating',
            metric_value: `${(member.trust_rating || member.rating || 5.0).toFixed(2)} ★ (${member.trust_score}% Trust)`,
            badges: index === 0
                ? ['👑 #1 Overall Trust', '🛡️ 100% Reputation', '🌟 Flawless Community Record']
                : index < 3
                    ? ['⭐ Top Trust Neighbor', '🛡️ Verified Trust', '💬 Outstanding Feedback']
                    : ['⭐ Top Rated', '🛡️ Verified Neighbor'],
        }));
        // 2. CATEGORY: TOP GEAR OWNERS (Ranked by Owner Rating from renters who rented gear)
        const topLendersSorted = [...combinedPool].sort((a, b) => {
            const bOr = b.owner_rating ?? 5.0;
            const aOr = a.owner_rating ?? 5.0;
            if (bOr !== aOr)
                return bOr - aOr;
            const scoreB = b.lent_count * 3 + b.items_count * 2;
            const scoreA = a.lent_count * 3 + a.items_count * 2;
            if (scoreB !== scoreA)
                return scoreB - scoreA;
            return b.trust_score - a.trust_score;
        }).slice(0, 10).map((member, index) => ({
            ...member,
            rank: index + 1,
            category_type: 'top_lenders',
            metric_label: 'Gear Owner Rating',
            metric_value: `${(member.owner_rating || 5.0).toFixed(2)} ★ (${member.lent_count} Rentals Lent)`,
            badges: index === 0
                ? ['👑 #1 Gear Owner', '📦 5-Star Equipment', '⚡ Instant Handover']
                : index < 3
                    ? ['🏷️ Super Gear Owner', '⚡ Verified Gear Care', '📦 Active Gear']
                    : ['🏷️ Top Gear Owner', '📦 Gear Sharer'],
        }));
        // 3. CATEGORY: TOP RENTERS (Ranked by Renter Rating from gear owners)
        const topBorrowersSorted = [...combinedPool].sort((a, b) => {
            const bRr = b.renter_rating ?? 5.0;
            const aRr = a.renter_rating ?? 5.0;
            if (bRr !== aRr)
                return bRr - aRr;
            const scoreB = b.borrowed_count * 3 + b.requests_count * 2;
            const scoreA = a.borrowed_count * 3 + a.requests_count * 2;
            if (scoreB !== scoreA)
                return scoreB - scoreA;
            return b.trust_score - a.trust_score;
        }).slice(0, 10).map((member, index) => ({
            ...member,
            rank: index + 1,
            category_type: 'top_borrowers',
            metric_label: 'Renter Rating',
            metric_value: `${(member.renter_rating || 5.0).toFixed(2)} ★ (${member.borrowed_count} Rentals Borrowed)`,
            badges: index === 0
                ? ['👑 #1 Trusted Renter', '⏱️ 100% Punctual', '🌱 Zero Waste Hero']
                : index < 3
                    ? ['🎒 5-Star Renter', '⏱️ 100% On-Time Return', '🤝 Trusted Neighbor']
                    : ['🎒 Verified Renter', '🤝 Verified Peer'],
        }));
        // 4. CATEGORY: TOP FREE COMMUNITY LENDERS (Ranked by Free Lender Rating from community)
        const topSharersSorted = [...combinedPool].sort((a, b) => {
            const bClr = b.community_lender_rating ?? 5.0;
            const aClr = a.community_lender_rating ?? 5.0;
            if (bClr !== aClr)
                return bClr - aClr;
            const scoreB = b.free_items_count * 3 + b.requests_count;
            const scoreA = a.free_items_count * 3 + a.requests_count;
            if (scoreB !== scoreA)
                return scoreB - scoreA;
            return b.trust_score - a.trust_score;
        }).slice(0, 10).map((member, index) => ({
            ...member,
            rank: index + 1,
            category_type: 'top_sharers',
            metric_label: 'Free Lender Rating',
            metric_value: `${(member.community_lender_rating || 5.0).toFixed(2)} ★ (${member.free_items_count} Free Shares)`,
            badges: index === 0
                ? ['👑 #1 Community Angel', '🎁 Gift Economy Pioneer', '❤️ Pure Generosity']
                : index < 3
                    ? ['🎁 Free Gear Angel', '🌱 Community Champion', '❤️ Neighbor Favorite']
                    : ['🎁 Community Lender', '❤️ Generous Neighbor'],
        }));
        return (0, response_1.sendSuccess)(res, {
            top_rated: topRatedSorted,
            top_lenders: topLendersSorted,
            top_borrowers: topBorrowersSorted,
            top_sharers: topSharersSorted,
            total_community_members: combinedPool.length,
        });
    }
    catch (error) {
        next(error);
    }
});
// Search Community Users by Name, Locality, or Bio
router.get('/search', async (req, res, next) => {
    try {
        const q = (req.query.q || req.query.query || req.query.search || '').trim();
        if (!q) {
            return (0, response_1.sendSuccess)(res, []);
        }
        const searchPattern = `%${q}%`;
        const realUsersRes = await (0, db_1.query)(`
      SELECT 
        u.id, 
        u.name, 
        u.email,
        COALESCE(NULLIF(TRIM(u.locality), ''), 'Bengaluru') AS locality, 
        COALESCE(u.avatar_url, '') AS avatar_url, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer ⚡') AS bio, 
        COALESCE(u.rating, 5.00)::numeric(3, 2) AS rating, 
        COALESCE(u.trust_score, 98)::int AS trust_score,
        (SELECT COUNT(*)::int FROM items WHERE owner_id = u.id AND status != 'UNAVAILABLE') AS items_count,
        (SELECT COUNT(*)::int FROM requests WHERE seeker_id = u.id) AS requests_count,
        (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = u.id) AS reviews_count
      FROM users u
      WHERE u.name ILIKE $1 OR u.locality ILIKE $1 OR u.bio ILIKE $1 OR u.email ILIKE $1
      LIMIT 15
    `, [searchPattern]);
        const formattedRealUsers = realUsersRes.rows.map((u) => ({
            id: u.id,
            name: u.name || 'Community Member',
            email: u.email,
            locality: u.locality,
            avatar_url: u.avatar_url && u.avatar_url.trim() !== ''
                ? u.avatar_url
                : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(u.name || 'user')}`,
            bio: u.bio,
            rating: parseFloat(u.rating) || 5.0,
            trust_score: parseInt(u.trust_score, 10) || 98,
            items_count: parseInt(u.items_count, 10) || 0,
            requests_count: parseInt(u.requests_count, 10) || 0,
            reviews_count: parseInt(u.reviews_count, 10) || 0,
        }));
        return (0, response_1.sendSuccess)(res, formattedRealUsers);
    }
    catch (error) {
        next(error);
    }
});
// Public User Profile & Gear Closet
router.get('/:id', auth_1.optionalAuthMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.id;
        // Check relationship if viewer is authenticated
        let isFollowing = false;
        let isBlocked = false;
        let isBlockedBy = false;
        if (currentUserId && currentUserId !== id) {
            const [fRes, bRes, bbRes] = await Promise.all([
                (0, db_1.query)(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, id]),
                (0, db_1.query)(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [currentUserId, id]),
                (0, db_1.query)(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [id, currentUserId]),
            ]);
            isFollowing = fRes.rows.length > 0;
            isBlocked = bRes.rows.length > 0;
            isBlockedBy = bbRes.rows.length > 0;
        }
        // Follower & following counts
        const countsRes = await (0, db_1.query)(`
      SELECT 
        (SELECT COUNT(*)::int FROM user_follows WHERE following_id = $1) AS followers_count,
        (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = $1) AS following_count
    `, [id]).catch(() => ({ rows: [{ followers_count: 0, following_count: 0 }] }));
        const followersCount = countsRes.rows[0]?.followers_count || 0;
        const followingCount = countsRes.rows[0]?.following_count || 0;
        // Query real PostgreSQL user
        let userRes;
        try {
            userRes = await (0, db_1.query)(`SELECT 
          id, 
          name, 
          locality, 
          address_text,
          pincode,
          avatar_url, 
          banner_url, 
          bio, 
          COALESCE(trust_score, 98)::int AS trust_score, 
          COALESCE(trust_rating, rating, 5.00)::numeric(3, 2) AS trust_rating,
          COALESCE(owner_rating, 5.00)::numeric(3, 2) AS owner_rating,
          COALESCE(renter_rating, 5.00)::numeric(3, 2) AS renter_rating,
          COALESCE(community_lender_rating, 5.00)::numeric(3, 2) AS community_lender_rating,
          COALESCE(owner_reviews_count, 0)::int AS owner_reviews_count,
          COALESCE(renter_reviews_count, 0)::int AS renter_reviews_count,
          COALESCE(community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
          COALESCE(rating, 5.00)::numeric(3, 2) AS rating, 
          COALESCE(notify_nearby_requests_5km, TRUE) AS notify_nearby_requests_5km,
          COALESCE(saved_locations, '[]'::jsonb) AS saved_locations,
          created_at
         FROM users WHERE id = $1`, [id]);
        }
        catch (err) {
            if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
                console.warn('Auto-repairing missing user columns on query error...', err.message);
                try {
                    await (0, db_1.query)(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_locations JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_rating NUMERIC(3, 2) DEFAULT 5.00;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_rating NUMERIC(3, 2) DEFAULT 5.00;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_rating NUMERIC(3, 2) DEFAULT 5.00;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_reviews_count INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS renter_reviews_count INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS community_lender_reviews_count INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_rating NUMERIC(3, 2) DEFAULT 5.00;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_nearby_requests_5km BOOLEAN DEFAULT TRUE;
          `);
                    userRes = await (0, db_1.query)(`SELECT 
              id, 
              name, 
              locality, 
              address_text,
              pincode,
              avatar_url, 
              banner_url, 
              bio, 
              COALESCE(trust_score, 98)::int AS trust_score, 
              COALESCE(trust_rating, rating, 5.00)::numeric(3, 2) AS trust_rating,
              COALESCE(owner_rating, 5.00)::numeric(3, 2) AS owner_rating,
              COALESCE(renter_rating, 5.00)::numeric(3, 2) AS renter_rating,
              COALESCE(community_lender_rating, 5.00)::numeric(3, 2) AS community_lender_rating,
              COALESCE(owner_reviews_count, 0)::int AS owner_reviews_count,
              COALESCE(renter_reviews_count, 0)::int AS renter_reviews_count,
              COALESCE(community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
              COALESCE(rating, 5.00)::numeric(3, 2) AS rating, 
              COALESCE(notify_nearby_requests_5km, TRUE) AS notify_nearby_requests_5km,
              COALESCE(saved_locations, '[]'::jsonb) AS saved_locations,
              created_at
             FROM users WHERE id = $1`, [id]);
                }
                catch (retryErr) {
                    console.warn('Fallback to baseline user columns query:', retryErr.message);
                    userRes = await (0, db_1.query)(`SELECT 
              id, 
              name, 
              locality, 
              address_text, 
              pincode, 
              avatar_url, 
              banner_url, 
              bio, 
              COALESCE(trust_score, 98)::int AS trust_score, 
              COALESCE(rating, 5.00)::numeric(3, 2) AS rating, 
              created_at
             FROM users WHERE id = $1`, [id]);
                    if (userRes && userRes.rows.length > 0) {
                        userRes.rows[0].saved_locations = [];
                        userRes.rows[0].trust_rating = userRes.rows[0].rating;
                        userRes.rows[0].owner_rating = 5.00;
                        userRes.rows[0].renter_rating = 5.00;
                        userRes.rows[0].community_lender_rating = 5.00;
                        userRes.rows[0].owner_reviews_count = 0;
                        userRes.rows[0].renter_reviews_count = 0;
                        userRes.rows[0].community_lender_reviews_count = 0;
                        userRes.rows[0].notify_nearby_requests_5km = true;
                    }
                }
            }
            else {
                throw err;
            }
        }
        if (userRes.rows.length === 0) {
            return (0, response_1.sendError)(res, 'NOT_FOUND', 'User not found', 404);
        }
        const user = userRes.rows[0];
        // If blocked or blocked by, hide active listings & requests
        let userItems = [];
        let userRequests = [];
        if (!isBlocked && !isBlockedBy) {
            const itemsRes = await (0, db_1.query)(`SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, CASE WHEN status = 'RENTED' THEN 'AVAILABLE' ELSE status END AS status, locality, created_at
         FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
         ORDER BY created_at DESC`, [id]);
            userItems = itemsRes.rows;
            const requestsRes = await (0, db_1.query)(`SELECT id, item_name, description, category, start_date, start_time, end_date, end_time, duration_days, offered_amount, locality, status, image_url, pickup_type, pickup_locality, return_type, return_locality, created_at
         FROM requests WHERE seeker_id = $1
         ORDER BY created_at DESC`, [id]);
            userRequests = requestsRes.rows;
        }
        // User's reviews received
        const reviewsRes = await (0, db_1.query)(`SELECT 
        r.id, 
        r.rating, 
        r.comment, 
        COALESCE(r.review_type, 'OWNER_RENTAL') AS review_type,
        r.created_at, 
        COALESCE(u.name, 'Verified Neighbor') AS reviewer_name, 
        COALESCE(u.avatar_url, '') AS reviewer_avatar,
        COALESCE(u.locality, 'Bengaluru') AS reviewer_locality
       FROM reviews r
       LEFT JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC`, [id]);
        const reviewsList = reviewsRes.rows;
        // User's activity stats
        const statsRes = await (0, db_1.query)(`SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1 AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count,
        (SELECT COUNT(*) FROM reviews WHERE reviewee_id = $1) AS reviews_count`, [id]);
        const stats = statsRes.rows[0];
        const trustRating = parseFloat(user.trust_rating) || parseFloat(user.rating) || 5.0;
        const ownerRating = parseFloat(user.owner_rating) || 5.0;
        const renterRating = parseFloat(user.renter_rating) || 5.0;
        const communityLenderRating = parseFloat(user.community_lender_rating) || 5.0;
        const isSelf = Boolean(currentUserId && (currentUserId === user.id || currentUserId === user.firebase_uid));
        return (0, response_1.sendSuccess)(res, {
            id: user.id,
            name: user.name || 'Community Member',
            locality: user.locality || 'Bengaluru',
            address_text: isSelf ? (user.address_text || '') : '',
            pincode: isSelf ? (user.pincode || '') : '',
            avatar_url: user.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(user.name || 'user')}`,
            banner_url: user.banner_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80',
            bio: user.bio || 'Neighbor & Gear Sharer ⚡ Passionate about circular economy and community access over ownership.',
            trust_score: parseInt(user.trust_score, 10) || 98,
            rating: trustRating,
            trust_rating: trustRating,
            owner_rating: ownerRating,
            renter_rating: renterRating,
            community_lender_rating: communityLenderRating,
            owner_reviews_count: parseInt(user.owner_reviews_count, 10) || 0,
            renter_reviews_count: parseInt(user.renter_reviews_count, 10) || 0,
            community_lender_reviews_count: parseInt(user.community_lender_reviews_count, 10) || 0,
            created_at: user.created_at,
            notify_nearby_requests_5km: user.notify_nearby_requests_5km,
            saved_locations: isSelf ? (user.saved_locations || []) : [],
            is_following: isFollowing,
            is_blocked: isBlocked,
            is_blocked_by: isBlockedBy,
            followers_count: followersCount,
            following_count: followingCount,
            items: userItems,
            requests: userRequests,
            reviews: reviewsList,
            stats: {
                listings_count: parseInt(stats.listings_count, 10) || userItems.length,
                requests_count: parseInt(stats.requests_count, 10) || userRequests.length,
                completed_lent: parseInt(stats.completed_lent, 10) || 0,
                completed_borrowed: parseInt(stats.completed_borrowed, 10) || 0,
                reviews_count: Math.max(parseInt(stats.reviews_count, 10) || 0, reviewsList.length),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Update Profile
router.put('/profile', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const validated = updateProfileSchema.parse(req.body);
        const userId = req.user.id;
        const fields = [];
        const values = [];
        if (validated.name !== undefined) {
            values.push(validated.name);
            fields.push(`name = $${values.length}`);
        }
        if (validated.phone !== undefined) {
            values.push(validated.phone);
            fields.push(`phone = $${values.length}`);
        }
        if (validated.locality !== undefined) {
            values.push(validated.locality);
            fields.push(`locality = $${values.length}`);
        }
        if (validated.avatar_url !== undefined) {
            values.push(validated.avatar_url);
            fields.push(`avatar_url = $${values.length}`);
        }
        if (validated.banner_url !== undefined) {
            values.push(validated.banner_url);
            fields.push(`banner_url = $${values.length}`);
        }
        if (validated.bio !== undefined) {
            values.push(validated.bio);
            fields.push(`bio = $${values.length}`);
        }
        if (validated.address_text !== undefined) {
            values.push(validated.address_text);
            fields.push(`address_text = $${values.length}`);
        }
        let cleanPincode = undefined;
        if (validated.pincode !== undefined) {
            cleanPincode = validated.pincode?.trim() || null;
            values.push(cleanPincode);
            fields.push(`pincode = $${values.length}`);
            // 3NF: Upsert into postal_codes table before referencing it in users
            if (cleanPincode && validated.locality) {
                await (0, db_1.query)(`INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`, [cleanPincode, validated.locality]).catch(() => { });
            }
        }
        if (validated.latitude !== undefined) {
            values.push(validated.latitude);
            fields.push(`latitude = $${values.length}`);
        }
        if (validated.longitude !== undefined) {
            values.push(validated.longitude);
            fields.push(`longitude = $${values.length}`);
        }
        if (validated.notify_nearby_requests_5km !== undefined) {
            values.push(validated.notify_nearby_requests_5km);
            fields.push(`notify_nearby_requests_5km = $${values.length}`);
        }
        if (validated.saved_locations !== undefined) {
            values.push(JSON.stringify(validated.saved_locations));
            fields.push(`saved_locations = $${values.length}::jsonb`);
        }
        if (fields.length === 0) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'No fields to update', 400);
        }
        values.push(userId);
        const updateSql = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, notify_nearby_requests_5km, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
    `;
        const result = await (0, db_1.query)(updateSql, values);
        const updatedUser = result.rows[0];
        // Synchronize owner's active gear listings with updated location
        if (validated.locality !== undefined || validated.address_text !== undefined || validated.latitude !== undefined || validated.longitude !== undefined || cleanPincode !== undefined) {
            await (0, db_1.query)(`UPDATE items 
         SET locality = COALESCE($1, locality),
             address_text = COALESCE($2, address_text),
             pincode = COALESCE($3, pincode),
             latitude = COALESCE($4, latitude),
             longitude = COALESCE($5, longitude),
             updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = $6`, [validated.locality ?? null, validated.address_text ?? null, cleanPincode ?? null, validated.latitude ?? null, validated.longitude ?? null, userId]).catch((err) => console.error('Failed to sync items location:', err));
        }
        return (0, response_1.sendSuccess)(res, updatedUser, 'Profile updated successfully ✨');
    }
    catch (error) {
        next(error);
    }
});
// Follow a user
router.post('/:id/follow', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const followerId = req.user.id;
        const followingId = req.params.id;
        if (followerId === followingId) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'You cannot follow yourself', 400);
        }
        // Check block
        const blockCheck = await (0, db_1.query)(`SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`, [followerId, followingId]);
        if (blockCheck.rows.length > 0) {
            return (0, response_1.sendError)(res, 'FORBIDDEN', 'Cannot follow a blocked user', 403);
        }
        await (0, db_1.query)(`INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [followerId, followingId]);
        // Notify the followed user
        await (0, db_1.query)(`INSERT INTO notifications (user_id, sender_id, type, title, body)
       VALUES ($1, $2, 'NEW_FOLLOWER', 'New Follower 🎉', $3)`, [followingId, followerId, `${req.user.name || 'A neighbor'} started following your gear listings.`]).catch(() => { });
        const countRes = await (0, db_1.query)(`SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`, [followingId]);
        return (0, response_1.sendSuccess)(res, { is_following: true, followers_count: countRes.rows[0]?.count || 0 }, 'Followed neighbor');
    }
    catch (error) {
        next(error);
    }
});
// Unfollow a user
router.post('/:id/unfollow', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const followerId = req.user.id;
        const followingId = req.params.id;
        await (0, db_1.query)(`DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [followerId, followingId]);
        const countRes = await (0, db_1.query)(`SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`, [followingId]);
        return (0, response_1.sendSuccess)(res, { is_following: false, followers_count: countRes.rows[0]?.count || 0 }, 'Unfollowed neighbor');
    }
    catch (error) {
        next(error);
    }
});
// Block a user
router.post('/:id/block', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const blockerId = req.user.id;
        const blockedId = req.params.id;
        if (blockerId === blockedId) {
            return (0, response_1.sendError)(res, 'BAD_REQUEST', 'You cannot block yourself', 400);
        }
        await (0, db_1.query)(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [blockerId, blockedId]);
        // Clean up any follow ties between them
        await (0, db_1.query)(`DELETE FROM user_follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`, [blockerId, blockedId]);
        return (0, response_1.sendSuccess)(res, { is_blocked: true }, 'User blocked successfully. You will not see their listings, requests, or messages.');
    }
    catch (error) {
        next(error);
    }
});
// Unblock a user
router.post('/:id/unblock', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const blockerId = req.user.id;
        const blockedId = req.params.id;
        await (0, db_1.query)(`DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId]);
        return (0, response_1.sendSuccess)(res, { is_blocked: false }, 'User unblocked successfully');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
