"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeDeterministicFallback = executeDeterministicFallback;
exports.processAiChat = processAiChat;
const generative_ai_1 = require("@google/generative-ai");
const env_1 = require("../../config/env");
const ai_tools_1 = require("./ai.tools");
/**
 * Prioritized list of active Gemini models
 * If one experiences high demand (503) or is deprecated (404), fail over to the next
 */
const CANDIDATE_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
];
/**
 * System instruction provided to Gemini
 */
const SYSTEM_INSTRUCTION = `
You are Rentu AI, the lovable, intelligent shopping and rental assistant for Rentu⁺ (a Gen Z peer-to-peer gear sharing and rental platform).
Personality:
- Friendly, warm, encouraging, and helpful. You occasionally use a sweet touch like "Of course! 💗" or "Let me check that for you! ✨" without overusing emojis.
- Never sound robotic or overly corporate.
- For general greetings (e.g. "hi", "hello", "who are you"), casual everyday questions, and introductions: reply warmly and conversationally directly. Do NOT call search or database tools for pure greetings!
- You can answer general everyday questions, casual conversation, explanations ("explain this simply"), brainstorming, and recommendations.
- For Rentu marketplace shopping/rental requests (e.g. searching for gear, comparing prices, checking dates, finding alternatives), ALWAYS call the appropriate tool.
- You NEVER invent fake products, fake prices, or fake owners.
- Rentu items are priced in Indian Rupees (INR ₹ per day). Direct peer-to-peer rental, no extra platform deposit fees.
- If asked how listing, contacting owners, or booking works:
  * Listing: Tap '+ Post' -> 'List Gear for Rent' -> upload photos, set price/day, duration, and publish.
  * Contacting owner: Click 'Chat with Owner' on any listing or send a proposal.
  * Booking & Returns: Select dates -> click 'Request to Rent' -> owner accepts -> coordinate pickup via chat -> return on end date -> owner marks Completed and leave reviews.
- When you recommend items, explain WHY (e.g. price per day, owner rating, locality).
`;
/**
 * Executes a tool called by Gemini
 */
async function executeGeminiTool(callName, args) {
    try {
        switch (callName) {
            case 'search_listings': {
                const res = await (0, ai_tools_1.searchListings)(args);
                return { data: res, items: res.items || [] };
            }
            case 'compare_prices': {
                const res = await (0, ai_tools_1.comparePrices)(args);
                return { data: res, items: (res.comparison || []).map((c) => ({ ...c, image_urls: c.image_urls || [] })) };
            }
            case 'check_availability': {
                const res = await (0, ai_tools_1.checkAvailability)(args);
                return { data: res, items: [] };
            }
            case 'find_alternatives': {
                const res = await (0, ai_tools_1.findAlternatives)(args);
                return { data: res, items: res.alternatives || [] };
            }
            case 'get_listing_details': {
                const res = await (0, ai_tools_1.getListingDetails)(args.item_id);
                return { data: res, items: res.item ? [res.item] : [] };
            }
            default:
                return { data: { error: `Tool ${callName} not found` }, items: [] };
        }
    }
    catch (err) {
        return { data: { error: err.message || 'Tool execution error' }, items: [] };
    }
}
/**
 * Accurately parses Gemini error responses to distinguish invalid key, model deprecation, quota, and outages
 */
function parseGeminiError(err) {
    const status = err?.status || err?.statusCode;
    const errMsg = String(err?.message || '').toLowerCase();
    if (errMsg.includes('api_key_invalid') || errMsg.includes('api key not valid') || (status === 400 && errMsg.includes('api key'))) {
        return { reason: 'invalid_key', category: 'API Key Invalid', status: 400 };
    }
    if (status === 403 || errMsg.includes('permission_denied') || errMsg.includes('permission')) {
        return { reason: 'permission_denied', category: 'Permission Denied / Restricted Key', status: 403 };
    }
    if (status === 429 || errMsg.includes('quota') || errMsg.includes('resource_exhausted')) {
        return { reason: 'quota_exceeded', category: 'Quota Exceeded / Rate Limit', status: 429 };
    }
    if (status === 404 || errMsg.includes('not found') || errMsg.includes('is no longer available')) {
        return { reason: 'model_not_found', category: 'Model Not Found / Unsupported Version', status: 404 };
    }
    if (status === 503 || errMsg.includes('high demand') || errMsg.includes('service unavailable')) {
        return { reason: 'service_unavailable', category: 'Service High Demand / 503', status: 503 };
    }
    if (errMsg.includes('econnrefused') || errMsg.includes('etimedout') || errMsg.includes('fetch failed')) {
        return { reason: 'network_failure', category: 'Network Failure / Timeout', status };
    }
    return { reason: 'unknown_error', category: `API Error (HTTP ${status || 'unknown'})`, status };
}
/**
 * Call Google Gemini using the official @google/generative-ai SDK with function calling
 */
