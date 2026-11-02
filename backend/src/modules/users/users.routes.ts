import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

export const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'messages', 'chat', 'explore', 'marketplace', 'requests', 'bookings',
  'community', 'hustle', 'profile', 'settings', 'help', 'login', 'signup', 'auth',
  'terms', 'privacy', 'about', 'contact', 'user', 'u', 'root', 'bot', 'support',
  'null', 'undefined', 'item', 'items', 'request', 'booking', 'notifications'
]);

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  username: z.string().min(3).max(30).optional(),
  phone: z.string().optional(),
  locality: z.string().min(2).optional(),
  avatar_url: z.string().url().or(z.literal('')).optional(),
  banner_url: z.string().url().or(z.literal('')).optional(),
  bio: z.string().max(300).optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notify_nearby_requests_5km: z.boolean().optional(),
  saved_locations: z.array(z.any()).optional(),
});

// Check if a username is available
router.get('/check-username/:username', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const rawUsername = (req.params.username || '').trim().toLowerCase();
    const currentUserId = (req as AuthenticatedRequest).user?.id;

    if (!rawUsername || rawUsername.length < 3) {
      return sendSuccess(res, { available: false, message: 'Username must be at least 3 characters' });
    }
    if (rawUsername.length > 30) {
      return sendSuccess(res, { available: false, message: 'Username cannot exceed 30 characters' });
    }
    if (!/^[a-z0-9_]+$/.test(rawUsername)) {
      return sendSuccess(res, { available: false, message: 'Only lowercase letters, numbers, and underscores allowed' });
    }
    if (RESERVED_USERNAMES.has(rawUsername)) {
      return sendSuccess(res, { available: false, message: 'This username is reserved' });
    }

    const result = await query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) ${currentUserId ? 'AND id != $2' : ''} LIMIT 1`,
      currentUserId ? [rawUsername, currentUserId] : [rawUsername]
    );

    if (result.rows.length > 0) {
      return sendSuccess(res, { available: false, message: 'Username is already taken' });
    }

    return sendSuccess(res, { available: true, message: 'Username is available! ✨' });
  } catch (error) {
    next(error);
  }
});


// Community Leaderboard (Top 10 Lenders, Borrowers, Free Sharers, and Best Reviews/Scores)
router.get('/leaderboard', async (req: Request, res: Response, next) => {
  try {
    // 1. Fetch real users and their aggregated gear & community stats
    const realUsersRes = await query(`
      SELECT 
        u.id, 
        u.username,
        u.name, 
        u.email,
        COALESCE(NULLIF(TRIM(u.locality), ''), 'Bengaluru') AS locality, 
        COALESCE(u.avatar_url, '') AS avatar_url, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer ⚡') AS bio, 
        COALESCE(u.trust_rating, u.rating, 0.00)::numeric(3, 2) AS trust_rating,
        COALESCE(u.owner_rating, 0.00)::numeric(3, 2) AS owner_rating,
        COALESCE(u.renter_rating, 0.00)::numeric(3, 2) AS renter_rating,
        COALESCE(u.community_lender_rating, 0.00)::numeric(3, 2) AS community_lender_rating,
        COALESCE(u.owner_reviews_count, 0)::int AS owner_reviews_count,
        COALESCE(u.renter_reviews_count, 0)::int AS renter_reviews_count,
        COALESCE(u.community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
        COALESCE(u.rating, 0.00)::numeric(3, 2) AS rating, 
        COALESCE(u.trust_score, 90)::int AS trust_score,
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
    const formattedRealUsers = realUsersRes.rows.map((u: any) => {
      const email = u.email || '';
      const name = u.name || 'Community Member';
      const username = u.username || '';
      const avatar = u.avatar_url && u.avatar_url.trim() !== ''
        ? u.avatar_url
        : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
      
      const reviews_count = parseInt(u.reviews_count, 10) || 0;
      const owner_reviews_count = parseInt(u.owner_reviews_count, 10) || 0;
      const renter_reviews_count = parseInt(u.renter_reviews_count, 10) || 0;
      const community_lender_reviews_count = parseInt(u.community_lender_reviews_count, 10) || 0;

      // Without genuine reviews, ratings stay strictly 0.00
      const trust_rating = reviews_count > 0 ? (parseFloat(u.trust_rating) || parseFloat(u.rating) || 0.0) : 0.0;
      const owner_rating = owner_reviews_count > 0 ? (parseFloat(u.owner_rating) || 0.0) : 0.0;
      const renter_rating = renter_reviews_count > 0 ? (parseFloat(u.renter_rating) || 0.0) : 0.0;
      const community_lender_rating = community_lender_reviews_count > 0 ? (parseFloat(u.community_lender_rating) || 0.0) : 0.0;

      const rating = trust_rating;
      const trust_score = parseInt(u.trust_score, 10) || 90;
      const items_count = parseInt(u.items_count, 10) || 0;
      const free_items_count = parseInt(u.free_items_count, 10) || 0;
      const lent_count = parseInt(u.lent_count, 10) || 0;
      const borrowed_count = parseInt(u.borrowed_count, 10) || 0;
      const requests_count = parseInt(u.requests_count, 10) || 0;
      const highlight_review = reviews_count > 0 ? (u.latest_review || '') : '';

      return {
        id: u.id,
        username,
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

    // 1. CATEGORY: TOP RATED & OVERALL TRUST RATING (Strictly members with reviews_count > 0)
    const topRatedSorted = combinedPool
      .filter((m) => m.reviews_count > 0)
      .sort((a, b) => {
        const bTr = (b as any).trust_rating ?? (b as any).rating ?? 0.0;
        const aTr = (a as any).trust_rating ?? (a as any).rating ?? 0.0;
        if (bTr !== aTr) return bTr - aTr;
        if (b.trust_score !== a.trust_score) return b.trust_score - a.trust_score;
        return b.reviews_count - a.reviews_count;
      })
      .slice(0, 10)
      .map((member, index) => ({
        ...member,
        rank: index + 1,
        category_type: 'top_rated',
        metric_label: 'Overall Trust Rating',
        metric_value: `${((member as any).trust_rating || member.rating || 0.0).toFixed(2)} ★ (${member.reviews_count} Reviews)`,
        badges: index === 0 
          ? ['👑 #1 Overall Trust', '🛡️ Verified Reputation', '🌟 Flawless Community Record']
          : index < 3
          ? ['⭐ Top Trust Neighbor', '🛡️ Verified Trust', '💬 Outstanding Feedback']
          : ['⭐ Top Rated', '🛡️ Verified Neighbor'],
      }));

    // 2. CATEGORY: TOP GEAR OWNERS (Strictly members with owner_reviews_count > 0)
    const topLendersSorted = combinedPool
      .filter((m) => m.owner_reviews_count > 0)
      .sort((a, b) => {
        const bOr = (b as any).owner_rating ?? 0.0;
        const aOr = (a as any).owner_rating ?? 0.0;
        if (bOr !== aOr) return bOr - aOr;
        const scoreB = b.lent_count * 3 + b.items_count * 2;
        const scoreA = a.lent_count * 3 + a.items_count * 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.owner_reviews_count - a.owner_reviews_count;
      })
      .slice(0, 10)
      .map((member, index) => ({
        ...member,
        rank: index + 1,
        category_type: 'top_lenders',
        metric_label: 'Gear Owner Rating',
        metric_value: `${((member as any).owner_rating || 0.0).toFixed(2)} ★ (${member.owner_reviews_count} Owner Reviews)`,
        badges: index === 0
          ? ['👑 #1 Gear Owner', '📦 5-Star Equipment', '⚡ Instant Handover']
          : index < 3
          ? ['🏷️ Super Gear Owner', '⚡ Verified Gear Care', '📦 Active Gear']
          : ['🏷️ Top Gear Owner', '📦 Gear Sharer'],
      }));

    // 3. CATEGORY: TOP RENTERS (Strictly members with renter_reviews_count > 0)
    const topBorrowersSorted = combinedPool
      .filter((m) => m.renter_reviews_count > 0)
      .sort((a, b) => {
        const bRr = (b as any).renter_rating ?? 0.0;
        const aRr = (a as any).renter_rating ?? 0.0;
        if (bRr !== aRr) return bRr - aRr;
        const scoreB = b.borrowed_count * 3 + b.requests_count * 2;
        const scoreA = a.borrowed_count * 3 + a.requests_count * 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.renter_reviews_count - a.renter_reviews_count;
      })
      .slice(0, 10)
      .map((member, index) => ({
        ...member,
        rank: index + 1,
        category_type: 'top_borrowers',
        metric_label: 'Renter Rating',
        metric_value: `${((member as any).renter_rating || 0.0).toFixed(2)} ★ (${member.renter_reviews_count} Renter Reviews)`,
        badges: index === 0
          ? ['👑 #1 Trusted Renter', '⏱️ 100% Punctual', '🌱 Zero Waste Hero']
          : index < 3
          ? ['🎒 5-Star Renter', '⏱️ 100% On-Time Return', '🤝 Trusted Neighbor']
          : ['🎒 Verified Renter', '🤝 Verified Peer'],
      }));

    // 4. CATEGORY: TOP FREE COMMUNITY LENDERS (Strictly members with community_lender_reviews_count > 0)
    const topSharersSorted = combinedPool
      .filter((m) => m.community_lender_reviews_count > 0)
      .sort((a, b) => {
        const bClr = (b as any).community_lender_rating ?? 0.0;
        const aClr = (a as any).community_lender_rating ?? 0.0;
        if (bClr !== aClr) return bClr - aClr;
        const scoreB = b.free_items_count * 3 + b.requests_count;
        const scoreA = a.free_items_count * 3 + a.requests_count;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.community_lender_reviews_count - a.community_lender_reviews_count;
      })
      .slice(0, 10)
      .map((member, index) => ({
        ...member,
        rank: index + 1,
        category_type: 'top_sharers',
        metric_label: 'Free Lender Rating',
        metric_value: `${((member as any).community_lender_rating || 0.0).toFixed(2)} ★ (${member.community_lender_reviews_count} Free Share Reviews)`,
        badges: index === 0
          ? ['👑 #1 Community Angel', '🎁 Gift Economy Pioneer', '❤️ Pure Generosity']
          : index < 3
          ? ['🎁 Free Gear Angel', '🌱 Community Champion', '❤️ Neighbor Favorite']
          : ['🎁 Community Lender', '❤️ Generous Neighbor'],
      }));

    return sendSuccess(res, {
      top_rated: topRatedSorted,
      top_lenders: topLendersSorted,
      top_borrowers: topBorrowersSorted,
      top_sharers: topSharersSorted,
      total_community_members: combinedPool.length,
    });
  } catch (error) {
    next(error);
  }
});

// Search Community Users by Name, Locality, or Bio
router.get('/search', async (req: Request, res: Response, next) => {
  try {
    const q = ((req.query.q || req.query.query || req.query.search || '') as string).trim();
    if (!q) {
      return sendSuccess(res, []);
    }

    const searchPattern = `%${q}%`;
    const realUsersRes = await query(`
      SELECT 
        u.id, 
        u.username,
        u.name, 
        u.email,
        COALESCE(NULLIF(TRIM(u.locality), ''), 'Bengaluru') AS locality, 
        COALESCE(u.avatar_url, '') AS avatar_url, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer ⚡') AS bio, 
        COALESCE(u.rating, 0.00)::numeric(3, 2) AS rating, 
        COALESCE(u.trust_score, 90)::int AS trust_score,
        (SELECT COUNT(*)::int FROM items WHERE owner_id = u.id AND status != 'UNAVAILABLE') AS items_count,
        (SELECT COUNT(*)::int FROM requests WHERE seeker_id = u.id) AS requests_count,
        (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = u.id) AS reviews_count
      FROM users u
      WHERE u.name ILIKE $1 OR u.username ILIKE $1 OR u.locality ILIKE $1 OR u.bio ILIKE $1 OR u.email ILIKE $1
      LIMIT 15
    `, [searchPattern]);

    const formattedRealUsers = realUsersRes.rows.map((u: any) => {
      const revsCount = parseInt(u.reviews_count, 10) || 0;
      return {
        id: u.id,
        username: u.username || '',
        name: u.name || 'Community Member',
        email: u.email,
        locality: u.locality,
        avatar_url: u.avatar_url && u.avatar_url.trim() !== ''
          ? u.avatar_url
          : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(u.name || 'user')}`,
        bio: u.bio,
        rating: revsCount > 0 ? (parseFloat(u.rating) || 0.0) : 0.0,
        trust_score: parseInt(u.trust_score, 10) || 90,
        items_count: parseInt(u.items_count, 10) || 0,
        requests_count: parseInt(u.requests_count, 10) || 0,
        reviews_count: revsCount,
      };
    });

    return sendSuccess(res, formattedRealUsers);
  } catch (error) {
    next(error);
  }
});

// Public User Profile & Gear Closet (Lookup by UUID, Firebase UID, or Unique Username)
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as AuthenticatedRequest).user?.id;

    // 1. Query real PostgreSQL user by id, firebase_uid, or username
    let userRes = await query(
      `SELECT 
        id, 
        username,
        name, 
        locality, 
        address_text,
        pincode,
        avatar_url, 
        banner_url, 
        bio, 
        COALESCE(trust_score, 90)::int AS trust_score, 
        COALESCE(trust_rating, rating, 0.00)::numeric(3, 2) AS trust_rating,
        COALESCE(owner_rating, 0.00)::numeric(3, 2) AS owner_rating,
        COALESCE(renter_rating, 0.00)::numeric(3, 2) AS renter_rating,
        COALESCE(community_lender_rating, 0.00)::numeric(3, 2) AS community_lender_rating,
        COALESCE(owner_reviews_count, 0)::int AS owner_reviews_count,
        COALESCE(renter_reviews_count, 0)::int AS renter_reviews_count,
        COALESCE(community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
        COALESCE(rating, 0.00)::numeric(3, 2) AS rating, 
        COALESCE(notify_nearby_requests_5km, TRUE) AS notify_nearby_requests_5km,
        COALESCE(saved_locations, '[]'::jsonb) AS saved_locations,
        created_at
       FROM users 
       WHERE id = $1 OR firebase_uid = $1 OR LOWER(username) = LOWER($1)
       LIMIT 1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    const user = userRes.rows[0];
    const realUserId = user.id;

    // 2. Check relationship if viewer is authenticated
    let isFollowing = false;
    let isBlocked = false;
    let isBlockedBy = false;

    if (currentUserId && currentUserId !== realUserId) {
      const [fRes, bRes, bbRes] = await Promise.all([
        query(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, realUserId]),
        query(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [currentUserId, realUserId]),
        query(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [realUserId, currentUserId]),
      ]);
      isFollowing = fRes.rows.length > 0;
      isBlocked = bRes.rows.length > 0;
      isBlockedBy = bbRes.rows.length > 0;
    }

    // 3. Follower & following counts
    const countsRes = await query(`
      SELECT 
        (SELECT COUNT(*)::int FROM user_follows WHERE following_id = $1) AS followers_count,
        (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = $1) AS following_count
    `, [realUserId]).catch(() => ({ rows: [{ followers_count: 0, following_count: 0 }] }));
    const followersCount = countsRes.rows[0]?.followers_count || 0;
    const followingCount = countsRes.rows[0]?.following_count || 0;

    // If blocked or blocked by, hide active listings & requests
    let userItems: any[] = [];
    let userRequests: any[] = [];

    if (!isBlocked && !isBlockedBy) {
      const itemsRes = await query(
        `SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, CASE WHEN status = 'RENTED' THEN 'AVAILABLE' ELSE status END AS status, locality, created_at
         FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
         ORDER BY created_at DESC`,
        [realUserId]
      );
      userItems = itemsRes.rows;

      const requestsRes = await query(
        `SELECT id, item_name, description, category, start_date, start_time, end_date, end_time, duration_days, offered_amount, locality, status, image_url, pickup_type, pickup_locality, return_type, return_locality, created_at
         FROM requests WHERE seeker_id = $1
         ORDER BY created_at DESC`,
        [realUserId]
      );
      userRequests = requestsRes.rows;
    }

    // User's reviews received
    const reviewsRes = await query(
      `SELECT 
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
       ORDER BY r.created_at DESC`,
      [realUserId]
    );

    const reviewsList = reviewsRes.rows;

    // User's activity stats
    const statsRes = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1 AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count,
        (SELECT COUNT(*) FROM reviews WHERE reviewee_id = $1) AS reviews_count`,
      [realUserId]
    );

    const stats = statsRes.rows[0];

    const revCount = Math.max(parseInt(stats?.reviews_count, 10) || 0, reviewsList.length);
    const ownerRevCount = parseInt(user.owner_reviews_count, 10) || 0;
    const renterRevCount = parseInt(user.renter_reviews_count, 10) || 0;
    const commLenderRevCount = parseInt(user.community_lender_reviews_count, 10) || 0;

    const trustRating = revCount > 0 ? (parseFloat(user.trust_rating) || parseFloat(user.rating) || 0.0) : 0.0;
    const ownerRating = ownerRevCount > 0 ? (parseFloat(user.owner_rating) || 0.0) : 0.0;
    const renterRating = renterRevCount > 0 ? (parseFloat(user.renter_rating) || 0.0) : 0.0;
    const communityLenderRating = commLenderRevCount > 0 ? (parseFloat(user.community_lender_rating) || 0.0) : 0.0;

    const isSelf = Boolean(currentUserId && (currentUserId === user.id || currentUserId === user.firebase_uid));

    return sendSuccess(res, {
      id: user.id,
      username: user.username || '',
      name: user.name || 'Community Member',
      locality: user.locality || 'Bengaluru',
      address_text: isSelf ? (user.address_text || '') : '',
      pincode: isSelf ? (user.pincode || '') : '',
      avatar_url: user.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(user.name || 'user')}`,
      banner_url: user.banner_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80',
      bio: user.bio || 'Neighbor & Gear Sharer ⚡ Passionate about circular economy and community access over ownership.',
      trust_score: parseInt(user.trust_score, 10) || 90,
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
        listings_count: parseInt(stats?.listings_count, 10) || userItems.length,
        requests_count: parseInt(stats?.requests_count, 10) || userRequests.length,
        completed_lent: parseInt(stats?.completed_lent, 10) || 0,
        completed_borrowed: parseInt(stats?.completed_borrowed, 10) || 0,
        reviews_count: revCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update Profile
router.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const userId = req.user!.id;

    const fields: string[] = [];
    const values: any[] = [];

    if (validated.name !== undefined) {
      values.push(validated.name);
      fields.push(`name = $${values.length}`);
    }
    if (validated.username !== undefined) {
      const cleanUsername = validated.username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
        return sendError(res, 'BAD_REQUEST', 'Username must be 3-30 characters with letters, numbers, or underscores only', 400);
      }
      if (RESERVED_USERNAMES.has(cleanUsername)) {
        return sendError(res, 'BAD_REQUEST', 'This username is reserved. Please pick another one.', 400);
      }
      const existingUser = await query(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2 LIMIT 1`,
        [cleanUsername, userId]
      );
      if (existingUser.rows.length > 0) {
        return sendError(res, 'CONFLICT', 'Username is already taken by another user. Please choose another one.', 409);
      }
      values.push(cleanUsername);
      fields.push(`username = $${values.length}`);
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
    let cleanPincode: string | null | undefined = undefined;
    if (validated.pincode !== undefined) {
      cleanPincode = validated.pincode?.trim() || null;
      values.push(cleanPincode);
      fields.push(`pincode = $${values.length}`);

      // 3NF: Upsert into postal_codes table before referencing it in users
      if (cleanPincode && validated.locality) {
        await query(
          `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
          [cleanPincode, validated.locality]
        ).catch(() => {});
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
      return sendError(res, 'BAD_REQUEST', 'No fields to update', 400);
    }

    values.push(userId);
    const updateSql = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, notify_nearby_requests_5km, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
    `;

    const result = await query(updateSql, values);
    const updatedUser = result.rows[0];

    // Synchronize owner's active gear listings with updated location
    if (validated.locality !== undefined || validated.address_text !== undefined || validated.latitude !== undefined || validated.longitude !== undefined || cleanPincode !== undefined) {
      await query(
        `UPDATE items 
         SET locality = COALESCE($1, locality),
             address_text = COALESCE($2, address_text),
             pincode = COALESCE($3, pincode),
             latitude = COALESCE($4, latitude),
             longitude = COALESCE($5, longitude),
             updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = $6`,
        [validated.locality ?? null, validated.address_text ?? null, cleanPincode ?? null, validated.latitude ?? null, validated.longitude ?? null, userId]
      ).catch((err) => console.error('Failed to sync items location:', err));
    }

    return sendSuccess(res, updatedUser, 'Profile updated successfully ✨');
  } catch (error) {
    next(error);
  }
});

// Follow a user
router.post('/:id/follow', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const followerId = req.user!.id;
    const followingId = req.params.id;

    if (followerId === followingId) {
      return sendError(res, 'BAD_REQUEST', 'You cannot follow yourself', 400);
    }

    // Check block
    const blockCheck = await query(
      `SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [followerId, followingId]
    );
    if (blockCheck.rows.length > 0) {
      return sendError(res, 'FORBIDDEN', 'Cannot follow a blocked user', 403);
    }

    await query(
      `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );

    // Notify the followed user
    await query(
      `INSERT INTO notifications (user_id, sender_id, type, title, body)
       VALUES ($1, $2, 'NEW_FOLLOWER', 'New Follower 🎉', $3)`,
      [followingId, followerId, `${req.user!.name || 'A neighbor'} started following your gear listings.`]
    ).catch(() => {});

    const countRes = await query(`SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`, [followingId]);
    return sendSuccess(res, { is_following: true, followers_count: countRes.rows[0]?.count || 0 }, 'Followed neighbor');
  } catch (error) {
    next(error);
  }
});

// Unfollow a user
router.post('/:id/unfollow', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const followerId = req.user!.id;
    const followingId = req.params.id;

    await query(
      `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    const countRes = await query(`SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`, [followingId]);
    return sendSuccess(res, { is_following: false, followers_count: countRes.rows[0]?.count || 0 }, 'Unfollowed neighbor');
  } catch (error) {
    next(error);
  }
});

// Block a user
router.post('/:id/block', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.id;

    if (blockerId === blockedId) {
      return sendError(res, 'BAD_REQUEST', 'You cannot block yourself', 400);
    }

    await query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [blockerId, blockedId]
    );

    // Clean up any follow ties between them
    await query(
      `DELETE FROM user_follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`,
      [blockerId, blockedId]
    );

    return sendSuccess(res, { is_blocked: true }, 'User blocked successfully. You will not see their listings, requests, or messages.');
  } catch (error) {
    next(error);
  }
});

// Unblock a user
router.post('/:id/unblock', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.id;

    await query(
      `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );

    return sendSuccess(res, { is_blocked: false }, 'User unblocked successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
