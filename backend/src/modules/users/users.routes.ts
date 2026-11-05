import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { createNotification } from '../notifications/notifications.service';
import { extractCity } from '../../utils/city';

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
  phone: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  avatar_url: z.string().url().or(z.literal('')).nullable().optional(),
  banner_url: z.string().url().or(z.literal('')).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  address_text: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
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

    return sendSuccess(res, { available: true, message: 'Username is available' });
  } catch (error) {
    next(error);
  }
});


// Community Leaderboard (Top 10 Lenders, Borrowers, Free Sharers, and Best Reviews/Scores)
router.get('/leaderboard', async (req: Request, res: Response, next) => {
  try {
    // 1. Fetch active community users and their aggregated gear & review stats
    const realUsersRes = await query(`
      SELECT 
        u.id, 
        u.username,
        u.name, 
        COALESCE(NULLIF(TRIM(u.locality), ''), '') AS locality, 
        COALESCE(u.avatar_url, '') AS avatar_url, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer') AS bio, 
        COALESCE(u.trust_rating, u.rating, 0.00)::numeric(3, 2) AS trust_rating,
        COALESCE(u.owner_rating, 0.00)::numeric(3, 2) AS owner_rating,
        COALESCE(u.renter_rating, 0.00)::numeric(3, 2) AS renter_rating,
        COALESCE(u.community_lender_rating, 0.00)::numeric(3, 2) AS community_lender_rating,
        COALESCE(u.owner_reviews_count, 0)::int AS owner_reviews_count,
        COALESCE(u.renter_reviews_count, 0)::int AS renter_reviews_count,
        COALESCE(u.community_lender_reviews_count, 0)::int AS community_lender_reviews_count,
        COALESCE(u.rating, 0.00)::numeric(3, 2) AS rating, 
        u.trust_score,
        (SELECT COUNT(*)::int FROM items WHERE (owner_id = u.id OR (u.firebase_uid IS NOT NULL AND owner_id = u.firebase_uid)) AND status != 'UNAVAILABLE') AS items_count,
        (SELECT COUNT(*)::int FROM items WHERE (owner_id = u.id OR (u.firebase_uid IS NOT NULL AND owner_id = u.firebase_uid)) AND status != 'UNAVAILABLE' AND (price_per_day <= 0 OR price_per_day IS NULL OR available_for_borrowing = true)) AS free_items_count,
        (SELECT COUNT(*)::int FROM bookings WHERE (lender_id = u.id OR (u.firebase_uid IS NOT NULL AND lender_id = u.firebase_uid)) AND status = 'COMPLETED') AS lent_count,
        (SELECT COUNT(*)::int FROM bookings WHERE (borrower_id = u.id OR (u.firebase_uid IS NOT NULL AND borrower_id = u.firebase_uid)) AND status = 'COMPLETED') AS borrowed_count,
        (SELECT COUNT(*)::int FROM requests WHERE (seeker_id = u.id OR (u.firebase_uid IS NOT NULL AND seeker_id = u.firebase_uid)) AND status = 'FULFILLED') AS requests_count,
        (SELECT COUNT(*)::int FROM reviews WHERE (reviewee_id = u.id OR (u.firebase_uid IS NOT NULL AND reviewee_id = u.firebase_uid))) AS reviews_count,
        (SELECT COUNT(*)::int FROM reviews WHERE (reviewee_id = u.id OR (u.firebase_uid IS NOT NULL AND reviewee_id = u.firebase_uid)) AND review_type = 'OWNER_RENTAL') AS derived_owner_rev_count,
        (SELECT COUNT(*)::int FROM reviews WHERE (reviewee_id = u.id OR (u.firebase_uid IS NOT NULL AND reviewee_id = u.firebase_uid)) AND review_type = 'RENTER') AS derived_renter_rev_count,
        (SELECT COUNT(*)::int FROM reviews WHERE (reviewee_id = u.id OR (u.firebase_uid IS NOT NULL AND reviewee_id = u.firebase_uid)) AND review_type = 'COMMUNITY_LENDER') AS derived_sharer_rev_count,
        NOT EXISTS (SELECT 1 FROM bookings b WHERE (b.borrower_id = u.id OR (u.firebase_uid IS NOT NULL AND b.borrower_id = u.firebase_uid)) AND b.status = 'COMPLETED' AND b.is_on_time = false) AS is_punctual,
        (SELECT comment FROM reviews WHERE (reviewee_id = u.id OR (u.firebase_uid IS NOT NULL AND reviewee_id = u.firebase_uid)) AND comment IS NOT NULL AND comment != '' ORDER BY created_at DESC LIMIT 1) AS latest_review
      FROM users u
      WHERE u.owner_reviews_count > 0 
         OR u.renter_reviews_count > 0 
         OR u.community_lender_reviews_count > 0 
         OR u.trust_rating > 0
         OR EXISTS (SELECT 1 FROM reviews r WHERE r.reviewee_id = u.id OR (u.firebase_uid IS NOT NULL AND r.reviewee_id = u.firebase_uid))
         OR EXISTS (SELECT 1 FROM items i WHERE (i.owner_id = u.id OR (u.firebase_uid IS NOT NULL AND i.owner_id = u.firebase_uid)) AND i.status != 'UNAVAILABLE')
         OR EXISTS (SELECT 1 FROM bookings b WHERE (b.borrower_id = u.id OR (u.firebase_uid IS NOT NULL AND b.borrower_id = u.firebase_uid) OR b.lender_id = u.id OR (u.firebase_uid IS NOT NULL AND b.lender_id = u.firebase_uid)) AND b.status = 'COMPLETED')
      ORDER BY u.created_at ASC
    `);

    // Helper functions to generate truthful, data-backed badges
    const getTopRatedBadges = (m: any, rank: number) => {
      const b: string[] = [];
      if (rank === 1) b.push('#1 Overall Trust');
      else if (rank <= 3) b.push('Top Trust Neighbor');
      else b.push('Verified Neighbor');

      if (m.trust_rating >= 4.95) b.push('5-Star Reputation');
      else if (m.trust_rating >= 4.5) b.push('Top Rated');
      else b.push('Active Member');

      if (m.reviews_count >= 5) b.push('High Feedback');
      else b.push('Verified Feedback');
      return b;
    };

    const getOwnerBadges = (m: any, rank: number) => {
      const b: string[] = [];
      if (rank === 1) b.push('#1 Gear Owner');
      else if (rank <= 3) b.push('Top Gear Owner');
      else b.push('Verified Owner');

      if (m.owner_rating >= 4.95) b.push('5-Star Owner');
      else if (m.owner_rating >= 4.5) b.push('Top Rated Owner');
      else b.push('Active Owner');

      if (m.lent_count >= 3) b.push('Experienced Lender');
      else b.push('Gear Sharer');
      return b;
    };

    const getRenterBadges = (m: any, rank: number) => {
      const b: string[] = [];
      if (rank === 1) b.push('#1 Trusted Renter');
      else if (rank <= 3) b.push('Top Renter');
      else b.push('Verified Renter');

      if (m.renter_rating >= 4.95) b.push('5-Star Renter');
      else if (m.renter_rating >= 4.5) b.push('Top Rated Renter');
      else b.push('Active Renter');

      if (m.borrowed_count > 0 && m.is_punctual) b.push('100% Punctual');
      else if (m.borrowed_count >= 3) b.push('Reliable Borrower');
      else b.push('Community Peer');
      return b;
    };

    const getSharerBadges = (m: any, rank: number) => {
      const b: string[] = [];
      if (rank === 1) b.push('#1 Community Lender');
      else if (rank <= 3) b.push('Top Community Lender');
      else b.push('Community Lender');

      if (m.community_lender_rating >= 4.95) b.push('5-Star Sharer');
      else if (m.community_lender_rating >= 4.5) b.push('Top Rated Sharer');
      else b.push('Gift Economy Contributor');

      b.push('Free Sharer Badge');
      return b;
    };

    // Format real users with fallbacks and accurate score preservation
    const formattedRealUsers = realUsersRes.rows.map((u: any) => {
      const name = u.name || 'Community Member';
      const username = u.username || '';
      const avatar = u.avatar_url && u.avatar_url.trim() !== ''
        ? u.avatar_url
        : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
      
      const reviews_count = parseInt(u.reviews_count, 10) || 0;
      const owner_reviews_count = (parseInt(u.owner_reviews_count, 10) || 0) || (parseInt(u.derived_owner_rev_count, 10) || 0);
      const renter_reviews_count = (parseInt(u.renter_reviews_count, 10) || 0) || (parseInt(u.derived_renter_rev_count, 10) || 0);
      const community_lender_reviews_count = (parseInt(u.community_lender_reviews_count, 10) || 0) || (parseInt(u.derived_sharer_rev_count, 10) || 0);

      // Without genuine reviews, ratings stay strictly 0.00
      const trust_rating = reviews_count > 0 ? (parseFloat(u.trust_rating) || parseFloat(u.rating) || 0.0) : 0.0;
      const owner_rating = owner_reviews_count > 0 ? (parseFloat(u.owner_rating) || 0.0) : 0.0;
      const renter_rating = renter_reviews_count > 0 ? (parseFloat(u.renter_rating) || 0.0) : 0.0;
      const community_lender_rating = community_lender_reviews_count > 0 ? (parseFloat(u.community_lender_rating) || 0.0) : 0.0;

      const rating = trust_rating;
      const items_count = parseInt(u.items_count, 10) || 0;
      const free_items_count = parseInt(u.free_items_count, 10) || 0;
      const lent_count = parseInt(u.lent_count, 10) || 0;
      const borrowed_count = parseInt(u.borrowed_count, 10) || 0;
      // Preserve a genuine score if reviews/exchanges exist, otherwise return null
      const trust_score = (reviews_count > 0 || (lent_count + borrowed_count) > 0)
        ? (u.trust_score !== null && u.trust_score !== undefined ? parseInt(u.trust_score, 10) : null)
        : null;
      const requests_count = parseInt(u.requests_count, 10) || 0;
      const is_punctual = Boolean(u.is_punctual);
      const highlight_review = reviews_count > 0 ? (u.latest_review || '') : '';

      return {
        id: u.id,
        username,
        name,
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
        is_punctual,
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
        const bScore = b.trust_score ?? 0;
        const aScore = a.trust_score ?? 0;
        if (bScore !== aScore) return bScore - aScore;
        return b.reviews_count - a.reviews_count;
      })
      .slice(0, 10)
      .map((member, index) => ({
        ...member,
        rank: index + 1,
        category_type: 'top_rated',
        metric_label: 'Overall Trust Rating',
        metric_value: `${((member as any).trust_rating || member.rating || 0.0).toFixed(2)} Rating (${member.reviews_count} Reviews)`,
        badges: getTopRatedBadges(member, index + 1),
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
        metric_value: `${((member as any).owner_rating || 0.0).toFixed(2)} Rating (${member.owner_reviews_count} Owner Reviews)`,
        badges: getOwnerBadges(member, index + 1),
      }));

    // 3. CATEGORY: TOP RENTERS (Strictly members with renter_reviews_count > 0)
    const topBorrowersSorted = combinedPool
      .filter((m) => m.renter_reviews_count > 0)
      .sort((a, b) => {
        const bRr = (b as any).renter_rating ?? 0.0;
        const aRr = (a as any).renter_rating ?? 0.0;
        if (bRr !== aRr) return bRr - aRr;
        const scoreB = b.borrowed_count * 5 + b.requests_count * 2;
        const scoreA = a.borrowed_count * 5 + a.requests_count * 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.renter_reviews_count - a.renter_reviews_count;
      })
      .slice(0, 10)
      .map((member, index) => ({
        ...member,
        rank: index + 1,
        category_type: 'top_borrowers',
        metric_label: 'Renter Rating',
        metric_value: `${((member as any).renter_rating || 0.0).toFixed(2)} Rating (${member.renter_reviews_count} Renter Reviews)`,
        badges: getRenterBadges(member, index + 1),
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
        metric_value: `${((member as any).community_lender_rating || 0.0).toFixed(2)} Rating (${member.community_lender_reviews_count} Free Share Reviews)`,
        badges: getSharerBadges(member, index + 1),
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
        COALESCE(NULLIF(TRIM(u.locality), ''), '') AS locality, 
        COALESCE(u.avatar_url, '') AS avatar_url, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer') AS bio, 
        COALESCE(u.rating, 0.00)::numeric(3, 2) AS rating, 
        u.trust_score::int AS trust_score,
        COALESCE(u.is_verified, FALSE) AS is_verified,
        (SELECT COUNT(*)::int FROM items WHERE owner_id = u.id AND status != 'UNAVAILABLE') AS items_count,
        (SELECT COUNT(*)::int FROM requests WHERE seeker_id = u.id) AS requests_count,
        (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = u.id) AS reviews_count
      FROM users u
      WHERE u.name ILIKE $1 OR u.username ILIKE $1 OR u.locality ILIKE $1 OR u.bio ILIKE $1
      LIMIT 15
    `, [searchPattern]);

    const formattedRealUsers = realUsersRes.rows.map((u: any) => {
      const revsCount = parseInt(u.reviews_count, 10) || 0;
      return {
        id: u.id,
        username: u.username || '',
        name: u.name || 'Community Member',
        locality: u.locality,
        avatar_url: u.avatar_url && u.avatar_url.trim() !== ''
          ? u.avatar_url
          : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(u.name || 'user')}`,
        bio: u.bio,
        rating: revsCount > 0 ? (parseFloat(u.rating) || 0.0) : 0.0,
        trust_score: revsCount > 0 && u.trust_score !== null ? parseInt(u.trust_score, 10) : null,
        is_verified: Boolean(u.is_verified),
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
    const id = (req.params.id || '').replace(/^@/, '');
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
        trust_score::int AS trust_score, 
        COALESCE(is_verified, FALSE) AS is_verified,
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
    const targetUserIds = [user.id, user.firebase_uid].filter(Boolean) as string[];

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
         FROM items WHERE owner_id = ANY($1::text[]) AND status != 'UNAVAILABLE'
         ORDER BY created_at DESC`,
        [targetUserIds]
      );
      userItems = itemsRes.rows;

      const requestsRes = await query(
        `SELECT id, item_name, description, category, start_date, start_time, end_date, end_time, duration_days, offered_amount, locality, status, image_url, pickup_type, pickup_locality, return_type, return_locality, created_at
         FROM requests WHERE seeker_id = ANY($1::text[])
         ORDER BY created_at DESC`,
        [targetUserIds]
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
        COALESCE(u.name, 'Neighbor') AS reviewer_name, 
        COALESCE(u.avatar_url, '') AS reviewer_avatar,
        COALESCE(u.locality, '') AS reviewer_locality
       FROM reviews r
       LEFT JOIN users u ON (r.reviewer_id = u.id::text OR r.reviewer_id = u.firebase_uid)
       WHERE r.reviewee_id = ANY($1::text[])
       ORDER BY r.created_at DESC`,
      [targetUserIds]
    );

    const reviewsList = reviewsRes.rows;

    // User's activity stats
    const statsRes = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = ANY($1::text[])) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = ANY($1::text[]) AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = ANY($1::text[]) AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = ANY($1::text[])) AS requests_count,
        (SELECT COUNT(*) FROM reviews WHERE reviewee_id = ANY($1::text[])) AS reviews_count`,
      [targetUserIds]
    );

    const stats = statsRes.rows[0];

    const revCount = Math.max(parseInt(stats?.reviews_count, 10) || 0, reviewsList.length);
    const derivedOwnerReviews = reviewsList.filter((r) => r.review_type === 'OWNER_RENTAL');
    const derivedRenterReviews = reviewsList.filter((r) => r.review_type === 'RENTER');
    const derivedCommLenderReviews = reviewsList.filter((r) => r.review_type === 'COMMUNITY_LENDER');

    const effectiveOwnerCount = (parseInt(user.owner_reviews_count, 10) || 0) || derivedOwnerReviews.length;
    const effectiveRenterCount = (parseInt(user.renter_reviews_count, 10) || 0) || derivedRenterReviews.length;
    const effectiveCommLenderCount = (parseInt(user.community_lender_reviews_count, 10) || 0) || derivedCommLenderReviews.length;

    const calcAvg = (list: any[]) => list.length > 0 ? parseFloat((list.reduce((acc, curr) => acc + Number(curr.rating || 0), 0) / list.length).toFixed(2)) : 0.0;

    const ownerRating = effectiveOwnerCount > 0 ? (parseFloat(user.owner_rating) || calcAvg(derivedOwnerReviews)) : 0.0;
    const renterRating = effectiveRenterCount > 0 ? (parseFloat(user.renter_rating) || calcAvg(derivedRenterReviews)) : 0.0;
    const communityLenderRating = effectiveCommLenderCount > 0 ? (parseFloat(user.community_lender_rating) || calcAvg(derivedCommLenderReviews)) : 0.0;
    const trustRating = revCount > 0 ? (parseFloat(user.trust_rating) || parseFloat(user.rating) || calcAvg(reviewsList)) : 0.0;

    const totalExchanges = (parseInt(stats?.completed_lent, 10) || 0) + (parseInt(stats?.completed_borrowed, 10) || 0);
    let computedTrustScore: number | null = null;
    if (revCount > 0) {
      computedTrustScore = Math.min(100, Math.max(0, Math.round((trustRating / 5.0) * 85 + Math.min(15, revCount * 2 + totalExchanges))));
    } else if (totalExchanges > 0) {
      computedTrustScore = Math.min(100, Math.max(60, 60 + totalExchanges * 5));
    } else {
      // Zero reviews and zero completed exchanges -> genuine unrated score (null)
      computedTrustScore = null;
    }

    const isSelf = Boolean(currentUserId && (currentUserId === user.id || currentUserId === user.firebase_uid));

    return sendSuccess(res, {
      id: user.id,
      username: user.username || '',
      name: user.name || 'Community Member',
      is_verified: Boolean(user.is_verified),
      locality: isSelf ? (user.locality || '') : (user.locality ? extractCity(user.locality) : ''),
      address_text: isSelf ? (user.address_text || '') : '',
      pincode: isSelf ? (user.pincode || '') : '',
      avatar_url: user.avatar_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(user.name || 'user')}`,
      banner_url: user.banner_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80',
      bio: user.bio || 'Neighbor & Gear Sharer. Passionate about circular economy and community access over ownership.',
      trust_score: computedTrustScore,
      rating: trustRating,
      trust_rating: trustRating,
      owner_rating: ownerRating,
      renter_rating: renterRating,
      community_lender_rating: communityLenderRating,
      owner_reviews_count: effectiveOwnerCount,
      renter_reviews_count: effectiveRenterCount,
      community_lender_reviews_count: effectiveCommLenderCount,
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
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id::text != $2 AND (firebase_uid IS NULL OR firebase_uid != $2) LIMIT 1`,
        [cleanUsername, userId]
      );
      if (existingUser.rows.length > 0) {
        return sendError(res, 'CONFLICT', 'Username is already taken by another user. Please choose another one.', 409);
      }
      values.push(cleanUsername);
      fields.push(`username = $${values.length}`);
    }
    if (validated.phone !== undefined) {
      const cleanVal = validated.phone ? validated.phone.trim() : null;
      values.push(cleanVal);
      fields.push(`phone = $${values.length}`);
    }
    if (validated.locality !== undefined) {
      const cleanVal = validated.locality ? validated.locality.trim() : null;
      values.push(cleanVal);
      fields.push(`locality = $${values.length}`);
    }
    if (validated.avatar_url !== undefined) {
      const cleanVal = validated.avatar_url ? validated.avatar_url.trim() : null;
      values.push(cleanVal);
      fields.push(`avatar_url = $${values.length}`);
    }
    if (validated.banner_url !== undefined) {
      const cleanVal = validated.banner_url ? validated.banner_url.trim() : null;
      values.push(cleanVal);
      fields.push(`banner_url = $${values.length}`);
    }
    if (validated.bio !== undefined) {
      const cleanVal = validated.bio ? validated.bio.trim() : null;
      values.push(cleanVal);
      fields.push(`bio = $${values.length}`);
    }
    if (validated.address_text !== undefined) {
      const cleanVal = validated.address_text ? validated.address_text.trim() : null;
      values.push(cleanVal);
      fields.push(`address_text = $${values.length}`);
    }
    let cleanPincode: string | null | undefined = undefined;
    if (validated.pincode !== undefined) {
      cleanPincode = validated.pincode?.trim() || null;
      values.push(cleanPincode);
      fields.push(`pincode = $${values.length}`);

      // 3NF: Upsert into postal_codes table before referencing it in users
      if (cleanPincode) {
        let effectiveLocality = validated.locality?.trim();
        if (!effectiveLocality) {
          const userLocRes = await query(`SELECT locality FROM users WHERE id = $1`, [userId]);
          effectiveLocality = userLocRes.rows[0]?.locality?.trim() || 'Neighborhood';
        }
        await query(
          `INSERT INTO postal_codes (pincode, locality) VALUES ($1, $2) ON CONFLICT (pincode) DO NOTHING`,
          [cleanPincode, effectiveLocality]
        ).catch(() => {});
      }
    }
    if (validated.latitude !== undefined) {
      values.push(validated.latitude ?? null);
      fields.push(`latitude = $${values.length}`);
    }
    if (validated.longitude !== undefined) {
      values.push(validated.longitude ?? null);
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
      RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, notify_nearby_requests_5km, COALESCE(is_verified, FALSE) AS is_verified, COALESCE(saved_locations, '[]'::jsonb) AS saved_locations, created_at
    `;

    const result = await query(updateSql, values);
    const updatedUser = result.rows[0];

    return sendSuccess(res, updatedUser, 'Profile updated successfully.');
  } catch (error) {
    next(error);
  }
});

// Helper to resolve user ID from UUID, Firebase UID, or @username
async function resolveUserId(idOrHandle: string): Promise<string | null> {
  const clean = (idOrHandle || '').replace(/^@/, '').trim();
  if (!clean) return null;
  const res = await query(
    `SELECT id FROM users WHERE id = $1 OR firebase_uid = $1 OR LOWER(username) = LOWER($1) LIMIT 1`,
    [clean]
  );
  return res.rows[0]?.id || null;
}

// Follow a user
router.post('/:id/follow', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const followerId = req.user!.id;
    const followingId = await resolveUserId(req.params.id);

    if (!followingId) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

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

    const insertRes = await query(
      `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *`,
      [followerId, followingId]
    );

    // Notify the followed user only if this was a new follow action (avoids duplicate alerts)
    if (insertRes.rows.length > 0) {
      await createNotification({
        userId: followingId,
        senderId: followerId,
        type: 'NEW_FOLLOWER',
        title: 'New Follower',
        body: `${req.user!.name || 'A neighbor'} started following your gear listings.`,
      }).catch((err) => {
        console.warn('Failed to send follower notification:', err);
      });
    }

    const countRes = await query(`SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`, [followingId]);
    return sendSuccess(res, { is_following: true, followers_count: countRes.rows[0]?.count || 0 }, 'Followed neighbor');
  } catch (error) {
    next(error);
  }
});

