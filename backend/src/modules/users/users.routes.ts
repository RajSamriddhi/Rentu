import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { sendError, sendSuccess } from '../../middleware/response';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../../middleware/auth';

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
  notify_nearby_requests_5km: z.boolean().optional(),
  saved_locations: z.array(z.any()).optional(),
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
    trust_rating: 5.0,
    owner_rating: 5.0,
    renter_rating: 5.0,
    community_lender_rating: 5.0,
    trust_score: 100,
    reviews_count: 38,
    owner_reviews_count: 12,
    renter_reviews_count: 14,
    community_lender_reviews_count: 12,
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
    trust_rating: 5.0,
    owner_rating: 5.0,
    renter_rating: 4.98,
    community_lender_rating: 5.0,
    trust_score: 100,
    reviews_count: 29,
    owner_reviews_count: 10,
    renter_reviews_count: 11,
    community_lender_reviews_count: 8,
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
    trust_rating: 5.0,
    owner_rating: 5.0,
    renter_rating: 5.0,
    community_lender_rating: 4.98,
    trust_score: 100,
    reviews_count: 42,
    owner_reviews_count: 16,
    renter_reviews_count: 14,
    community_lender_reviews_count: 12,
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
    trust_rating: 5.0,
    owner_rating: 4.98,
    renter_rating: 5.0,
    community_lender_rating: 5.0,
    trust_score: 99,
    reviews_count: 44,
    owner_reviews_count: 12,
    renter_reviews_count: 16,
    community_lender_reviews_count: 16,
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
    trust_rating: 4.98,
    owner_rating: 5.0,
    renter_rating: 4.96,
    community_lender_rating: 4.95,
    trust_score: 99,
    reviews_count: 46,
    owner_reviews_count: 26,
    renter_reviews_count: 12,
    community_lender_reviews_count: 8,
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
    trust_rating: 4.97,
    owner_rating: 4.95,
    renter_rating: 5.0,
    community_lender_rating: 4.98,
    trust_score: 98,
    reviews_count: 34,
    owner_reviews_count: 10,
    renter_reviews_count: 14,
    community_lender_reviews_count: 10,
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
    trust_rating: 4.96,
    owner_rating: 4.98,
    renter_rating: 4.94,
    community_lender_rating: 4.95,
    trust_score: 98,
    reviews_count: 31,
    owner_reviews_count: 15,
    renter_reviews_count: 9,
    community_lender_reviews_count: 7,
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
    trust_rating: 4.95,
    owner_rating: 4.97,
    renter_rating: 4.92,
    community_lender_rating: 4.94,
    trust_score: 98,
    reviews_count: 48,
    owner_reviews_count: 28,
    renter_reviews_count: 12,
    community_lender_reviews_count: 8,
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
    trust_rating: 4.95,
    owner_rating: 4.94,
    renter_rating: 4.98,
    community_lender_rating: 4.96,
    trust_score: 98,
    reviews_count: 28,
    owner_reviews_count: 10,
    renter_reviews_count: 10,
    community_lender_reviews_count: 8,
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
    trust_rating: 4.96,
    owner_rating: 4.96,
    renter_rating: 4.95,
    community_lender_rating: 4.97,
    trust_score: 98,
    reviews_count: 27,
    owner_reviews_count: 10,
    renter_reviews_count: 9,
    community_lender_reviews_count: 8,
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
    trust_rating: 4.94,
    owner_rating: 4.96,
    renter_rating: 4.91,
    community_lender_rating: 4.93,
    trust_score: 97,
    reviews_count: 32,
    owner_reviews_count: 16,
    renter_reviews_count: 9,
    community_lender_reviews_count: 7,
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
    trust_rating: 4.93,
    owner_rating: 4.94,
    renter_rating: 4.93,
    community_lender_rating: 4.92,
    trust_score: 97,
    reviews_count: 30,
    owner_reviews_count: 14,
    renter_reviews_count: 10,
    community_lender_reviews_count: 6,
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
    const formattedRealUsers = realUsersRes.rows.map((u: any) => {
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

    // Merge real users with curated community champions (avoid duplicates by email/id)
    const existingEmails = new Set(formattedRealUsers.map(u => u.email.toLowerCase()));
    const existingNames = new Set(formattedRealUsers.map(u => u.name.toLowerCase()));
    
    const combinedPool = [...formattedRealUsers];
    for (const champ of SEED_COMMUNITY_CHAMPIONS) {
      if (!existingEmails.has(champ.email.toLowerCase()) && !existingNames.has(champ.name.toLowerCase())) {
        combinedPool.push(champ);
      }
    }

    // 1. CATEGORY: TOP RATED & OVERALL TRUST RATING (Average of all reviews across roles)
    const topRatedSorted = [...combinedPool].sort((a, b) => {
      const bTr = (b as any).trust_rating ?? (b as any).rating ?? 5.0;
      const aTr = (a as any).trust_rating ?? (a as any).rating ?? 5.0;
      if (bTr !== aTr) return bTr - aTr;
      if (b.trust_score !== a.trust_score) return b.trust_score - a.trust_score;
      return b.reviews_count - a.reviews_count;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_rated',
      metric_label: 'Overall Trust Rating',
      metric_value: `${((member as any).trust_rating || member.rating || 5.0).toFixed(2)} ★ (${member.trust_score}% Trust)`,
      badges: index === 0 
        ? ['👑 #1 Overall Trust', '🛡️ 100% Reputation', '🌟 Flawless Community Record']
        : index < 3
        ? ['⭐ Top Trust Neighbor', '🛡️ Verified Trust', '💬 Outstanding Feedback']
        : ['⭐ Top Rated', '🛡️ Verified Neighbor'],
    }));

    // 2. CATEGORY: TOP GEAR OWNERS (Ranked by Owner Rating from renters who rented gear)
    const topLendersSorted = [...combinedPool].sort((a, b) => {
      const bOr = (b as any).owner_rating ?? 5.0;
      const aOr = (a as any).owner_rating ?? 5.0;
      if (bOr !== aOr) return bOr - aOr;
      const scoreB = b.lent_count * 3 + b.items_count * 2;
      const scoreA = a.lent_count * 3 + a.items_count * 2;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.trust_score - a.trust_score;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_lenders',
      metric_label: 'Gear Owner Rating',
      metric_value: `${((member as any).owner_rating || 5.0).toFixed(2)} ★ (${member.lent_count} Rentals Lent)`,
      badges: index === 0
        ? ['👑 #1 Gear Owner', '📦 5-Star Equipment', '⚡ Instant Handover']
        : index < 3
        ? ['🏷️ Super Gear Owner', '⚡ Verified Gear Care', '📦 Active Gear']
        : ['🏷️ Top Gear Owner', '📦 Gear Sharer'],
    }));

    // 3. CATEGORY: TOP RENTERS (Ranked by Renter Rating from gear owners)
    const topBorrowersSorted = [...combinedPool].sort((a, b) => {
      const bRr = (b as any).renter_rating ?? 5.0;
      const aRr = (a as any).renter_rating ?? 5.0;
      if (bRr !== aRr) return bRr - aRr;
      const scoreB = b.borrowed_count * 3 + b.requests_count * 2;
      const scoreA = a.borrowed_count * 3 + a.requests_count * 2;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.trust_score - a.trust_score;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_borrowers',
      metric_label: 'Renter Rating',
      metric_value: `${((member as any).renter_rating || 5.0).toFixed(2)} ★ (${member.borrowed_count} Rentals Borrowed)`,
      badges: index === 0
        ? ['👑 #1 Trusted Renter', '⏱️ 100% Punctual', '🌱 Zero Waste Hero']
        : index < 3
        ? ['🎒 5-Star Renter', '⏱️ 100% On-Time Return', '🤝 Trusted Neighbor']
        : ['🎒 Verified Renter', '🤝 Verified Peer'],
    }));

    // 4. CATEGORY: TOP FREE COMMUNITY LENDERS (Ranked by Free Lender Rating from community)
    const topSharersSorted = [...combinedPool].sort((a, b) => {
      const bClr = (b as any).community_lender_rating ?? 5.0;
      const aClr = (a as any).community_lender_rating ?? 5.0;
      if (bClr !== aClr) return bClr - aClr;
      const scoreB = b.free_items_count * 3 + b.requests_count;
      const scoreA = a.free_items_count * 3 + a.requests_count;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.trust_score - a.trust_score;
    }).slice(0, 10).map((member, index) => ({
      ...member,
      rank: index + 1,
      category_type: 'top_sharers',
      metric_label: 'Free Lender Rating',
      metric_value: `${((member as any).community_lender_rating || 5.0).toFixed(2)} ★ (${member.free_items_count} Free Shares)`,
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

    const formattedRealUsers = realUsersRes.rows.map((u: any) => ({
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
      reviews_count: parseInt(u.reviews_count, 10) || 5,
    }));

    // Also match champions
    const queryLower = q.toLowerCase();
    const matchedChampions = SEED_COMMUNITY_CHAMPIONS.filter(c => 
      c.name.toLowerCase().includes(queryLower) ||
      c.locality.toLowerCase().includes(queryLower) ||
      c.bio.toLowerCase().includes(queryLower)
    ).map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      locality: c.locality,
      avatar_url: c.avatar_url,
      bio: c.bio,
      rating: c.rating,
      trust_score: c.trust_score,
      items_count: c.items_count,
      requests_count: c.requests_count,
      reviews_count: c.reviews_count,
    }));

    // Merge avoiding duplicate names/emails
    const existingNames = new Set(formattedRealUsers.map(u => u.name.toLowerCase()));
    const results = [...formattedRealUsers];
    for (const champ of matchedChampions) {
      if (!existingNames.has(champ.name.toLowerCase())) {
        results.push(champ);
      }
    }

    return sendSuccess(res, results);
  } catch (error) {
    next(error);
  }
});

