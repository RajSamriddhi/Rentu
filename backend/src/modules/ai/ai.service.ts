import { ENV } from '../../config/env';
import {
  searchListings,
  checkAvailability,
  comparePrices,
  findAlternatives,
  getListingDetails,
  geminiToolDeclarations,
} from './ai.tools';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatContext {
  itemId?: string | null;
  locality?: string | null;
  startDate?: string | null;
  durationDays?: number | null;
}

export interface AiResponse {
  reply: string;
  mode: 'ai' | 'fallback';
  items: any[];
  suggestions: string[];
}

/**
 * System instruction provided to Gemini
 */
const SYSTEM_INSTRUCTION = `
You are Rentu AI, the intelligent shopping and rental assistant for Rentu⁺ (a Gen Z peer-to-peer gear and equipment rental marketplace).
Your job is to help users discover affordable gear, compare rental prices, check calendar availability, and recommend cheaper alternatives.

RULES:
1. Only reference real items returned by your tools. NEVER invent fake listings, prices, or owners.
2. Prices are in Indian Rupees (INR ₹ per day). Direct peer-to-peer rental, no extra platform deposit fees.
3. If a user asks to check availability, call check_availability with the item_id, start_date (YYYY-MM-DD), and duration_days.
4. If a user asks for cheaper alternatives, call find_alternatives.
5. If a user asks to compare options, call compare_prices.
6. If a user asks about free borrowing, explain that while listings have daily rates, Rentu encourages friendly community requests where owners can lend items for free or for community favors.
7. Keep responses concise, warm, helpful, and formatted with clean markdown bullet points.
`;

/**
 * Executes a tool called by Gemini
 */
async function executeGeminiTool(callName: string, args: any): Promise<{ data: any; items: any[] }> {
  try {
    switch (callName) {
      case 'search_listings': {
        const res = await searchListings(args);
        return { data: res, items: res.items || [] };
      }
      case 'compare_prices': {
        const res = await comparePrices(args);
        return { data: res, items: (res.comparison || []).map((c: any) => ({ ...c, image_urls: c.image_urls || [] })) };
      }
      case 'check_availability': {
        const res = await checkAvailability(args);
        return { data: res, items: [] };
      }
      case 'find_alternatives': {
        const res = await findAlternatives(args);
        return { data: res, items: res.alternatives || [] };
      }
      case 'get_listing_details': {
        const res = await getListingDetails(args.item_id);
        return { data: res, items: res.item ? [res.item] : [] };
      }
      default:
        return { data: { error: `Tool ${callName} not found` }, items: [] };
    }
  } catch (err: any) {
    return { data: { error: err.message || 'Tool execution error' }, items: [] };
  }
}

/**
 * Call Google Gemini REST API with tool calling
 */
async function callGemini(messages: ChatMessage[], context?: ChatContext): Promise<AiResponse | null> {
  const apiKey = ENV.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_key_here')) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // Format message history for Gemini
  const contents: any[] = [];

  // Append recent chat history (last 8 messages max)
  const recent = messages.slice(-8);
  for (const m of recent) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }

  // If context is present, add it as contextual note in latest prompt
  if (context && (context.itemId || context.locality || context.startDate)) {
    const lastUserIdx = contents.map(c => c.role).lastIndexOf('user');
    if (lastUserIdx !== -1) {
      const ctxNote = `\n[Context: Item ID=${context.itemId || 'none'}, Locality=${context.locality || 'none'}, StartDate=${context.startDate || 'none'}, DurationDays=${context.durationDays || 'none'}]`;
      contents[lastUserIdx].parts[0].text += ctxNote;
    }
  }

  const payload: any = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    tools: [
      {
        function_declarations: geminiToolDeclarations,
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800,
    },
  };

  const accumulatedItems: any[] = [];
  let iterations = 0;

  while (iterations < 3) {
    iterations++;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`Gemini API error (HTTP ${res.status}):`, errText);
      return null;
    }

    const data: any = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content) {
      return null;
    }

    const parts = candidate.content.parts || [];
    const functionCallPart = parts.find((p: any) => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const fn = functionCallPart.functionCall;
      const toolResult = await executeGeminiTool(fn.name, fn.args || {});

      if (toolResult.items && toolResult.items.length > 0) {
        for (const item of toolResult.items) {
          if (!accumulatedItems.some(existing => existing.id === item.id)) {
            accumulatedItems.push(item);
          }
        }
      }

      // Add model's tool call to history
      payload.contents.push(candidate.content);

      // Add function response to history
      payload.contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: fn.name,
              response: { result: toolResult.data },
            },
          },
        ],
      });

      continue;
    }

    // Final text answer
    const textPart = parts.find((p: any) => p.text);
    const replyText = textPart?.text || 'I checked the marketplace for you.';

    return {
      reply: replyText,
      mode: 'ai',
      items: accumulatedItems,
      suggestions: generateContextualSuggestions(replyText, accumulatedItems),
    };
  }

  return null;
}