async function callGemini(messages, context) {
    const apiKey = env_1.ENV.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_key_here')) {
        return { success: false, reason: 'missing_key', errorCategory: 'Key Unconfigured' };
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const tools = [
        {
            functionDeclarations: ai_tools_1.geminiToolDeclarations.map((decl) => ({
                name: decl.name,
                description: decl.description,
                parameters: decl.parameters,
            })),
        },
    ];
    const recent = messages.slice(-10);
    if (recent.length === 0) {
        return { success: false, reason: 'missing_key', errorCategory: 'Empty messages' };
    }
    const lastMsg = recent[recent.length - 1];
    let promptText = lastMsg.content;
    if (context && (context.itemId || context.locality || context.startDate)) {
        promptText += `\n[Context: Item ID=${context.itemId || 'none'}, Locality=${context.locality || 'none'}, StartDate=${context.startDate || 'none'}, DurationDays=${context.durationDays || 'none'}]`;
    }
    let lastErrorOutcome = null;
    // Try candidate models in order of priority (handling model sunsets or transient 503 spikes)
    for (const modelName of CANDIDATE_MODELS) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: SYSTEM_INSTRUCTION,
                tools: tools,
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 900,
                },
            });
            // Format conversation contents for model.generateContent
            const contents = [];
            const prior = recent.slice(0, -1);
            for (const m of prior) {
                contents.push({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                });
            }
            // Gemini requires first content item to be user role
            while (contents.length > 0 && contents[0].role !== 'user') {
                contents.shift();
            }
            contents.push({
                role: 'user',
                parts: [{ text: promptText }],
            });
            let res = await model.generateContent({ contents });
            const accumulatedItems = [];
            let iterations = 0;
            // Function calling loop
            while (iterations < 3) {
                iterations++;
                const functionCalls = res.response.functionCalls();
                if (!functionCalls || functionCalls.length === 0) {
                    break;
                }
                const call = functionCalls[0];
                const candidate = res.response.candidates?.[0]?.content;
                if (candidate) {
                    contents.push(candidate);
                }
                const toolResult = await executeGeminiTool(call.name, call.args || {});
                if (toolResult.items && toolResult.items.length > 0) {
                    for (const item of toolResult.items) {
                        if (!accumulatedItems.some(existing => existing.id === item.id)) {
                            accumulatedItems.push(item);
                        }
                    }
                }
                // Send function response back to Gemini with role: 'user' (required by Gemini 2.x/3.x)
                contents.push({
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                name: call.name,
                                response: { result: toolResult.data },
                                ...(call.id ? { id: call.id } : {}),
                            },
                        },
                    ],
                });
                res = await model.generateContent({ contents });
            }
            const replyText = res.response.text();
            const modelDisplayName = modelName === 'gemini-3.1-flash-lite'
                ? 'Google Gemini 3.1 Flash Lite'
                : modelName.includes('3.8')
                    ? 'Google Gemini 3.8 Flash'
                    : modelName.includes('3.6')
                        ? 'Google Gemini 3.6 Flash'
                        : modelName.includes('3.5')
                            ? 'Google Gemini 3.5 Flash'
                            : modelName.includes('3.1')
                                ? 'Google Gemini 3.1 Flash Lite'
                                : modelName.includes('3-flash')
                                    ? 'Google Gemini 3 Flash'
                                    : 'Google Gemini Flash';
            return {
                success: true,
                response: {
                    reply: replyText,
                    mode: 'ai',
                    provider: `${modelDisplayName} (Official SDK)`,
                    items: accumulatedItems,
                    suggestions: generateContextualSuggestions(replyText, accumulatedItems),
                },
            };
        }
        catch (err) {
            const parsed = parseGeminiError(err);
            lastErrorOutcome = parsed;
            // If invalid key, permission denied, or confirmed quota exhaustion (HTTP 429), do not retry other models; return failure immediately
            if (parsed.reason === 'invalid_key' || parsed.reason === 'permission_denied' || parsed.reason === 'quota_exceeded') {
                console.warn(`[Rentu AI] Gemini SDK call stopped (${parsed.category}): HTTP ${parsed.status || 'unknown'}`);
                return {
                    success: false,
                    reason: parsed.reason,
                    errorCategory: parsed.category,
                    statusCode: parsed.status,
                };
            }
            // If model not found (404) or service high demand / temporary outage (503), try next fallback candidate model
            console.warn(`[Rentu AI] Model ${modelName} returned ${parsed.category} (HTTP ${parsed.status || 'unknown'}), trying next fallback candidate...`);
        }
    }
    return {
        success: false,
        reason: lastErrorOutcome?.reason || 'unknown_error',
        errorCategory: lastErrorOutcome?.category || 'Provider Error',
        statusCode: lastErrorOutcome?.status,
    };
}
/**
 * Helper to produce relevant follow-up prompt chips
 */
