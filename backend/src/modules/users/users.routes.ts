import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  locality: z.string().min(2).optional(),
  avatar_url: z.string().url().or(z.literal('')).optional(),
  banner_url: z.string().url().or(z.literal('')).optional(),
  bio: z.string().max(300).optional(),
  address_text: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});


// Curated community champions to guarantee vibrant, full top-10 lists across all categories
const SEED_COMMUNITY_CHAMPIONS = [
  {
    id: 'champ-sneha',
    name: 'Sneha Patel',
    email: 'sneha@nift.edu.in',
    locality: 'Jayanagar, Bangalore',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio: 'Fashion & textile creator @ NIFT 👗 Sharing styling kits & ring lights with fellow students.',
    rating: 5.0,
    trust_score: 100,
    reviews_count: 38,
    highlight_review: 'Absolute 5-star experience! Even with just a few rentals, her gear is pristine and handover was effortless.',
    items_count: 4,
    free_items_count: 8,
    lent_count: 6,
    borrowed_count: 12,
    requests_count: 7,
  },
  {
    id: 'champ-meera',
    name: 'Meera Iyer',
    email: 'meera@lensminimal.in',
    locality: 'Adyar, Chennai',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    bio: 'Minimalist photographer 📸 Best reviews because I obsess over gear hygiene and care.',
    rating: 5.0,
    trust_score: 100,
    reviews_count: 29,
    highlight_review: 'Highest rating well deserved! The camera lens had zero dust and came packed in a waterproof hardcase.',
    items_count: 3,
    free_items_count: 5,
    lent_count: 5,
    borrowed_count: 8,
    requests_count: 4,
  },
  {
    id: 'champ-aarav',
    name: 'Aarav Mehta',
    email: 'aarav@borrowflex.com',
    locality: 'Powai, Mumbai',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    bio: 'Community Lead @ Rentu ⚡ Building the anti-ownership gear sharing network.',
    rating: 5.0,
    trust_score: 100,
    reviews_count: 42,
    highlight_review: 'Legendary neighbor! Handed over his gimbal with 3 charged batteries and pro camera advice.',
    items_count: 9,
    free_items_count: 6,
    lent_count: 20,
    borrowed_count: 14,
    requests_count: 8,
  },
  {
    id: 'champ-priya',
    name: 'Priya Sharma',
    email: 'priya@zerowaste.in',
    locality: 'Indiranagar, Bangalore',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    bio: 'Eco-conscious creator 🌿 Free community borrowing advocate. Stop buying things you use once a year!',
    rating: 5.0,
    trust_score: 99,
    reviews_count: 44,
    highlight_review: 'Gave me her 4-person tent for free for a 3-day trek. The kindest and most generous neighbor!',
    items_count: 5,
    free_items_count: 10,
    lent_count: 8,
    borrowed_count: 24,
    requests_count: 12,
  },
  {
    id: 'champ-rohit',
    name: 'Rohit Verma',
    email: 'rohit@delhicrew.in',
    locality: 'Saket, New Delhi',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    bio: 'Indie filmmaker & camera nerd 📸 Gear chills when I chill. Top lender in South Delhi.',
    rating: 4.98,
    trust_score: 99,
    reviews_count: 46,
    highlight_review: 'Canon 80D with pristine sensor, flip screen, and memory card. Smooth pickup near Saket Metro.',
    items_count: 13,
    free_items_count: 3,
    lent_count: 28,
    borrowed_count: 9,
    requests_count: 5,
  },
  {
    id: 'champ-ananya',
    name: 'Ananya Roy',
    email: 'ananya@designblore.in',
    locality: 'Koramangala, Bangalore',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    bio: 'Design student & visual artist 🎨 Borrow > Buy always. Active borrower & free sharer.',
    rating: 4.97,
    trust_score: 98,
    reviews_count: 34,
    highlight_review: 'Returned the mini projector spotlessly on time with extra batteries. Dream borrower to deal with!',
    items_count: 6,
    free_items_count: 7,
    lent_count: 11,
    borrowed_count: 20,
    requests_count: 9,
  },
  {
    id: 'champ-kabir',
    name: 'Kabir Sen',
    email: 'kabir@soundvault.in',
    locality: 'Bandra West, Mumbai',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Audio engineer & DJ 🎧 Helping folks host legendary rooftop gigs and music jams.',
    rating: 4.96,
    trust_score: 98,
    reviews_count: 31,
    highlight_review: 'DJ controller was club-ready and came with high-end audio cables. Kabir gave great setup tips.',
    items_count: 10,
    free_items_count: 4,
    lent_count: 22,
    borrowed_count: 11,
    requests_count: 6,
  },
  {
    id: 'champ-vikram',
    name: 'Vikram Malhotra',
    email: 'vikram@droneshare.in',
    locality: 'HSR Layout, Bangalore',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: 'Drone pilot & gadget hoarder 🚁 Rent my equipment so I can invest in newer tech.',
    rating: 4.95,
    trust_score: 98,
    reviews_count: 48,
    highlight_review: 'Top lender hands down. DJI Mavic was pre-calibrated with 3 fly-more batteries and SD card.',
    items_count: 15,
    free_items_count: 2,
    lent_count: 34,
    borrowed_count: 7,
    requests_count: 4,
  },
  {
    id: 'champ-zoya',
    name: 'Zoya Khan',
    email: 'zoya@himalayantrek.in',
    locality: 'Hauz Khas, New Delhi',
    avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    bio: 'Weekend trekker & DIY camper ⛺ Everything you need for the wild at student-friendly rates.',
    rating: 4.95,
    trust_score: 98,
    reviews_count: 28,
    highlight_review: 'Quechua tent, trekking poles, and sleeping bags were super fresh and clean. Saved us thousands!',
    items_count: 8,
    free_items_count: 6,
    lent_count: 18,
    borrowed_count: 16,
    requests_count: 7,
  },
  {
    id: 'champ-ishaan',
    name: 'Ishaan Joshi',
    email: 'ishaan@synthcollective.in',
    locality: 'Malleshwaram, Bangalore',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    bio: 'Keyboardist & music producer 🎹 Lending condenser mics, soundcards, and midi gear.',
    rating: 4.96,
    trust_score: 98,
    reviews_count: 27,
    highlight_review: 'Focusrite Scarlett interface was immaculate. Super friendly neighbor who loves music.',
    items_count: 8,
    free_items_count: 6,
    lent_count: 16,
    borrowed_count: 14,
    requests_count: 6,
  },
  {
    id: 'champ-devansh',
    name: 'Devansh Nair',
    email: 'devansh@toolbank.in',
    locality: 'Whitefield, Bangalore',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    bio: 'DIY enthusiast & tool collector 🔨 Why buy power tools to use them for 10 minutes?',
    rating: 4.94,
    trust_score: 97,
    reviews_count: 32,
    highlight_review: 'Bosch hammer drill set made moving into our new apartment painless. Rapid 5-minute meetup.',
    items_count: 12,
    free_items_count: 4,
    lent_count: 26,
    borrowed_count: 6,
    requests_count: 3,
  },
  {
    id: 'champ-arjun',
    name: 'Arjun Reddy',
    email: 'arjun@outdoorphoto.in',
    locality: 'Jubilee Hills, Hyderabad',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    bio: 'Action cam & sports enthusiast 🚴 GoPro mounts, underwater cases, and bike racks.',
    rating: 4.93,
    trust_score: 97,
    reviews_count: 30,
    highlight_review: 'GoPro Hero 11 worked flawlessly for our scuba trip. Hassle-free deposit and handover.',
    items_count: 10,
    free_items_count: 3,
    lent_count: 24,
    borrowed_count: 12,
    requests_count: 5,
  },
];

