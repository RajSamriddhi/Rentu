import { query } from '../../config/db';
import { extractCity } from '../../utils/city';

export interface SearchListingsParams {
  query?: string;
  category?: string;
  max_price?: number;
  min_price?: number;
  free_only?: boolean;
  locality?: string;
  status?: string;
  limit?: number;
}

export interface CheckAvailabilityParams {
  item_id: string;
  start_date: string;
  duration_days: number;
}

export interface ComparePricesParams {
  item_ids?: string[];
  category?: string;
  query?: string;
  duration_days?: number;
}

export interface FindAlternativesParams {
  item_id?: string;
  category?: string;
  max_price?: number;
  locality?: string;
  duration_days?: number;
}

/**
 * Normalizes item row from database for clean API & UI consumption
 */
export function formatItemRow(row: any) {
  let images: string[] = [];
  if (Array.isArray(row.image_urls)) {
    images = row.image_urls;
  } else if (typeof row.image_urls === 'string') {
    try {
      images = JSON.parse(row.image_urls);
    } catch {
      images = [row.image_urls];
    }
  }

  return {
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name || 'Community Member',
    owner_avatar: row.owner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.owner_name || 'Owner')}&background=0F172A&color=fff&bold=true`,
    owner_rating: row.owner_rating ? Number(row.owner_rating) : 5.0,
    owner_trust_score: row.owner_trust_score ?? 98,
    owner_locality: row.owner_locality || row.locality || '',
    title: row.title,
    description: row.description || '',
    category: row.category,
    price_per_day: Number(row.price_per_day || 0),
    max_duration_days: Number(row.max_duration_days || 3),
    image_urls: images,
    sticker_badge: row.sticker_badge || '✨ Available',
    locality: row.locality || '',
    address_text: row.address_text || '',
    pincode: row.pincode || '',
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    status: row.status || 'AVAILABLE',
    created_at: row.created_at,
  };
}

/**
 * Tool A — Search Listings in real database
 */
export async function searchListings(params: SearchListingsParams) {
  const {
    query: searchKeyword,
    category,
    max_price,
    min_price,
    free_only,
    locality,
    status = 'AVAILABLE',
    limit = 6,
  } = params;

  const sqlParams: any[] = [];
  let sql = `
    SELECT 
      i.id, i.title, i.description, i.category, i.price_per_day,
      i.max_duration_days, i.image_urls, i.sticker_badge, i.locality,
      i.address_text, i.pincode, i.latitude, i.longitude, i.status, i.created_at,
      u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
      u.rating AS owner_rating, u.trust_score AS owner_trust_score,
      u.locality AS owner_locality
    FROM items i
    LEFT JOIN users u ON i.owner_id = u.id
    WHERE 1=1
  `;

  if (status && status !== 'ALL') {
    sqlParams.push(status);
    sql += ` AND i.status = $${sqlParams.length}`;
  }

  if (free_only) {
    sql += ` AND i.price_per_day = 0`;
  } else {
    if (typeof max_price === 'number' && !isNaN(max_price)) {
      sqlParams.push(max_price);
      sql += ` AND i.price_per_day <= $${sqlParams.length}`;
    }
    if (typeof min_price === 'number' && !isNaN(min_price)) {
      sqlParams.push(min_price);
      sql += ` AND i.price_per_day >= $${sqlParams.length}`;
    }
  }

  if (category && category !== 'All') {
    sqlParams.push(category);
    sql += ` AND i.category ILIKE $${sqlParams.length}`;
  }

  if (locality) {
    const city = extractCity(String(locality)) || String(locality).trim();
    if (city) {
      sqlParams.push(`%${city}%`);
      sql += ` AND (i.locality ILIKE $${sqlParams.length} OR u.locality ILIKE $${sqlParams.length})`;
    }
  }

  if (searchKeyword && searchKeyword.trim().length > 0) {
    const words = searchKeyword.trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const orClauses: string[] = [];
      for (const w of words) {
        sqlParams.push(`%${w}%`);
        const idx = sqlParams.length;
        orClauses.push(`(i.title ILIKE $${idx} OR i.description ILIKE $${idx} OR i.category ILIKE $${idx})`);
      }
      sql += ` AND (${orClauses.join(' OR ')})`;
    }
  }

  sql += ` ORDER BY i.price_per_day ASC, i.created_at DESC`;

  const safeLimit = Math.min(Math.max(1, limit || 6), 20);
  sqlParams.push(safeLimit);
  sql += ` LIMIT $${sqlParams.length}`;

  const res = await query(sql, sqlParams);
  const items = res.rows.map(formatItemRow);

  return {
    count: items.length,
    items,
  };
}

/**
 * Tool B — Price Comparison
 */
export async function comparePrices(params: ComparePricesParams) {
  const duration = Math.max(1, Math.floor(params.duration_days || 1));
  let itemsToCompare: any[] = [];

  if (params.item_ids && params.item_ids.length > 0) {
    const validUuids = params.item_ids.filter(id => /^[0-9a-fA-F-]{36}$/.test(id));
    if (validUuids.length > 0) {
      const placeholders = validUuids.map((_, i) => `$${i + 1}`).join(',');
      const res = await query(`
        SELECT 
          i.id, i.title, i.description, i.category, i.price_per_day,
          i.max_duration_days, i.image_urls, i.sticker_badge, i.locality,
          i.status, i.created_at,
          u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
          u.rating AS owner_rating
        FROM items i
        LEFT JOIN users u ON i.owner_id = u.id
        WHERE i.id IN (${placeholders})
      `, validUuids);
      itemsToCompare = res.rows.map(formatItemRow);
    }
  }

  if (itemsToCompare.length < 2) {
    const searchRes = await searchListings({
      category: params.category,
      query: params.query,
      limit: 4,
    });
    itemsToCompare = searchRes.items;
  }

  if (itemsToCompare.length === 0) {
    return {
      comparison: [],
      message: 'No items found to compare.',
    };
  }

  // Calculate pricing breakdown
  const comparison = itemsToCompare.map(item => {
    const dailyRate = Number(item.price_per_day);
    const estimatedTotal = dailyRate * duration;
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      locality: item.locality,
      price_per_day: dailyRate,
      duration_days: duration,
      estimated_total: estimatedTotal,
      max_duration_days: item.max_duration_days,
      image_urls: item.image_urls,
      status: item.status,
    };
  });

  // Sort cheapest first
  comparison.sort((a, b) => a.estimated_total - b.estimated_total);

  const cheapest = comparison[0];
  const mostExpensive = comparison[comparison.length - 1];
  const totalSavings = mostExpensive.estimated_total - cheapest.estimated_total;
  const dailySavings = mostExpensive.price_per_day - cheapest.price_per_day;

  return {
    duration_days: duration,
    comparison,
    summary: {
      cheapest_item: cheapest.title,
      cheapest_daily_rate: cheapest.price_per_day,
      cheapest_total: cheapest.estimated_total,
      potential_daily_savings: dailySavings > 0 ? dailySavings : 0,
      potential_total_savings: totalSavings > 0 ? totalSavings : 0,
      pricing_note: 'Estimates are based on owner daily rates. Rentu does not charge platform processing or booking fees.',
    },
  };
}

/**
 * Tool C — Availability Checker with Date Conflict Verification
 */
export async function checkAvailability(params: CheckAvailabilityParams) {
  const { item_id, start_date, duration_days } = params;

  if (!item_id || !/^[0-9a-fA-F-]{36}$/.test(item_id)) {
    return {
      available: false,
      error: 'Invalid item ID format (UUID required)',
    };
  }

  const duration = Math.max(1, Math.floor(duration_days || 1));
  const parsedStartDate = new Date(start_date);

  if (isNaN(parsedStartDate.getTime())) {
    return {
      available: false,
      error: 'Invalid start date format. Please use YYYY-MM-DD.',
    };
  }

  // Check item existence and base status
  const itemRes = await query(`
    SELECT id, title, price_per_day, max_duration_days, status, locality
    FROM items
    WHERE id = $1
  `, [item_id]);

  if (itemRes.rows.length === 0) {
    return {
      available: false,
      error: 'Item not found in marketplace catalog.',
    };
  }

  const item = itemRes.rows[0];

  if (item.status === 'UNAVAILABLE') {
    return {
      available: false,
      item_id: item.id,
      item_title: item.title,
      status: item.status,
      reason: `Listing "${item.title}" is currently marked UNAVAILABLE by the owner.`,
    };
  }

  if (duration > item.max_duration_days) {
    return {
      available: false,
      item_id: item.id,
      item_title: item.title,
      max_duration_days: item.max_duration_days,
      requested_duration: duration,
      reason: `Requested duration (${duration} days) exceeds the owner's maximum allowed rental period (${item.max_duration_days} days).`,
    };
  }

  // Check booking date overlap
  // Overlap condition: start_date < existing_end_date AND requested_end_date > existing_start_date
  const conflictRes = await query(`
    SELECT 
      b.id, b.start_date, b.duration_days, b.status,
      (b.start_date + (b.duration_days || ' days')::interval)::date AS end_date
    FROM bookings b
    WHERE b.item_id = $1
      AND b.status IN ('ACCEPTED', 'PENDING')
      AND (
        b.start_date < ($2::date + ($3 || ' days')::interval)
        AND
        (b.start_date + (b.duration_days || ' days')::interval) > $2::date
      )
  `, [item_id, start_date, duration]);

  const requestedEndDate = new Date(parsedStartDate);
  requestedEndDate.setDate(requestedEndDate.getDate() + duration);
  const formattedEndDate = requestedEndDate.toISOString().split('T')[0];

  if (conflictRes.rows.length > 0) {
    const conflict = conflictRes.rows[0];
    const conflictStart = new Date(conflict.start_date).toISOString().split('T')[0];
    const conflictEnd = new Date(conflict.end_date).toISOString().split('T')[0];

    return {
      available: false,
      item_id: item.id,
      item_title: item.title,
      requested_dates: {
        start_date,
        duration_days: duration,
        end_date: formattedEndDate,
      },
      conflict: {
        booking_status: conflict.status,
        conflict_start: conflictStart,
        conflict_end: conflictEnd,
      },
      reason: `"${item.title}" is already reserved from ${conflictStart} to ${conflictEnd} (${conflict.status.toLowerCase()}).`,
    };
  }

  const estimatedTotal = Number(item.price_per_day) * duration;

  return {
    available: true,
    item_id: item.id,
    item_title: item.title,
    locality: item.locality,
    price_per_day: Number(item.price_per_day),
    duration_days: duration,
    estimated_total: estimatedTotal,
    requested_dates: {
      start_date,
      duration_days: duration,
      end_date: formattedEndDate,
    },
    message: `"${item.title}" is available for your dates (${start_date} to ${formattedEndDate})! Estimated rental cost is ₹${estimatedTotal}.`,
  };
}