// Get User's Followers List
router.get('/:id/followers', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const targetUserId = await resolveUserId(req.params.id);
    if (!targetUserId) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }
    const currentViewerId = (req as AuthenticatedRequest).user?.id;

    const result = await query(
      `SELECT 
        u.id, u.name, u.username, u.avatar_url, 
        COALESCE(u.locality, '') AS locality, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer') AS bio,
        COALESCE(u.rating, 0.00)::numeric(3, 2) AS rating,
        u.trust_score::int AS trust_score,
        COALESCE(u.is_verified, FALSE) AS is_verified,
        uf.created_at AS followed_at,
        EXISTS(SELECT 1 FROM user_follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM user_follows uf
       JOIN users u ON (uf.follower_id = u.id OR uf.follower_id = u.firebase_uid)
       WHERE uf.following_id = $1
       ORDER BY uf.created_at DESC
       LIMIT 50`,
      [targetUserId, currentViewerId || '']
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Get User's Following List
router.get('/:id/following', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const targetUserId = await resolveUserId(req.params.id);
    if (!targetUserId) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }
    const currentViewerId = (req as AuthenticatedRequest).user?.id;

    const result = await query(
      `SELECT 
        u.id, u.name, u.username, u.avatar_url, 
        COALESCE(u.locality, '') AS locality, 
        COALESCE(u.bio, 'Neighbor & Gear Sharer') AS bio,
        COALESCE(u.rating, 0.00)::numeric(3, 2) AS rating,
        u.trust_score::int AS trust_score,
        COALESCE(u.is_verified, FALSE) AS is_verified,
        uf.created_at AS followed_at,
        EXISTS(SELECT 1 FROM user_follows WHERE follower_id = $2 AND following_id = u.id) AS is_following
       FROM user_follows uf
       JOIN users u ON (uf.following_id = u.id OR uf.following_id = u.firebase_uid)
       WHERE uf.follower_id = $1
       ORDER BY uf.created_at DESC
       LIMIT 50`,
      [targetUserId, currentViewerId || '']
    );

    return sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Unfollow a user
router.post('/:id/unfollow', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const followerId = req.user!.id;
    const followingId = await resolveUserId(req.params.id);

    if (!followingId) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

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
    const blockedId = await resolveUserId(req.params.id);

    if (!blockedId) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

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
    const blockedId = await resolveUserId(req.params.id);

    if (!blockedId) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

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