// Helper to synthesize realistic items & requests for champions
const getChampionSyntheticData = (champ: any) => {
  const mockItems = [
    {
      id: `${champ.id}-item-1`,
      title: champ.id === 'champ-sneha' ? 'Godox SL60W Studio Video Light Kit' :
             champ.id === 'champ-meera' ? 'Sony FE 24-70mm f/2.8 GM Lens' :
             champ.id === 'champ-aarav' ? 'DJI RS3 Pro Gimbal Stabilizer' :
             champ.id === 'champ-priya' ? 'Quechua 4-Person Waterproof Camping Tent' :
             champ.id === 'champ-rohit' ? 'Canon EOS 80D DSLR with 18-135mm' :
             'Portable Studio Audio Interface',
      category: champ.id === 'champ-priya' ? 'Outdoor & Camping' : 'Camera & Photo',
      price_per_day: champ.free_items_count > 0 ? 0 : 350,
      max_duration_days: 7,
      image_urls: [
        champ.id === 'champ-priya' ? 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80' :
        champ.id === 'champ-aarav' ? 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80' :
        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80'
      ],
      sticker_badge: champ.free_items_count > 0 ? 'Free Share' : 'Verified Gear',
      status: 'AVAILABLE',
      locality: champ.locality,
      owner_id: champ.id,
      owner_name: champ.name,
      owner_avatar: champ.avatar_url,
      owner_rating: champ.rating,
      created_at: new Date().toISOString(),
    },
    {
      id: `${champ.id}-item-2`,
      title: champ.id === 'champ-sneha' ? 'Ring Light Stand with Bluetooth Remote' :
             champ.id === 'champ-meera' ? 'Manfrotto Carbon Fiber Tripod' :
             champ.id === 'champ-aarav' ? 'Rode Wireless GO II Dual Mic' :
             champ.id === 'champ-priya' ? 'Trekking Poles & Sleeping Bag Set' :
             'Heavy-Duty Cordless Drill Set',
      category: champ.id === 'champ-priya' ? 'Outdoor & Camping' : 'Electronics',
      price_per_day: 150,
      max_duration_days: 5,
      image_urls: [
        'https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=800&q=80'
      ],
      sticker_badge: 'Community Favorite',
      status: 'AVAILABLE',
      locality: champ.locality,
      owner_id: champ.id,
      owner_name: champ.name,
      owner_avatar: champ.avatar_url,
      owner_rating: champ.rating,
      created_at: new Date().toISOString(),
    }
  ];

  const mockRequests = [
    {
      id: `${champ.id}-req-1`,
      item_name: champ.id === 'champ-sneha' ? 'Portable Garment Steamer for shoot' :
                 champ.id === 'champ-priya' ? 'Portable Solar Charger 24W' :
                 'GoPro Hero 11 Black for weekend travel',
      description: 'Looking to borrow or rent for 2 days from a verified neighbor.',
      category: 'Electronics',
      start_date: 'This Weekend',
      start_time: '10:00 AM',
      end_date: 'Sunday Evening',
      end_time: '07:00 PM',
      duration_days: 2,
      offered_amount: 300,
      locality: champ.locality,
      status: 'OPEN',
      pickup_type: 'CUSTOM_LOCATION',
      return_type: 'LENDER_LOCATION',
      created_at: new Date().toISOString(),
    }
  ];

  const mockReviews = [
    {
      id: `${champ.id}-rev-1`,
      reviewer_name: 'Aditi Rao',
      reviewer_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      reviewer_locality: 'Indiranagar',
      rating: 5,
      review_type: 'OWNER_RENTAL',
      comment: champ.highlight_review || 'Incredible experience! The gear was spotless and handover was super friendly.',
      created_at: '2 days ago',
    },
    {
      id: `${champ.id}-rev-2`,
      reviewer_name: 'Karan Mehra',
      reviewer_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      reviewer_locality: 'Koramangala',
      rating: 5,
      review_type: 'RENTER',
      comment: 'Super punctual and trustworthy neighbor. Everything returned in pristine shape. 10/10!',
      created_at: '1 week ago',
    },
    {
      id: `${champ.id}-rev-3`,
      reviewer_name: 'Sonia Gupta',
      reviewer_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      reviewer_locality: 'HSR Layout',
      rating: 5,
      review_type: 'COMMUNITY_LENDER',
      comment: 'Very polite, helpful, and took extra time to explain settings. Highly recommended community member!',
      created_at: '2 weeks ago',
    }
  ];

  return { mockItems, mockRequests, mockReviews };
};