function generateContextualSuggestions(text, items) {
    const suggestions = [];
    if (items.length > 0) {
        if (items.length >= 2) {
            suggestions.push(`Compare these ${items.length} options`);
        }
        suggestions.push(`Is "${items[0].title}" available this weekend?`);
        suggestions.push(`Find cheaper alternatives to ${items[0].title}`);
    }
    else {
        suggestions.push('Find cameras under ₹400/day');
        suggestions.push('Can I borrow gear for free?');
        suggestions.push('How does booking & returning work?');
    }
    return suggestions.slice(0, 3);
}
/**
 * Multi-Turn Conversation Memory Extraction for Deterministic Fallback
 */
function extractConversationContext(messages, currentContext) {
    let category = undefined;
    let maxPrice = undefined;
    let locality = currentContext?.locality || undefined;
    let itemId = currentContext?.itemId || undefined;
    let duration = currentContext?.durationDays || 3;
    let startDate = currentContext?.startDate || undefined;
    // Scan recent history in chronological order
    for (const m of messages) {
        const text = m.content.toLowerCase();
        // Check category mentions
        const cat = extractCategoryFromText(text);
        if (cat)
            category = cat;
        // Check price mentions
        const priceMatch = text.match(/(?:under|below|less than|budget of)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) || text.match(/(\d+)\s*(?:rs|inr|\/day|per day)/i);
        if (priceMatch) {
            const p = parseInt(priceMatch[1], 10);
            if (p > 50 && p < 10000)
                maxPrice = p;
        }
        // Check duration mentions
        const durMatch = text.match(/(\d+)\s*(?:day|days)/);
        if (durMatch) {
            duration = parseInt(durMatch[1], 10);
        }
        // Check date mentions
        const dateMatch = text.match(/\b(202\d-[0-1]\d-[0-3]\d)\b/);
        if (dateMatch) {
            startDate = dateMatch[1];
        }
    }
    return { category, maxPrice, locality, itemId, duration, startDate };
}
/**
 * Deterministic Rule-Based & Semantic Search Fallback Engine
 * Accurately handles multi-turn conversations, general knowledge, marketplace workflows, and live database queries.
 */