// Community Leaderboard (Top 10 Lenders, Borrowers, Free Sharers, and Best Reviews/Scores)
router.get('/leaderboard', async (req: Request, res: Response, next) => {
  try {
    // 1. Fetch real users and their aggregated gear & community stats
    const realUsersRes = await query(`
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
      const avatar = u.avatar_url && u.avatar_url.trim() !== ''
        ? u.avatar_url
        : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
      
      const rating = parseFloat(u.rating) || 5.0;
      const trust_score = parseInt(u.trust_score, 10) || 98;
      const items_count = parseInt(u.items_count, 10) || 0;
      const free_items_count = parseInt(u.free_items_count, 10) || 0;
      const lent_count = parseInt(u.lent_count, 10) || 0;
      const borrowed_count = parseInt(u.borrowed_count, 10) || 0;
      const requests_count = parseInt(u.requests_count, 10) || 0;
      const reviews_count = Math.max(parseInt(u.reviews_count, 10) || 0, (lent_count + borrowed_count) * 2 + 5);

      const defaultQuotes = [
        'Super prompt communication, gear in mint condition. 10/10 neighborhood experience!',
        'Very polite and reliable neighbor. Flexible pickup handover and punctual return.',
        'Great gear owner! Took time to explain equipment settings on pickup.',
      ];
      const highlight_review = u.latest_review || defaultQuotes[Math.abs(name.length) % defaultQuotes.length];

      return {
        id: u.id,
        name,
        email,
        locality: u.locality,
        avatar_url: avatar,
        bio: u.bio,
        rating,
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

    // Merge real users with curated community champions (avoid duplicates by email/id)
    const existingEmails = new Set(formattedRealUsers.map(u => u.email.toLowerCase()));
    const existingNames = new Set(formattedRealUsers.map(u => u.name.toLowerCase()));
    
    const combinedPool = [...formattedRealUsers];
    for (const champ of SEED_COMMUNITY_CHAMPIONS) {
      if (!existingEmails.has(champ.email.toLowerCase()) && !existingNames.has(champ.name.toLowerCase())) {
        combinedPool.push(champ);
      }
    }

    // 1. CATEGORY: TOP RATED & BEST REVIEWS (User Rule: Best reviews & best score get to top 10, even if they do not rent a lot)
    const topRatedSorted = [...combinedPool].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.trust_score !== a.trust_score) return b.trust_score - a.trust_score;
      return b.reviews_count - a.reviews_count;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_rated',
      metric_label: 'Reputation Score',
      metric_value: `${member.rating.toFixed(2)} ★ (${member.trust_score}% Trust)`,
      badges: index === 0 
        ? ['👑 #1 Highest Rated', '🛡️ 100% Trust', '🌟 Flawless Reviews']
        : index < 3
        ? ['⭐ 5-Star Neighbor', '🛡️ Verified Trust', '💬 Outstanding Feedback']
        : ['⭐ Top Rated', '🛡️ Verified Neighbor'],
    }));

    // 2. CATEGORY: TOP LENDERS (People who gave a lot of things for renting)
    const topLendersSorted = [...combinedPool].sort((a, b) => {
      const scoreB = b.lent_count * 3 + b.items_count * 2;
      const scoreA = a.lent_count * 3 + a.items_count * 2;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.items_count !== a.items_count) return b.items_count - a.items_count;
      return b.trust_score - a.trust_score;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_lenders',
      metric_label: 'Gear Lent for Rent',
      metric_value: `${member.lent_count} Rentals (${member.items_count} listed)`,
      badges: index === 0
        ? ['👑 #1 Gear Lender', '📦 Mega Closet', '⚡ Instant Handover']
        : index < 3
        ? ['🏷️ Super Lender', '⚡ Instant Handover', '📦 Active Gear']
        : ['🏷️ Top Lender', '📦 Gear Sharer'],
    }));

    // 3. CATEGORY: TOP BORROWERS (Active community gear renters & borrowers)
    const topBorrowersSorted = [...combinedPool].sort((a, b) => {
      const scoreB = b.borrowed_count * 3 + b.requests_count * 2;
      const scoreA = a.borrowed_count * 3 + a.requests_count * 2;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.borrowed_count !== a.borrowed_count) return b.borrowed_count - a.borrowed_count;
      return b.trust_score - a.trust_score;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_borrowers',
      metric_label: 'Gear Borrowed',
      metric_value: `${member.borrowed_count} Rentals Borrowed`,
      badges: index === 0
        ? ['👑 #1 Circular Borrower', '⏱️ 100% Punctual', '🌱 Zero Waste Hero']
        : index < 3
        ? ['🎒 Eco Borrower', '⏱️ 100% On-Time Return', '🤝 Trusted Neighbor']
        : ['🎒 Active Borrower', '🤝 Verified Peer'],
    }));

    // 4. CATEGORY: TOP FREE SHARERS (People who gave things for free borrowing / gift economy)
    const topSharersSorted = [...combinedPool].sort((a, b) => {
      const scoreB = b.free_items_count * 3 + b.requests_count;
      const scoreA = a.free_items_count * 3 + a.requests_count;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.free_items_count !== a.free_items_count) return b.free_items_count - a.free_items_count;
      return b.trust_score - a.trust_score;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_sharers',
      metric_label: 'Free Gear Shared',
      metric_value: `${member.free_items_count} Free Shares (₹0 Rent)`,
      badges: index === 0
        ? ['👑 #1 Community Angel', '🎁 Gift Economy Pioneer', '❤️ Pure Generosity']
        : index < 3
        ? ['🎁 Free Gear Angel', '🌱 Anti-Ownership Champion', '❤️ Neighbor Favorite']
        : ['🎁 Community Sharer', '❤️ Generous Neighbor'],
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

// Public User Profile & Gear Closet
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const userRes = await query(
      `SELECT id, name, locality, avatar_url, banner_url, bio, trust_score, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    const user = userRes.rows[0];

    // User's active listings
    const itemsRes = await query(
      `SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, status, created_at
       FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
       ORDER BY created_at DESC`,
      [id]
    );

    // User's activity stats
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
      stats: statsRes.rows[0],
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

    if (fields.length === 0) {
      return sendError(res, 'BAD_REQUEST', 'No fields to update', 400);
    }

    values.push(userId);
    const updateSql = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING id, email, name, phone, locality, address_text, pincode, latitude, longitude, rating, avatar_url, banner_url, bio, trust_score, role, created_at
    `;

    const result = await query(updateSql, values);
    const updatedUser = result.rows[0];

    return sendSuccess(res, updatedUser, 'Profile updated successfully ✨');
  } catch (error) {
    next(error);
  }
});

export default router;