/**
 * Tool D — Listing Details
 */
export async function getListingDetails(itemId: string) {
  if (!itemId || !/^[0-9a-fA-F-]{36}$/.test(itemId)) {
    return { error: 'Invalid item ID' };
  }

  const res = await query(`
    SELECT 
      i.id, i.title, i.description, i.category, i.price_per_day,
      i.max_duration_days, i.image_urls, i.sticker_badge, i.locality,
      i.address_text, i.pincode, i.latitude, i.longitude, i.status, i.created_at,
      u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
      u.rating AS owner_rating, u.trust_score AS owner_trust_score,
      u.locality AS owner_locality, u.bio AS owner_bio
    FROM items i
    LEFT JOIN users u ON i.owner_id = u.id
    WHERE i.id = $1
  `, [itemId]);

  if (res.rows.length === 0) {
    return { error: 'Listing not found' };
  }

  return { item: formatItemRow(res.rows[0]) };
}

/**
 * Tool E — Context-Aware Alternatives (Cheaper options)
 */
export async function findAlternatives(params: FindAlternativesParams) {
  let targetCategory = params.category;
  let targetPrice = params.max_price;
  let referenceItem: any = null;

  if (params.item_id && /^[0-9a-fA-F-]{36}$/.test(params.item_id)) {
    const refRes = await query(`
      SELECT id, title, category, price_per_day, locality
      FROM items
      WHERE id = $1
    `, [params.item_id]);

    if (refRes.rows.length > 0) {
      referenceItem = refRes.rows[0];
      targetCategory = referenceItem.category;
      targetPrice = targetPrice ? Math.min(targetPrice, Number(referenceItem.price_per_day)) : Number(referenceItem.price_per_day);
    }
  }

  const sqlParams: any[] = [];
  let sql = `
    SELECT 
      i.id, i.title, i.description, i.category, i.price_per_day,
      i.max_duration_days, i.image_urls, i.sticker_badge, i.locality,
      i.status, i.created_at,
      u.id AS owner_id, u.name AS owner_name, u.avatar_url AS owner_avatar,
      u.rating AS owner_rating, u.trust_score AS owner_trust_score
    FROM items i
    LEFT JOIN users u ON i.owner_id = u.id
    WHERE i.status = 'AVAILABLE'
  `;

  if (referenceItem) {
    sqlParams.push(referenceItem.id);
    sql += ` AND i.id != $${sqlParams.length}`;
  }

  if (targetCategory) {
    sqlParams.push(targetCategory);
    sql += ` AND i.category ILIKE $${sqlParams.length}`;
  }

  if (typeof targetPrice === 'number' && !isNaN(targetPrice)) {
    sqlParams.push(targetPrice);
    sql += ` AND i.price_per_day <= $${sqlParams.length}`;
  }

  if (params.locality) {
    const city = extractCity(String(params.locality)) || String(params.locality).trim();
    if (city) {
      sqlParams.push(`%${city}%`);
      sql += ` AND (i.locality ILIKE $${sqlParams.length} OR u.locality ILIKE $${sqlParams.length})`;
    }
  }

  sql += ` ORDER BY i.price_per_day ASC, i.created_at DESC LIMIT 5`;

  const res = await query(sql, sqlParams);
  const items = res.rows.map(formatItemRow);

  const duration = Math.max(1, params.duration_days || 1);

  const alternatives = items.map(item => {
    const dailyPrice = item.price_per_day;
    const estTotal = dailyPrice * duration;
    let savingsPerDay: number | null = null;
    let savingsTotal: number | null = null;
    let savingsPercent: number | null = null;

    if (referenceItem) {
      const refDaily = Number(referenceItem.price_per_day);
      if (refDaily > dailyPrice) {
        savingsPerDay = refDaily - dailyPrice;
        savingsTotal = savingsPerDay * duration;
        savingsPercent = Math.round((savingsPerDay / refDaily) * 100);
      }
    }

    return {
      ...item,
      duration_days: duration,
      estimated_total: estTotal,
      savings_per_day: savingsPerDay,
      savings_total: savingsTotal,
      savings_percentage: savingsPercent,
    };
  });

  return {
    reference_item: referenceItem ? {
      id: referenceItem.id,
      title: referenceItem.title,
      price_per_day: Number(referenceItem.price_per_day),
    } : null,
    alternatives,
  };
}

