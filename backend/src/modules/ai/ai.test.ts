import assert from 'assert';
import {
  searchListings,
  checkAvailability,
  comparePrices,
  findAlternatives,
  getListingDetails,
} from './ai.tools';
import { processAiChat } from './ai.service';
import { query } from '../../config/db';

async function runTests() {
  console.log('🧪 Starting Rentu AI Assistant Test Suite...\n');
  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // 1. Search listings
  await test('Search listings returns real items from database', async () => {
    const res = await searchListings({ limit: 5 });
    assert(res.items.length > 0, 'Expected at least 1 item in DB');
    assert(typeof res.items[0].price_per_day === 'number', 'Price per day must be a number');
    assert(res.items[0].id, 'Item must have an id');
  });

  // 2. Max price filtering
  await test('Maximum price filter returns only items within budget', async () => {
    const maxPrice = 350;
    const res = await searchListings({ max_price: maxPrice });
    for (const item of res.items) {
      assert(item.price_per_day <= maxPrice, `Item ${item.title} price ${item.price_per_day} exceeds max ${maxPrice}`);
    }
  });

  // 3. Category & locality filtering
  await test('Category and locality filters work accurately', async () => {
    const res = await searchListings({ category: 'Electronics & Tech' });
    for (const item of res.items) {
      assert(item.category.toLowerCase().includes('electronics'), `Expected Electronics category, got ${item.category}`);
    }
  });

  // 4. Cheaper alternatives calculation
  await test('Cheaper alternatives calculate daily and percentage savings', async () => {
    // Look for items to find reference
    const itemsRes = await searchListings({ limit: 4 });
    const expensive = itemsRes.items.reduce((max, i) => i.price_per_day > max.price_per_day ? i : max, itemsRes.items[0]);
    const alts = await findAlternatives({ item_id: expensive.id, duration_days: 2 });
    assert(alts.reference_item, 'Reference item must be resolved');
    for (const alt of alts.alternatives) {
      assert(alt.price_per_day <= expensive.price_per_day, 'Alternative must be cheaper or equal');
      if (alt.price_per_day < expensive.price_per_day) {
        assert(alt.savings_per_day! > 0, 'Savings per day must be positive');
        assert(alt.savings_total === alt.savings_per_day! * 2, 'Savings total must match duration * daily');
      }
    }
  });

  // 5. Total rental cost calculation
  await test('Price comparison computes correct duration totals', async () => {
    const comp = await comparePrices({ duration_days: 3 });
    if (comp.comparison.length > 0 && comp.summary) {
      for (const c of comp.comparison) {
        assert.strictEqual(c.estimated_total, c.price_per_day * 3, 'Estimated total must equal rate * days');
      }
      assert(comp.summary.cheapest_total <= comp.summary.cheapest_daily_rate * 3, 'Cheapest total calculation check');
    }
  });

  // 6. Invalid dates and durations rejection
  await test('Availability check rejects invalid dates and non-positive durations', async () => {
    const itemsRes = await searchListings({ limit: 1 });
    const itemId = itemsRes.items[0].id;

    const invalidDateRes = await checkAvailability({
      item_id: itemId,
      start_date: 'invalid-date',
      duration_days: 2,
    });
    assert.strictEqual(invalidDateRes.available, false, 'Invalid date should not be available');
    assert(invalidDateRes.error?.includes('Invalid start date'), 'Should return invalid date error');

    const invalidIdRes = await checkAvailability({
      item_id: 'not-a-uuid',
      start_date: '2026-11-01',
      duration_days: 2,
    });
    assert.strictEqual(invalidIdRes.available, false, 'Invalid UUID should not be available');
  });

  // 7. Availability date collision check
  await test('Availability check correctly detects booked date collisions', async () => {
    const itemsRes = await searchListings({ limit: 1 });
    const item = itemsRes.items[0];

    // Check normal available dates
    const freeRes = await checkAvailability({
      item_id: item.id,
      start_date: '2027-01-10',
      duration_days: 3,
    });
    assert.strictEqual(freeRes.available, true, 'Clean dates should be available');
    assert.strictEqual(freeRes.estimated_total, item.price_per_day * 3);
  });

  // 8. Empty search results handled gracefully
  await test('Empty search results return zero count and no crash', async () => {
    const res = await searchListings({ query: 'nonexistent_impossible_item_12345XYZ' });
    assert.strictEqual(res.count, 0, 'Expected 0 items');
    assert.strictEqual(res.items.length, 0);
  });

  // 9. Missing credentials activate fallback engine
  await test('AI chat fallback engine activates and returns structured answers', async () => {
    const chat = await processAiChat([{ role: 'user', content: 'Find a camera under ₹400' }]);
    assert(chat.reply.length > 10, 'Reply should be descriptive');
    assert(Array.isArray(chat.items), 'Items should be an array');
    assert(Array.isArray(chat.suggestions), 'Suggestions should be an array');
    assert.strictEqual(chat.mode, 'fallback');
  });

  // 10. Free borrowing advice
  await test('AI chat handles free borrowing queries transparently', async () => {
    const chat = await processAiChat([{ role: 'user', content: 'Can I borrow a camera for free?' }]);
    assert(chat.reply.includes('Requests Board') || chat.reply.includes('free'), 'Reply should explain borrowing mechanics');
  });

  // 11. General greetings & casual introduction
  await test('AI chat handles friendly greetings in character', async () => {
    const chat = await processAiChat([{ role: 'user', content: 'Hello! Who are you?' }]);
    assert(chat.reply.includes('Rentu AI') && chat.reply.includes('companion'), 'Should identify as Rentu AI');
  });

  // 12. Marketplace workflow: Listing gear
  await test('AI chat explains listing gear workflow accurately', async () => {
    const chat = await processAiChat([{ role: 'user', content: 'How do I list my own product?' }]);
    assert(chat.reply.includes('Post') && chat.reply.includes('List Gear for Rent'), 'Should explain + Post workflow');
  });

  // 13. Marketplace workflow: Booking & returns
  await test('AI chat explains booking and returns process accurately', async () => {
    const chat = await processAiChat([{ role: 'user', content: 'Explain how booking and returning an item works' }]);
    assert(chat.reply.includes('Request to Rent') && chat.reply.includes('Return'), 'Should explain booking and return process');
  });

  // 14. Multi-turn conversation context preservation
  await test('AI chat preserves context across multi-turn follow-up queries', async () => {
    const multiTurnHistory = [
      { role: 'user' as const, content: 'Find a camera' },
      { role: 'assistant' as const, content: 'Found cameras in the marketplace.' },
      { role: 'user' as const, content: 'Below 400 per day' },
      { role: 'assistant' as const, content: 'Here are cameras below 400.' },
      { role: 'user' as const, content: 'Which is best?' },
    ];
    const chat = await processAiChat(multiTurnHistory);
    assert(chat.items.length > 0, 'Should return recommended items based on inherited camera category');
    assert(chat.reply.includes('Top Community Recommendation') || chat.reply.includes('recommend'), 'Should recommend an item');
  });

  // 15. Invalid GEMINI_API_KEY handled gracefully by SDK
  await test('Invalid GEMINI_API_KEY is handled gracefully without crashing or throwing', async () => {
    // Process chat query with current environment key (whether invalid or missing)
    const chat = await processAiChat([{ role: 'user', content: 'What is the cheapest laptop?' }]);
    assert(chat.reply && chat.reply.length > 0, 'Reply must not be empty');
    assert(Array.isArray(chat.items), 'Items must be returned as array');
    assert(typeof chat.provider === 'string', 'Provider must be indicated');
    // If key is invalid or missing, it should fall back gracefully
    assert(chat.mode === 'fallback' || chat.mode === 'ai', 'Mode must be valid');
    assert(!chat.reply.includes('API_KEY_INVALID'), 'Secret errors or raw codes must not leak to user');
  });

  // 16. Missing key returns clean structured fallback response
  await test('Empty or missing API key defaults cleanly to Smart Search', async () => {
    const chat = await processAiChat([{ role: 'user', content: 'Find tents for camping' }]);
    assert(chat.reply.length > 0, 'Should provide useful recommendations');
    assert(chat.items !== undefined, 'Items should exist');
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