/**
 * Helper to produce relevant follow-up prompt chips
 */
function generateContextualSuggestions(text: string, items: any[]): string[] {
  const suggestions: string[] = [];

  if (items.length > 0) {
    if (items.length >= 2) {
      suggestions.push(`Compare these ${items.length} options`);
    }
    suggestions.push(`Is "${items[0].title}" available this weekend?`);
    suggestions.push(`Find cheaper alternatives to ${items[0].title}`);
  } else {
    suggestions.push('Find cameras under ₹400/day');
    suggestions.push('Show outdoor & camping gear');
    suggestions.push('Can I borrow gear for free?');
  }

  return suggestions.slice(0, 3);
}

/**
 * Deterministic Rule-Based & Semantic Search Fallback Engine
 * Uses the exact same real database queries and price calculations without pretending to be LLM.
 */
async function executeDeterministicFallback(
  userQuery: string,
  context?: ChatContext
): Promise<AiResponse> {
  const queryLower = userQuery.toLowerCase();
  const accumulatedItems: any[] = [];
  let reply = '';

  // 1. Availability check request
  const isAvailabilityQuery = queryLower.includes('available') || queryLower.includes('free from') || queryLower.includes('book for');
  if (isAvailabilityQuery) {
    let itemId = context?.itemId;
    let startDate = context?.startDate;
    let duration = context?.durationDays || 3;

    // Detect dates from text if not in context
    const dateMatch = queryLower.match(/\b(202\d-[0-1]\d-[0-3]\d)\b/);
    if (dateMatch) {
      startDate = dateMatch[1];
    } else if (queryLower.includes('friday') || queryLower.includes('weekend')) {
      // Calculate next Friday
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
      const nextFriday = new Date(today);
      nextFriday.setDate(today.getDate() + daysUntilFriday);
      startDate = nextFriday.toISOString().split('T')[0];
    } else if (!startDate) {
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      startDate = tomorrow.toISOString().split('T')[0];
    }

    // Detect duration
    const durMatch = queryLower.match(/(\d+)\s*(?:day|days)/);
    if (durMatch) {
      duration = parseInt(durMatch[1], 10);
    }

    // If item not in context, look for mentioned title in query
    if (!itemId) {
      const searchRes = await searchListings({ query: userQuery, limit: 1 });
      if (searchRes.items.length > 0) {
        itemId = searchRes.items[0].id;
      }
    }

    if (itemId) {
      const avail = await checkAvailability({
        item_id: itemId,
        start_date: startDate,
        duration_days: duration,
      });

      if (avail.available) {
        reply = `✅ **Great news!** **${avail.item_title}** is **available** for your requested dates (${avail.requested_dates?.start_date} to ${avail.requested_dates?.end_date}, ${duration} days).\n\n` +
          `• **Daily Rate:** ₹${avail.price_per_day}/day\n` +
          `• **Estimated Total:** **₹${avail.estimated_total}**\n` +
          `• **Location:** ${avail.locality || 'Nearby'}\n\n` +
          `You can request to rent it directly from the listing below!`;
      } else {
        reply = `⚠️ **Availability Notice:** **${avail.item_title || 'Item'}** cannot be booked for those dates.\n\n` +
          `• **Reason:** ${avail.reason || avail.error}\n\n` +
          `Here are some alternative available listings in the same category:`;
      }

      const itemDetails = await getListingDetails(itemId);
      if (itemDetails.item) {
        accumulatedItems.push(itemDetails.item);
      }

      if (!avail.available) {
        const alts = await findAlternatives({ item_id: itemId, duration_days: duration });
        accumulatedItems.push(...alts.alternatives.slice(0, 3));
      }

      return {
        reply,
        mode: 'fallback',
        items: accumulatedItems,
        suggestions: [
          `Find cheaper alternatives to this`,
          `Check other dates`,
          `Explore all gear near me`,
        ],
      };
    }
  }

  // 2. Free borrowing request
  if (queryLower.includes('free') || queryLower.includes('borrow for free') || queryLower.includes('without paying')) {
    const freeItemsRes = await searchListings({ free_only: true, limit: 3 });
    if (freeItemsRes.items.length > 0) {
      reply = `🎉 Here are items currently listed with ₹0 daily rate by generous neighbors in the community!`;
      accumulatedItems.push(...freeItemsRes.items);
    } else {
      reply = `💡 **How Free Borrowing Works on Rentu⁺:**\n\n` +
        `Most equipment owners on Rentu list low daily rental rates (e.g. ₹200–₹500/day) to cover maintenance. However, Rentu features an active **Requests Board** where you can:\n\n` +
        `1. Post a **Community Wish** asking neighbors if someone has gear they'd lend for free or a friendly favor.\n` +
        `2. Chat with verified lenders who often offer discounts or free trials for students and creators.\n\n` +
        `Here are the most affordable listings currently available in the marketplace:`;
      const cheapRes = await searchListings({ limit: 4 });
      accumulatedItems.push(...cheapRes.items);
    }

    return {
      reply,
      mode: 'fallback',
      items: accumulatedItems,
      suggestions: [
        'Find cameras under ₹400/day',
        'Post a Community Request',
        'Compare rental rates',
      ],
    };
  }

  // 3. Cheaper alternatives & price comparisons
  const isAlternativeQuery = queryLower.includes('cheaper') || queryLower.includes('alternative') || queryLower.includes('less expensive') || queryLower.includes('save money');
  if (isAlternativeQuery) {
    let refItemId = context?.itemId;

    if (!refItemId) {
      const searchRes = await searchListings({ query: userQuery, limit: 1 });
      if (searchRes.items.length > 0) {
        refItemId = searchRes.items[0].id;
      }
    }

    const alts = await findAlternatives({
      item_id: refItemId || undefined,
      category: context?.itemId ? undefined : extractCategoryFromText(queryLower),
      duration_days: context?.durationDays || 3,
    });

    if (alts.alternatives.length > 0) {
      const topAlt = alts.alternatives[0];
      const refTitle = alts.reference_item ? alts.reference_item.title : 'standard listings';
      const savingsMsg = topAlt.savings_per_day
        ? `saving you **₹${topAlt.savings_per_day}/day (${topAlt.savings_percentage}% off)**`
        : `starting at just ₹${topAlt.price_per_day}/day`;

      reply = `💰 **Found ${alts.alternatives.length} cheaper alternative(s) compared to ${refTitle}:**\n\n` +
        `• **Top Pick:** **${topAlt.title}** at **₹${topAlt.price_per_day}/day**, ${savingsMsg}.\n` +
        `• **Verified Location:** ${topAlt.locality || 'Nearby'}\n\n` +
        `Tap any item below to view full photos, owner ratings, or request a booking!`;

      accumulatedItems.push(...alts.alternatives);
    } else {
      reply = `We didn't find any listings priced lower than the current item in this category, but here are the most affordable options available:`;
      const fallbackSearch = await searchListings({ limit: 3 });
      accumulatedItems.push(...fallbackSearch.items);
    }

    return {
      reply,
      mode: 'fallback',
      items: accumulatedItems,
      suggestions: [
        `Is "${accumulatedItems[0]?.title || 'gear'}" available?`,
        `Calculate total cost for 5 days`,
        `Find items in my locality`,
      ],
    };
  }

  // 4. Comparison query
  if (queryLower.includes('compare') || queryLower.includes('difference between') || queryLower.includes('which is cheaper')) {
    const durMatch = queryLower.match(/(\d+)\s*(?:day|days)/);
    const duration = durMatch ? parseInt(durMatch[1], 10) : 3;

    const comp = await comparePrices({
      query: userQuery,
      duration_days: duration,
    });

    if (comp.comparison.length > 0 && comp.summary) {
      const s = comp.summary;
      reply = `📊 **Rental Price Comparison (${duration} Days):**\n\n` +
        `• **Cheapest Option:** **${s.cheapest_item}** at ₹${s.cheapest_daily_rate}/day (Total: **₹${s.cheapest_total}**)\n` +
        (s.potential_total_savings > 0 ? `• **Potential Savings:** Up to **₹${s.potential_total_savings}** total compared to higher-tier gear.\n` : '') +
        `• **Note:** ${s.pricing_note}\n\n` +
        `Here are the compared listings:`;

      for (const c of comp.comparison) {
        accumulatedItems.push(c);
      }
    } else {
      reply = `I couldn't find multiple items matching that search to compare. Try browsing by category or refining your query.`;
    }

    return {
      reply,
      mode: 'fallback',
      items: accumulatedItems,
      suggestions: [
        `Check availability for ${duration} days`,
        `Find cheaper alternatives`,
        `Explore all cameras`,
      ],
    };
  }

  // 5. Total cost calculation
  const isCostQuery = queryLower.includes('total') || queryLower.includes('cost for') || queryLower.includes('how much for');
  if (isCostQuery) {
    const durMatch = queryLower.match(/(\d+)\s*(?:day|days)/);
    const duration = durMatch ? parseInt(durMatch[1], 10) : (context?.durationDays || 3);

    const searchRes = await searchListings({
      query: userQuery,
      limit: 3,
    });

    if (searchRes.items.length > 0) {
      accumulatedItems.push(...searchRes.items);
      const first = searchRes.items[0];
      const total = first.price_per_day * duration;

      reply = `💵 **Estimated Rental Cost for ${duration} Day${duration > 1 ? 's' : ''}:**\n\n` +
        `• **${first.title}:** ₹${first.price_per_day}/day × ${duration} days = **₹${total}**\n` +
        `• **Deposit / Fees:** ₹0 platform fee. You coordinate pickup directly with the owner.\n\n` +
        `Check out this listing and similar options below:`;
    } else {
      reply = `Please select an item or specify gear to calculate its total rental cost for ${duration} days.`;
    }

    return {
      reply,
      mode: 'fallback',
      items: accumulatedItems,
      suggestions: [
        `Check availability for ${duration} days`,
        `Find cheaper options`,
        `View item details`,
      ],
    };
  }

  // 6. General Search by budget, keyword, or locality
  let maxPrice: number | undefined;
  const priceMatch = queryLower.match(/under\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) || queryLower.match(/below\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (priceMatch) {
    maxPrice = parseInt(priceMatch[1], 10);
  }

  const category = extractCategoryFromText(queryLower);
  const cleanKeyword = userQuery
    .replace(/under\s*(?:₹|rs\.?|inr)?\s*\d+/gi, '')
    .replace(/find|show|search|looking for|cheap|affordable|near me|in|for rent/gi, '')
    .trim();

  const searchRes = await searchListings({
    query: cleanKeyword || undefined,
    category,
    max_price: maxPrice,
    locality: context?.locality || undefined,
    limit: 6,
  });

  accumulatedItems.push(...searchRes.items);

  if (accumulatedItems.length > 0) {
    const budgetNote = maxPrice ? ` under ₹${maxPrice}/day` : '';
    const locNote = context?.locality ? ` in ${context.locality}` : '';
    reply = `✨ **Found ${accumulatedItems.length} listing${accumulatedItems.length > 1 ? 's' : ''}${budgetNote}${locNote} in the Rentu marketplace:**\n\n` +
      accumulatedItems.map(item => `• **${item.title}** — ₹${item.price_per_day}/day (${item.locality || 'Nearby'})`).join('\n') +
      `\n\nTap any card below to check full specs or request a rental!`;
  } else {
    reply = `🔍 I searched the marketplace but couldn't find any listings matching "${userQuery}".\n\n` +
      `**Helpful suggestions:**\n` +
      `• Try a higher budget or broader keywords (e.g. "camera", "tech", "tent").\n` +
      `• You can also post a **Community Request** on the Requests Board so local gear owners can reach out to you!`;

    // Return popular gear as fallback
    const popularRes = await searchListings({ limit: 3 });
    accumulatedItems.push(...popularRes.items);
  }

  return {
    reply,
    mode: 'fallback',
    items: accumulatedItems,
    suggestions: generateContextualSuggestions(reply, accumulatedItems),
  };
}

/**
 * Extracts standard Rentu category from search phrases
 */
function extractCategoryFromText(text: string): string | undefined {
  if (text.includes('camera') || text.includes('dslr') || text.includes('lens') || text.includes('photo') || text.includes('shoot')) {
    return 'Electronics & Tech';
  }
  if (text.includes('tent') || text.includes('camp') || text.includes('trek') || text.includes('outdoor')) {
    return 'Camping & Outdoor';
  }
  if (text.includes('drill') || text.includes('tool') || text.includes('diy') || text.includes('repair')) {
    return 'Tools & DIY';
  }
  if (text.includes('dj') || text.includes('music') || text.includes('speaker') || text.includes('party')) {
    return 'Party & Events';
  }
  return undefined;
}

/**
 * Main AI Chat Orchestrator
 */
export async function processAiChat(
  messages: ChatMessage[],
  context?: ChatContext
): Promise<AiResponse> {
  const latestMessage = messages[messages.length - 1]?.content || '';

  // 1. Try Google Gemini with native tool execution if key is present
  try {
    const geminiResponse = await callGemini(messages, context);
    if (geminiResponse) {
      return geminiResponse;
    }
  } catch (err) {
    console.warn('Gemini invocation failed, falling back to deterministic engine:', err);
  }

  // 2. Deterministic Rule-Based & Real Database Engine Fallback
  return await executeDeterministicFallback(latestMessage, context);
}
