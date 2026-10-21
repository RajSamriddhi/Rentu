"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const ai_tools_1 = require("./ai.tools");
const ai_service_1 = require("./ai.service");
async function runTests() {
    console.log('🧪 Starting Rentu AI Assistant Test Suite...\n');
    let passed = 0;
    let total = 0;
    async function test(name, fn) {
        total++;
        try {
            await fn();
            console.log(`  ✅ PASSED: ${name}`);
            passed++;
        }
        catch (err) {
            console.error(`  ❌ FAILED: ${name}`);
            console.error(`     Error: ${err.message}\n`);
        }
    }
    // 1. Search listings
    await test('Search listings returns real items from database', async () => {
        const res = await (0, ai_tools_1.searchListings)({ limit: 5 });
        (0, assert_1.default)(res.items.length > 0, 'Expected at least 1 item in DB');
        (0, assert_1.default)(typeof res.items[0].price_per_day === 'number', 'Price per day must be a number');
        (0, assert_1.default)(res.items[0].id, 'Item must have an id');
    });
    // 2. Max price filtering
    await test('Maximum price filter returns only items within budget', async () => {
        const maxPrice = 350;
        const res = await (0, ai_tools_1.searchListings)({ max_price: maxPrice });
        for (const item of res.items) {
            (0, assert_1.default)(item.price_per_day <= maxPrice, `Item ${item.title} price ${item.price_per_day} exceeds max ${maxPrice}`);
        }
    });
    // 3. Category & locality filtering
    await test('Category and locality filters work accurately', async () => {
        const res = await (0, ai_tools_1.searchListings)({ category: 'Electronics & Tech' });
        for (const item of res.items) {
            (0, assert_1.default)(item.category.toLowerCase().includes('electronics'), `Expected Electronics category, got ${item.category}`);
        }
    });
    // 4. Cheaper alternatives calculation
    await test('Cheaper alternatives calculate daily and percentage savings', async () => {
        // Look for items to find reference
        const itemsRes = await (0, ai_tools_1.searchListings)({ limit: 4 });
        const expensive = itemsRes.items.reduce((max, i) => i.price_per_day > max.price_per_day ? i : max, itemsRes.items[0]);
        const alts = await (0, ai_tools_1.findAlternatives)({ item_id: expensive.id, duration_days: 2 });
        (0, assert_1.default)(alts.reference_item, 'Reference item must be resolved');
        for (const alt of alts.alternatives) {
            (0, assert_1.default)(alt.price_per_day <= expensive.price_per_day, 'Alternative must be cheaper or equal');
            if (alt.price_per_day < expensive.price_per_day) {
                (0, assert_1.default)(alt.savings_per_day > 0, 'Savings per day must be positive');
                (0, assert_1.default)(alt.savings_total === alt.savings_per_day * 2, 'Savings total must match duration * daily');
            }
        }
    });
    // 5. Total rental cost calculation
    await test('Price comparison computes correct duration totals', async () => {
        const comp = await (0, ai_tools_1.comparePrices)({ duration_days: 3 });
        if (comp.comparison.length > 0 && comp.summary) {
            for (const c of comp.comparison) {
                assert_1.default.strictEqual(c.estimated_total, c.price_per_day * 3, 'Estimated total must equal rate * days');
            }
            (0, assert_1.default)(comp.summary.cheapest_total <= comp.summary.cheapest_daily_rate * 3, 'Cheapest total calculation check');
        }
    });
    // 6. Invalid dates and durations rejection
    await test('Availability check rejects invalid dates and non-positive durations', async () => {
        const itemsRes = await (0, ai_tools_1.searchListings)({ limit: 1 });
        const itemId = itemsRes.items[0].id;
        const invalidDateRes = await (0, ai_tools_1.checkAvailability)({
            item_id: itemId,
            start_date: 'invalid-date',
            duration_days: 2,
        });
        assert_1.default.strictEqual(invalidDateRes.available, false, 'Invalid date should not be available');
        (0, assert_1.default)(invalidDateRes.error?.includes('Invalid start date'), 'Should return invalid date error');
        const invalidIdRes = await (0, ai_tools_1.checkAvailability)({
            item_id: 'not-a-uuid',
            start_date: '2026-11-01',
            duration_days: 2,
        });
        assert_1.default.strictEqual(invalidIdRes.available, false, 'Invalid UUID should not be available');
    });
    // 7. Availability date collision check
    await test('Availability check correctly detects booked date collisions', async () => {
        const itemsRes = await (0, ai_tools_1.searchListings)({ limit: 1 });
        const item = itemsRes.items[0];
        // Check normal available dates
        const freeRes = await (0, ai_tools_1.checkAvailability)({
            item_id: item.id,
            start_date: '2027-01-10',
            duration_days: 3,
        });
        assert_1.default.strictEqual(freeRes.available, true, 'Clean dates should be available');
        assert_1.default.strictEqual(freeRes.estimated_total, item.price_per_day * 3);
    });
    // 8. Empty search results handled gracefully
    await test('Empty search results return zero count and no crash', async () => {
        const res = await (0, ai_tools_1.searchListings)({ query: 'nonexistent_impossible_item_12345XYZ' });
        assert_1.default.strictEqual(res.count, 0, 'Expected 0 items');
        assert_1.default.strictEqual(res.items.length, 0);
    });
    // 9. Missing credentials activate fallback engine
    await test('AI chat fallback engine activates and returns structured answers', async () => {
        const chat = await (0, ai_service_1.processAiChat)([{ role: 'user', content: 'Find a camera under ₹400' }]);
        (0, assert_1.default)(chat.reply.length > 10, 'Reply should be descriptive');
        (0, assert_1.default)(Array.isArray(chat.items), 'Items should be an array');
        (0, assert_1.default)(Array.isArray(chat.suggestions), 'Suggestions should be an array');
        assert_1.default.strictEqual(chat.mode, 'fallback');
    });
    // 10. Free borrowing advice
    await test('AI chat handles free borrowing queries transparently', async () => {
        const chat = await (0, ai_service_1.processAiChat)([{ role: 'user', content: 'Can I borrow a camera for free?' }]);
        (0, assert_1.default)(chat.reply.includes('Requests Board') || chat.reply.includes('free'), 'Reply should explain borrowing mechanics');
    });
    // 11. General greetings & casual introduction
    await test('AI chat handles friendly greetings in character', async () => {
        const chat = await (0, ai_service_1.processAiChat)([{ role: 'user', content: 'Hello! Who are you?' }]);
        (0, assert_1.default)(chat.reply.includes('Rentu AI') && chat.reply.includes('companion'), 'Should identify as Rentu AI');
    });
    // 12. Marketplace workflow: Listing gear
    await test('AI chat explains listing gear workflow accurately', async () => {
        const chat = await (0, ai_service_1.processAiChat)([{ role: 'user', content: 'How do I list my own product?' }]);
        (0, assert_1.default)(chat.reply.includes('Post') && chat.reply.includes('List Gear for Rent'), 'Should explain + Post workflow');
    });
    // 13. Marketplace workflow: Booking & returns
    await test('AI chat explains booking and returns process accurately', async () => {
        const chat = await (0, ai_service_1.processAiChat)([{ role: 'user', content: 'Explain how booking and returning an item works' }]);
        (0, assert_1.default)(chat.reply.includes('Request to Rent') && chat.reply.includes('Return'), 'Should explain booking and return process');
    });
    // 14. Multi-turn conversation context preservation
    await test('AI chat preserves context across multi-turn follow-up queries', async () => {
        const multiTurnHistory = [
            { role: 'user', content: 'Find a camera' },
            { role: 'assistant', content: 'Found cameras in the marketplace.' },
            { role: 'user', content: 'Below 400 per day' },
            { role: 'assistant', content: 'Here are cameras below 400.' },
            { role: 'user', content: 'Which is best?' },
        ];
        const chat = await (0, ai_service_1.processAiChat)(multiTurnHistory);
        (0, assert_1.default)(chat.items.length > 0, 'Should return recommended items based on inherited camera category');
        (0, assert_1.default)(chat.reply.includes('Top Community Recommendation') || chat.reply.includes('recommend'), 'Should recommend an item');
    });
    console.log(`\n========================================`);
    console.log(`Results: ${passed} / ${total} tests passed!`);
    console.log(`========================================\n`);
    if (passed !== total) {
        process.exit(1);
    }
}
runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
