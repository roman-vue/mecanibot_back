import { describe, expect, it, vi } from 'vitest';

vi.mock('openai', () => ({
  default: class {
    responses = {
      create: vi.fn(async () => ({
        output_text: '{"tasks":[]}',
        output: [{ type: 'web_search_call' }, { type: 'message' }],
        usage: { input_tokens: 8000, output_tokens: 600 },
      })),
    };
  },
}));
import { askJson, estimateCost } from '../src/integrations/openai';
import { db } from '../src/config/database';

describe('AI cost', () => {
  it('prices tokens only', () => {
    expect(estimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000, webSearches: 0 })).toBe(2);
  });

  it('adds web search calls', () => {
    expect(estimateCost({ inputTokens: 0, outputTokens: 0, webSearches: 1 })).toBe(0.01);
  });

  it('rounds to millionths of a dollar', () => {
    expect(estimateCost({ inputTokens: 8655, outputTokens: 0, webSearches: 0 })).toBe(0.003462);
  });

  it('records each call with its cost', async () => {
    await askJson('i', 'p', { webSearch: true, cacheKey: '1|tvs raider 125' });
    const row = db.prepare('SELECT * FROM ai_usage WHERE cache_key = ?').get('1|tvs raider 125') as Record<string, unknown>;
    expect(row).toMatchObject({ input_tokens: 8000, output_tokens: 600, web_searches: 1, cost_usd: 0.01416 });
  });
});