/**
 * Gemini Tool Definitions (Function Declarations)
 */
export const geminiToolDeclarations = [
  {
    name: 'search_listings',
    description: 'Search available rental equipment and gear in the real Rentu marketplace database by keyword, category, locality, or maximum daily price.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search keywords such as "camera", "dslr", "tent", "projector", "laptop", "drill", "bike".' },
        category: { type: 'STRING', description: 'Specific category such as "Electronics & Tech", "Camping & Outdoor", "Tools & DIY", "Party & Events".' },
        max_price: { type: 'NUMBER', description: 'Maximum price per day in Indian Rupees (INR ₹).' },
        locality: { type: 'STRING', description: 'Locality or city such as "Bengaluru", "Indiranagar", "Mylasandra", "Saket", "Mumbai".' },
        free_only: { type: 'BOOLEAN', description: 'True to filter for free items if any (price_per_day = 0).' }
      }
    }
  },
  {
    name: 'compare_prices',
    description: 'Compare daily rental rates and calculate total estimated costs across multiple listings for a given rental duration.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_ids: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Array of item UUIDs to compare.'
        },
        category: { type: 'STRING', description: 'Category to compare items within.' },
        query: { type: 'STRING', description: 'Search term for items to compare.' },
        duration_days: { type: 'INTEGER', description: 'Rental duration in days.' }
      }
    }
  },
  {
    name: 'check_availability',
    description: 'Check whether a specific listing is actually available for requested rental dates, inspecting real booking date-range overlaps.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_id: { type: 'STRING', description: 'The UUID of the item to check.' },
        start_date: { type: 'STRING', description: 'Requested start date in YYYY-MM-DD format.' },
        duration_days: { type: 'INTEGER', description: 'Number of rental days requested.' }
      },
      required: ['item_id', 'start_date', 'duration_days']
    }
  },
  {
    name: 'find_alternatives',
    description: 'Find cheaper alternative listings in the same category and calculate potential savings for the user.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_id: { type: 'STRING', description: 'Reference item UUID to beat in price.' },
        category: { type: 'STRING', description: 'Category to search alternatives in.' },
        max_price: { type: 'NUMBER', description: 'Maximum price cap.' },
        locality: { type: 'STRING', description: 'Target locality or city.' },
        duration_days: { type: 'INTEGER', description: 'Duration in days to calculate total savings.' }
      }
    }
  },
  {
    name: 'get_listing_details',
    description: 'Get verified details for a single listing including owner rating, description, and daily price.',
    parameters: {
      type: 'OBJECT',
      properties: {
        item_id: { type: 'STRING', description: 'UUID of the item.' }
      },
      required: ['item_id']
    }
  }
];
