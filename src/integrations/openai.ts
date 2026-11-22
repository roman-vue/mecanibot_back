import OpenAI from 'openai';
import { db } from '../config/database';
import { env } from '../config/env';
import { logger } from '../middlewares/logger.middleware';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: env.OPENAI_TIMEOUT_MS, maxRetries: 1 });

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
}

export function estimateCost({ inputTokens, outputTokens, webSearches }: AiUsage): number {
  const usd =
    (inputTokens / 1_000_000) * env.AI_PRICE_INPUT_PER_M +
    (outputTokens / 1_000_000) * env.AI_PRICE_OUTPUT_PER_M +
    (webSearches / 1000) * env.AI_PRICE_SEARCH_PER_K;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

function recordUsage(cacheKey: string | undefined, usage: AiUsage, costUsd: number): void {
  try {
    db.prepare(
      'INSERT INTO ai_usage (cache_key, model, input_tokens, output_tokens, web_searches, cost_usd) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(cacheKey ?? null, env.OPENAI_MODEL, usage.inputTokens, usage.outputTokens, usage.webSearches, costUsd);
  } catch (err) {
    logger.warn('Could not record AI usage', { err: String(err) });
  }
}

export async function askJson(
  instructions: string,
  prompt: string,
  { webSearch = false, cacheKey }: { webSearch?: boolean; cacheKey?: string } = {},
): Promise<string> {
  const started = Date.now();
  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    instructions,
    input: prompt,
    temperature: 0,
    ...(webSearch ? { tools: [{ type: 'web_search' as const }] } : {}),
  });
  const usage: AiUsage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    webSearches: (response.output ?? []).filter((item) => item.type === 'web_search_call').length,
  };
  const costUsd = estimateCost(usage);
  recordUsage(cacheKey, usage, costUsd);
  logger.info('OpenAI request completed', { model: env.OPENAI_MODEL, webSearch, ms: Date.now() - started, ...usage, costUsd });
  return response.output_text ?? '';
}