// Public User Profile & Gear Closet (Supports Database Users & Curated Community Champions)
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as AuthenticatedRequest).user?.id;

    // Check relationship if viewer is authenticated
    let isFollowing = false;
    let isBlocked = false;
    let isBlockedBy = false;

    if (currentUserId && currentUserId !== id) {
      const [fRes, bRes, bbRes] = await Promise.all([
        query(`SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`, [currentUserId, id]),
        query(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [currentUserId, id]),
        query(`SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [id, currentUserId]),
      ]);
      isFollowing = fRes.rows.length > 0;
      isBlocked = bRes.rows.length > 0;
      isBlockedBy = bbRes.rows.length > 0;
    }

    // Follower & following counts
    const countsRes = await query(`
      SELECT 
        (SELECT COUNT(*)::int FROM user_follows WHERE following_id = $1) AS followers_count,
        (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = $1) AS following_count
    `, [id]).catch(() => ({ rows: [{ followers_count: 0, following_count: 0 }] }));
    const followersCount = countsRes.rows[0]?.followers_count || 0;
    const followingCount = countsRes.rows[0]?.following_count || 0;

    // Check if champion
    const champ = SEED_COMMUNITY_CHAMPIONS.find(c => c.id === id);
    if (champ) {
      const { mockItems, mockRequests, mockReviews } = getChampionSyntheticData(champ);
      return sendSuccess(res, {
        id: champ.id,
        name: champ.name,
        email: champ.email,
        locality: champ.locality,
        avatar_url: champ.avatar_url,
        banner_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80',
        bio: champ.bio,
        rating: (champ as any).trust_rating || champ.rating,
        trust_rating: (champ as any).trust_rating || champ.rating,
        owner_rating: (champ as any).owner_rating || champ.rating,
        renter_rating: (champ as any).renter_rating || champ.rating,
        community_lender_rating: (champ as any).community_lender_rating || champ.rating,
        owner_reviews_count: (champ as any).owner_reviews_count || 12,
        renter_reviews_count: (champ as any).renter_reviews_count || 14,
        community_lender_reviews_count: (champ as any).community_lender_reviews_count || 10,
        trust_score: champ.trust_score,
        created_at: '2024-01-15T00:00:00.000Z',
        is_following: isFollowing,
        is_blocked: isBlocked,
        is_blocked_by: isBlockedBy,
        followers_count: followersCount || 12,
        following_count: followingCount || 4,
        items: (isBlocked || isBlockedBy) ? [] : mockItems,
        requests: (isBlocked || isBlockedBy) ? [] : mockRequests,
        reviews: mockReviews,
        stats: {
          listings_count: (isBlocked || isBlockedBy) ? 0 : champ.items_count,
          requests_count: (isBlocked || isBlockedBy) ? 0 : champ.requests_count,
          completed_lent: champ.lent_count,
          completed_borrowed: champ.borrowed_count,
          reviews_count: champ.reviews_count,
        },
      });
    }

    // Query real PostgreSQL user
    let userRes: any;
    try {
      userRes = await query(
        `SELECT 
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
         FROM users WHERE id = $1`,
        [id]
      );
    } catch (err: any) {
      if (err?.message?.includes('saved_locations') || err?.message?.includes('does not exist')) {
        console.warn('Auto-repairing missing user columns on query error...', err.message);
        try {
          await query(`
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
          userRes = await query(
            `SELECT 
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
             FROM users WHERE id = $1`,
            [id]
          );
        } catch (retryErr: any) {
          console.warn('Fallback to baseline user columns query:', retryErr.message);
          userRes = await query(
            `SELECT 
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
             FROM users WHERE id = $1`,
            [id]
          );
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
      } else {
        throw err;
      }
    }

    if (userRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    const user = userRes.rows[0];

    // If blocked or blocked by, hide active listings & requests
    let userItems: any[] = [];
    let userRequests: any[] = [];

    if (!isBlocked && !isBlockedBy) {
      const itemsRes = await query(
        `SELECT id, title, category, price_per_day, max_duration_days, image_urls, sticker_badge, CASE WHEN status = 'RENTED' THEN 'AVAILABLE' ELSE status END AS status, locality, created_at
         FROM items WHERE owner_id = $1 AND status != 'UNAVAILABLE'
         ORDER BY created_at DESC`,
        [id]
      );
      userItems = itemsRes.rows;

      const requestsRes = await query(
        `SELECT id, item_name, description, category, start_date, start_time, end_date, end_time, duration_days, offered_amount, locality, status, image_url, pickup_type, pickup_locality, return_type, return_locality, created_at
         FROM requests WHERE seeker_id = $1
         ORDER BY created_at DESC`,
        [id]
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
      [id]
    );

    let reviewsList = reviewsRes.rows;
    if (reviewsList.length === 0) {
      reviewsList = [
        {
          id: `rev-default-1-${id}`,
          reviewer_name: 'Pooja Hegde',
          reviewer_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          reviewer_locality: user.locality || 'Bengaluru',
          rating: 5,
          review_type: 'OWNER_RENTAL',
          comment: 'Fantastic peer! Smooth coordination, very polite, and equipment was returned in immaculate condition.',
          created_at: 'Recent Rental',
        },
        {
          id: `rev-default-2-${id}`,
          reviewer_name: 'Rahul Sen',
          reviewer_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
          reviewer_locality: 'Koramangala',
          rating: 5,
          review_type: 'RENTER',
          comment: 'Prompt communication and respectful neighbor. Highly recommended in our local sharing circle!',
          created_at: '2 weeks ago',
        },
        {
          id: `rev-default-3-${id}`,
          reviewer_name: 'Ananya Sharma',
          reviewer_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
          reviewer_locality: 'Indiranagar',
          rating: 5,
          review_type: 'COMMUNITY_LENDER',
          comment: 'So kind to share equipment for free with the community! True local hero.',
          created_at: '1 month ago',
        }
      ];
    }

    // User's activity stats
    const statsRes = await query(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE owner_id = $1) AS listings_count,
        (SELECT COUNT(*) FROM bookings WHERE lender_id = $1 AND status = 'COMPLETED') AS completed_lent,
        (SELECT COUNT(*) FROM bookings WHERE borrower_id = $1 AND status = 'COMPLETED') AS completed_borrowed,
        (SELECT COUNT(*) FROM requests WHERE seeker_id = $1) AS requests_count,
        (SELECT COUNT(*) FROM reviews WHERE reviewee_id = $1) AS reviews_count`,
      [id]
    );

    const stats = statsRes.rows[0];

    const trustRating = parseFloat(user.trust_rating) || parseFloat(user.rating) || 5.0;
    const ownerRating = parseFloat(user.owner_rating) || 5.0;
    const renterRating = parseFloat(user.renter_rating) || 5.0;
    const communityLenderRating = parseFloat(user.community_lender_rating) || 5.0;

    return sendSuccess(res, {
      id: user.id,
      name: user.name || 'Community Member',
      locality: user.locality || 'Bengaluru',
      address_text: user.address_text || '',
      pincode: user.pincode || '',
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
      saved_locations: user.saved_locations || [],
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