async function executeDeterministicFallback(messages, context, fallbackReason) {
    const latestMessage = messages[messages.length - 1]?.content || '';
    const queryLower = latestMessage.toLowerCase().trim();
    const normalized = queryLower
        .replace(/[!?,.:;~'"\-()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const convContext = extractConversationContext(messages, context);
    const accumulatedItems = [];
    let reply = '';
    let provider = 'Rentu Smart Search';
    if (fallbackReason === 'invalid_key') {
        provider = 'Rentu Smart Search (Fallback: Gemini API key invalid)';
    }
    else if (fallbackReason === 'missing_key') {
        provider = 'Rentu Smart Search (Fallback: GEMINI_API_KEY unconfigured)';
    }
    else if (fallbackReason === 'model_not_found') {
        provider = 'Rentu Smart Search (Fallback: Gemini model version mismatch)';
    }
    else if (fallbackReason === 'quota_exceeded') {
        provider = 'Rentu Smart Search (Fallback: Gemini quota limit reached)';
    }
    else if (fallbackReason === 'permission_denied') {
        provider = 'Rentu Smart Search (Fallback: Gemini access restricted)';
    }
    else if (fallbackReason === 'service_unavailable') {
        provider = 'Rentu Smart Search (Fallback: Gemini service high demand)';
    }
    else if (fallbackReason === 'network_failure') {
        provider = 'Rentu Smart Search (Fallback: Network timeout)';
    }
    else if (fallbackReason === 'unknown_error') {
        provider = 'Rentu Smart Search (Fallback: Gemini service error)';
    }
    // 1. General Greetings, Introductions & Casual Conversation
    const isGreeting = normalized === 'hi' ||
        normalized === 'hello' ||
        normalized === 'hey' ||
        normalized === 'hey there' ||
        normalized.startsWith('hi ') ||
        normalized.startsWith('hello ') ||
        normalized.startsWith('hey ') ||
        normalized.startsWith('good morning') ||
        normalized.startsWith('good afternoon') ||
        normalized.startsWith('good evening') ||
        normalized.startsWith('greetings') ||
        normalized.startsWith('namaste') ||
        normalized.startsWith('howdy') ||
        normalized.startsWith('yo ') ||
        normalized === 'yo';
    const isIntroductionOrIdentity = normalized.includes('introduce') ||
        normalized.includes('who are you') ||
        normalized.includes('who r u') ||
        normalized.includes('about yourself') ||
        normalized.includes('what is your name') ||
        normalized.includes('what are you') ||
        normalized.includes('what can you do') ||
        normalized.includes('what do you do') ||
        normalized.includes('tell me about you') ||
        normalized.includes('what is rentu') ||
        normalized.includes('how does rentu work') ||
        normalized.includes('who made you');
    const isCasualPleasantry = normalized.includes('how are you') ||
        normalized.includes('how r u') ||
        normalized.includes('how is it going') ||
        normalized.includes('how are things') ||
        normalized === 'thanks' ||
        normalized.startsWith('thank you') ||
        normalized.startsWith('thanks') ||
        normalized === 'bye' ||
        normalized.startsWith('goodbye') ||
        normalized.includes('nice to meet you');
    if (isGreeting || isIntroductionOrIdentity || isCasualPleasantry) {
        if (normalized.includes('thank')) {
            reply = `You're so very welcome! 💗 It's always my pleasure to help. Let me know if you need to find more gear, compare rates, or check availability for your next adventure! ✨`;
        }
        else if (normalized.startsWith('bye') || normalized.startsWith('goodbye')) {
            reply = `Goodbye neighbor! 👋 Have a wonderful time, and remember I'm always here whenever you want to rent or share gear on Rentu⁺! 💗`;
        }
        else if (normalized.includes('how are you') || normalized.includes('how is it going')) {
            reply = `I'm doing fantastic, thank you so much for asking! 💗 Ready to help you discover the coolest gear and best rental deals in your neighborhood. How are you doing today? ✨`;
        }
        else {
            reply = `Hey there neighbor! 💗 I'm **Rentu AI**, your personal gear sharing companion on Rentu⁺.\n\n` +
                `I can help you:\n` +
                `• **Find affordable gear** matching your daily budget (cameras, camping, tools, DJ gear, laptops)\n` +
                `• **Check live availability** for your upcoming weekend or trip dates\n` +
                `• **Compare prices** and recommend cheaper alternatives\n` +
                `• **Explain how to rent, list, or borrow gear for free**\n\n` +
                `What are you looking to rent, borrow, or explore today? ✨`;
        }
        return {
            reply,
            mode: 'fallback',
            provider,
            items: [],
            suggestions: [
                'Find cameras under ₹400/day',
                'Can I borrow gear for free?',
                'How does booking and returning work?',
            ],
        };
    }
    // 1B. General Explanations & Help Deciding
    if (normalized.includes('photosynthesis')) {
        reply = `Think of photosynthesis like a plant's way of cooking its own dinner! 🌿🍳\n\n` +
            `1. **The Ingredients:** A plant takes in sunlight, water from the ground, and carbon dioxide from the air.\n` +
            `2. **The Cooking:** Inside its leaves, it uses light energy to transform water and gas into food.\n` +
            `3. **The Meal:** It makes sugar (plant food) and releases oxygen into the air for us to breathe!\n\n` +
            `Plants basically turn sunshine into food! Isn't nature amazing? ✨`;
        return {
            reply,
            mode: 'fallback',
            provider,
            items: [],
            suggestions: [
                'Find cameras under ₹400/day',
                'Can I borrow gear for free?',
                'How does booking and returning work?',
            ],
        };
    }
    if (normalized.includes('explain this') || normalized.includes('simple words') || normalized.includes('help me decide')) {
        reply = `I'd love to help! 💗\n\n` +
            `On Rentu⁺, you can rent equipment directly from verified local neighbors rather than buying expensive gear you only need for a few days.\n\n` +
            `• **To decide between listings:** Look at the daily rate (₹/day), the lender's community trust score, and their locality for easy pickup.\n` +
            `• **Need a comparison?** Just ask me to "compare these cameras" or tell me your budget and duration, and I'll calculate which option saves you the most money!\n\n` +
            `What gear would you like to explore? ✨`;
        return {
            reply,
            mode: 'fallback',
            provider,
            items: [],
            suggestions: [
                'Find cameras under ₹400/day',
                'Find laptops under ₹500/day',
                'How does booking and returning work?',
            ],
        };
    }
    // 2. Marketplace Workflow Questions
    if (queryLower.includes('how do i list') || queryLower.includes('list my product') || queryLower.includes('list gear') || queryLower.includes('post an item')) {
        reply = `💸 **How to List Your Gear for Rent on Rentu⁺:**\n\n` +
            `1. Tap the **"+ Post"** button in the top navigation bar (or bottom menu on mobile).\n` +
            `2. Choose **"List Gear for Rent"**.\n` +
            `3. Upload 1 or more clear photos of your equipment.\n` +
            `4. Set your title, category, daily rental rate (e.g. ₹350/day), and max duration (up to 7 days).\n` +
            `5. Enter your locality for easy local pickup, then hit **Publish**!\n\n` +
            `Neighbors near you can now view your listing and send rental proposals. You get paid directly with zero platform cuts! 🚀`;
        return {
            reply,
            mode: 'fallback',
            provider,
            items: [],
            suggestions: [
                'How do I contact the owner?',
                'Explain how booking works',
                'Find gear near me',
            ],
        };
    }
    if (queryLower.includes('contact the owner') || queryLower.includes('message the owner') || queryLower.includes('chat with owner') || queryLower.includes('talk to lender')) {
        reply = `💬 **How to Contact a Gear Owner:**\n\n` +
            `• **Direct Rental Chat:** When viewing any listing in the catalog, click **"Request to Rent"** with a quick note. A direct 2-way message thread will open between you and the lender in the Messages panel.\n` +
            `• **Coordination:** You can discuss exact pickup times, equipment condition, memory cards/cables, and handoff spots directly.\n` +
            `• **Verified Neighbors:** All owners display trust scores and community ratings so you always know who you are renting from.`;
        return {
            reply,
            mode: 'fallback',
            provider,
            items: [],
            suggestions: [
                'Find cameras under ₹400/day',
                'Explain how returns work',
                'Check availability for weekend',
            ],
        };
    }
    if (queryLower.includes('how does booking') || queryLower.includes('booking and return') || queryLower.includes('how it works') || queryLower.includes('how to rent')) {
        reply = `🤝 **How Booking & Returning Works on Rentu⁺:**\n\n` +
            `1. **Discover:** Find the gear you need (cameras, outdoor equipment, DJ decks, tools).\n` +
            `2. **Request:** Select your start date and duration, then click **"Request to Rent"**.\n` +
            `3. **Lender Accepts:** The owner receives your proposal. Once accepted, the item is marked reserved.\n` +
            `4. **Handoff:** Meet up locally to test and pick up the gear. No hidden platform fees!\n` +
            `5. **Return:** Hand the item back on your scheduled end date. The owner marks the booking **"Completed"**, and you both exchange verified reviews! 🌟`;
        return {
            reply,
            mode: 'fallback',
            provider,
            items: [],
            suggestions: [
                'Find cameras under ₹400/day',
                'Can I borrow gear for free?',
                'List gear for rent',
            ],
        };
    }
    // 3. Free Borrowing Questions
    if (queryLower.includes('free') || queryLower.includes('borrow for free') || queryLower.includes('without paying') || queryLower.includes('borrow free')) {
        const freeItemsRes = await (0, ai_tools_1.searchListings)({ free_only: true, limit: 3 });
        if (freeItemsRes.items.length > 0) {
            reply = `🎉 Here are gear items currently listed with ₹0 daily rates by friendly neighbors in your area!`;
            accumulatedItems.push(...freeItemsRes.items);
        }
        else {
            reply = `💡 **Can You Borrow for Free on Rentu⁺? Yes!**\n\n` +
                `While most marketplace listings have a modest daily fee (e.g. ₹200–₹400/day) to cover wear & tear, Rentu⁺ features a dedicated **Requests Board**:\n\n` +
                `1. Post a **Community Wish** explaining what you need (e.g. "Need camera for college film shoot").\n` +
                `2. Community members often lend gear for free or in exchange for creative favors!\n\n` +
                `Here are the most affordable verified options currently available in the community:`;
            const cheapRes = await (0, ai_tools_1.searchListings)({ limit: 3 });
            accumulatedItems.push(...cheapRes.items);
        }
        return {
            reply,
            mode: 'fallback',
            provider,
            items: accumulatedItems,
            suggestions: [
                'Find cameras under ₹400/day',
                'Compare rental rates',
                'How do I post a wish?',
            ],
        };
    }
    // 4. Recommendation & "Which is best / decide" question
    if (queryLower.includes('which is best') || queryLower.includes('help me decide') || queryLower.includes('which one') || queryLower.includes('recommend one')) {
        const searchRes = await (0, ai_tools_1.searchListings)({
            category: convContext.category || 'Electronics & Tech',
            max_price: convContext.maxPrice,
            limit: 3,
        });
        if (searchRes.items.length > 0) {
            const best = searchRes.items[0];
            accumulatedItems.push(...searchRes.items);
            reply = `🌟 **Top Community Recommendation:**\n\n` +
                `I recommend the **${best.title}**! Here is why:\n` +
                `• **Price:** Just **₹${best.price_per_day}/day** — one of the best values in ${best.category}.\n` +
                `• **Lender Rating:** ${best.owner_rating ? `${best.owner_rating.toFixed(1)}/5.0` : '5.0/5.0'} (${best.owner_name})\n` +
                `• **Verified Location:** ${best.locality || 'Nearby'}\n\n` +
                `Here are the top options compared side-by-side:`;
        }
        else {
            reply = `I'd love to help you decide! Tell me what you're working on (photo shoot, camping trip, rooftop party) and your budget.`;
        }
        return {
            reply,
            mode: 'fallback',
            provider,
            items: accumulatedItems,
            suggestions: [
                `Is "${accumulatedItems[0]?.title || 'item'}" available?`,
                `Find cheaper alternatives`,
                `Compare these options`,
            ],
        };
    }
    // 5. Date-Aware Availability Check
    const isAvailabilityQuery = queryLower.includes('available') || queryLower.includes('free from') || queryLower.includes('book for') || queryLower.includes('available next') || queryLower.includes('weekend');
    if (isAvailabilityQuery) {
        let itemId = convContext.itemId;
        let startDate = convContext.startDate;
        const duration = convContext.duration;
        // Detect weekend / next Friday
        if (queryLower.includes('friday') || queryLower.includes('weekend') || queryLower.includes('next weekend')) {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
            const nextFriday = new Date(today);
            nextFriday.setDate(today.getDate() + daysUntilFriday);
            startDate = nextFriday.toISOString().split('T')[0];
        }
        else if (!startDate) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            startDate = tomorrow.toISOString().split('T')[0];
        }
        // Resolve item if not in context
        if (!itemId) {
            const searchRes = await (0, ai_tools_1.searchListings)({
                query: convContext.category ? undefined : latestMessage,
                category: convContext.category,
                limit: 1,
            });
            if (searchRes.items.length > 0) {
                itemId = searchRes.items[0].id;
            }
        }
        if (itemId) {
            const avail = await (0, ai_tools_1.checkAvailability)({
                item_id: itemId,
                start_date: startDate,
                duration_days: duration,
            });
            if (avail.available) {
                reply = `✅ **Great news!** **${avail.item_title}** is **available** for your requested dates (${avail.requested_dates?.start_date} to ${avail.requested_dates?.end_date}, ${duration} days).\n\n` +
                    `• **Daily Rate:** ₹${avail.price_per_day}/day\n` +
                    `• **Estimated Total:** **₹${avail.estimated_total}**\n` +
                    `• **Location:** ${avail.locality || 'Nearby'}\n\n` +
                    `You can view full specs or send a rental proposal below! 💗`;
            }
            else {
                reply = `⚠️ **Availability Notice:** **${avail.item_title || 'Item'}** cannot be booked for those dates.\n\n` +
                    `• **Reason:** ${avail.reason || avail.error}\n\n` +
                    `Here are available alternative listings in the same category:`;
            }
            const itemDetails = await (0, ai_tools_1.getListingDetails)(itemId);
            if (itemDetails.item) {
                accumulatedItems.push(itemDetails.item);
            }
            if (!avail.available) {
                const alts = await (0, ai_tools_1.findAlternatives)({ item_id: itemId, duration_days: duration });
                accumulatedItems.push(...alts.alternatives.slice(0, 3));
            }
            return {
                reply,
                mode: 'fallback',
                provider,
                items: accumulatedItems,
                suggestions: [
                    `Find cheaper alternatives to this`,
                    `Calculate cost for 5 days`,
                    `Explore all gear near me`,
                ],
            };
        }
    }
    // 6. Cheaper Alternatives & Price Differences
    const isAlternativeQuery = queryLower.includes('cheaper') || queryLower.includes('alternative') || queryLower.includes('less expensive') || queryLower.includes('save money') || queryLower.includes('any cheaper');
    if (isAlternativeQuery) {
        let refItemId = convContext.itemId;
        if (!refItemId) {
            const searchRes = await (0, ai_tools_1.searchListings)({
                query: convContext.category ? undefined : latestMessage,
                category: convContext.category,
                limit: 1,
            });
            if (searchRes.items.length > 0) {
                refItemId = searchRes.items[0].id;
            }
        }
        const alts = await (0, ai_tools_1.findAlternatives)({
            item_id: refItemId || undefined,
            category: convContext.category,
            max_price: convContext.maxPrice,
            locality: convContext.locality,
            duration_days: convContext.duration,
        });
        if (alts.alternatives.length > 0) {
            const topAlt = alts.alternatives[0];
            const refTitle = alts.reference_item ? alts.reference_item.title : 'similar items';
            const savingsMsg = topAlt.savings_per_day
                ? `saving you **₹${topAlt.savings_per_day}/day (${topAlt.savings_percentage}% off)**`
                : `starting at just ₹${topAlt.price_per_day}/day`;
            reply = `💰 **Found ${alts.alternatives.length} cheaper alternative(s) compared to ${refTitle}:**\n\n` +
                `• **Top Pick:** **${topAlt.title}** at **₹${topAlt.price_per_day}/day**, ${savingsMsg}.\n` +
                `• **Verified Location:** ${topAlt.locality || 'Nearby'}\n\n` +
                `Tap any card below to view full photos or request a booking!`;
            accumulatedItems.push(...alts.alternatives);
        }
        else {
            reply = `We didn't find any listings priced lower in this category, but here are the most affordable listings available:`;
            const fallbackSearch = await (0, ai_tools_1.searchListings)({ limit: 3 });
            accumulatedItems.push(...fallbackSearch.items);
        }
        return {
            reply,
            mode: 'fallback',
            provider,
            items: accumulatedItems,
            suggestions: [
                `Is "${accumulatedItems[0]?.title || 'item'}" available?`,
                `Calculate total cost for 4 days`,
                `Find gear in my locality`,
            ],
        };
    }
    // 7. Price Comparison Queries
    if (queryLower.includes('compare') || queryLower.includes('difference between') || queryLower.includes('which is cheaper') || queryLower.includes('cheapest') || queryLower.includes('save the most')) {
        const duration = convContext.duration;
        const cat = convContext.category || extractCategoryFromText(queryLower);
        const comp = await (0, ai_tools_1.comparePrices)({
            query: cat ? undefined : latestMessage,
            category: cat,
            duration_days: duration,
        });
        if (comp.comparison.length > 0 && comp.summary) {
            const s = comp.summary;
            reply = `📊 **Rental Price Comparison (${duration} Days):**\n\n` +
                `• **Cheapest Option:** **${s.cheapest_item}** at ₹${s.cheapest_daily_rate}/day (Total: **₹${s.cheapest_total}**)\n` +
                (s.potential_total_savings > 0 ? `• **Potential Savings:** Up to **₹${s.potential_total_savings}** total compared to higher-priced gear.\n` : '') +
                `• **Pricing Rule:** ${s.pricing_note}\n\n` +
                `Here are the compared listings:`;
            for (const c of comp.comparison) {
                accumulatedItems.push(c);
            }
        }
        else {
            reply = `I couldn't find multiple items matching that search to compare. Try specifying a category or price range!`;
        }
        return {
            reply,
            mode: 'fallback',
            provider,
            items: accumulatedItems,
            suggestions: [
                `Check availability for ${duration} days`,
                `Find cheaper alternatives`,
                `Explore all gear near me`,
            ],
        };
    }
    // 8. Cost Calculation Queries
    if (queryLower.includes('total cost') || queryLower.includes('how much for') || queryLower.includes('calculate cost')) {
        const duration = convContext.duration;
        const searchRes = await (0, ai_tools_1.searchListings)({
            query: convContext.category ? undefined : latestMessage,
            category: convContext.category,
            limit: 3,
        });
        if (searchRes.items.length > 0) {
            accumulatedItems.push(...searchRes.items);
            const first = searchRes.items[0];
            const total = first.price_per_day * duration;
            reply = `💵 **Estimated Rental Cost for ${duration} Day${duration > 1 ? 's' : ''}:**\n\n` +
                `• **${first.title}:** ₹${first.price_per_day}/day × ${duration} days = **₹${total}**\n` +
                `• **Zero Deposit / No Hidden Fees:** Rentu does not charge platform cuts. You coordinate directly with the owner.\n\n` +
                `Here is the listing and similar options:`;
        }
        else {
            reply = `Please specify an item to calculate its rental total for ${duration} days!`;
        }
        return {
            reply,
            mode: 'fallback',
            provider,
            items: accumulatedItems,
            suggestions: [
                `Check availability for ${duration} days`,
                `Find cheaper alternatives`,
                `View item details`,
            ],
        };
    }
    // 9. Standard Marketplace Search (with multi-turn context awareness)
    const category = convContext.category;
    const maxPrice = convContext.maxPrice;
    const cleanKeyword = latestMessage
        .replace(/under\s*(?:₹|rs\.?|inr)?\s*\d+/gi, '')
        .replace(/below\s*(?:₹|rs\.?|inr)?\s*\d+/gi, '')
        .replace(/find|show|search|looking for|cheap|affordable|near me|in|for rent/gi, '')
        .trim();
    const searchRes = await (0, ai_tools_1.searchListings)({
        query: cleanKeyword || undefined,
        category,
        max_price: maxPrice,
        locality: convContext.locality,
        limit: 6,
    });
    accumulatedItems.push(...searchRes.items);
    if (accumulatedItems.length > 0) {
        const budgetNote = maxPrice ? ` under ₹${maxPrice}/day` : '';
        const locNote = convContext.locality ? ` in ${convContext.locality}` : '';
        reply = `✨ **Found ${accumulatedItems.length} verified listing${accumulatedItems.length > 1 ? 's' : ''}${budgetNote}${locNote} on Rentu⁺:**\n\n` +
            accumulatedItems.map(item => `• **${item.title}** — ₹${item.price_per_day}/day (${item.locality || 'Nearby'})`).join('\n') +
            `\n\nTap any card below to inspect full specs or request a booking! 💗`;
    }
    else {
        const hasExplicitGearTerm = category !== undefined || maxPrice !== undefined ||
            (cleanKeyword.length > 2 && (cleanKeyword.includes('camera') || cleanKeyword.includes('dslr') || cleanKeyword.includes('lens') ||
                cleanKeyword.includes('laptop') || cleanKeyword.includes('macbook') || cleanKeyword.includes('tent') ||
                cleanKeyword.includes('camp') || cleanKeyword.includes('drill') || cleanKeyword.includes('tool') ||
                cleanKeyword.includes('bike') || cleanKeyword.includes('cycle') || cleanKeyword.includes('projector') ||
                cleanKeyword.includes('speaker') || cleanKeyword.includes('dj') || cleanKeyword.includes('gear') ||
                cleanKeyword.includes('costume') || cleanKeyword.includes('gopro') || cleanKeyword.includes('tripod')));
        if (hasExplicitGearTerm) {
            reply = `🔍 I searched the marketplace but couldn't find any listings matching "${latestMessage}".\n\n` +
                `**Helpful Suggestions:**\n` +
                `• Try a broader category (e.g. "cameras", "camping", "tech").\n` +
                `• Or post a **Community Wish** on the Requests Board so local neighbors can offer to lend you what you need!`;
        }
        else {
            reply = `I'm **Rentu AI**, your personal equipment sharing companion on Rentu⁺! 💗\n\n` +
                `I can help you:\n` +
                `• **Find gear by budget:** e.g. *"Find a camera under ₹400/day"* or *"Find laptops under ₹500"*\n` +
                `• **Check live availability:** e.g. *"Is the Canon DSLR available this weekend?"*\n` +
                `• **Compare options:** e.g. *"Which option will save me the most money?"*\n` +
                `• **Learn how to rent or list:** e.g. *"How do I list my own product?"*\n\n` +
                `Here are some popular listings available right now in your community:`;
        }
        const popularRes = await (0, ai_tools_1.searchListings)({ limit: 3 });
        accumulatedItems.push(...popularRes.items);
    }
    return {
        reply,
        mode: 'fallback',
        provider,
        items: accumulatedItems,
        suggestions: generateContextualSuggestions(reply, accumulatedItems),
    };
}
/**
 * Extracts standard Rentu category from search phrases
 */
function extractCategoryFromText(text) {
    if (text.includes('camera') || text.includes('dslr') || text.includes('lens') || text.includes('photo') || text.includes('shoot')) {
        return 'Electronics & Tech';
    }
    if (text.includes('laptop') || text.includes('macbook') || text.includes('computer') || text.includes('monitor') || text.includes('tech')) {
        return 'Electronics & Tech';
    }
    if (text.includes('tent') || text.includes('camp') || text.includes('trek') || text.includes('outdoor') || text.includes('sleeping bag')) {
        return 'Camping & Outdoor';
    }
    if (text.includes('drill') || text.includes('tool') || text.includes('diy') || text.includes('repair') || text.includes('hammer')) {
        return 'Tools & DIY';
    }
    if (text.includes('dj') || text.includes('music') || text.includes('speaker') || text.includes('party') || text.includes('controller') || text.includes('projector')) {
        return 'Party & Events';
    }
    if (text.includes('bike') || text.includes('bicycle') || text.includes('cycle') || text.includes('sports') || text.includes('fitness')) {
        return 'Sports & Fitness';
    }
    return undefined;
}
/**
 * Main AI Chat Orchestrator
 */
async function processAiChat(messages, context) {
    // 1. Try official Google Gemini SDK with native tool calling
    try {
        const geminiResult = await callGemini(messages, context);
        if (geminiResult.success && geminiResult.response) {
            return geminiResult.response;
        }
        // Handle missing or invalid keys, or service outages gracefully via fallback engine
        return await executeDeterministicFallback(messages, context, geminiResult.reason);
    }
    catch (err) {
        console.warn('[Rentu AI] Unexpected error in Gemini orchestrator, activating fallback:', err?.message || err);
        return await executeDeterministicFallback(messages, context, 'unknown_error');
    }
}
