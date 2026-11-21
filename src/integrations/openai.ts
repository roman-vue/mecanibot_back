import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../middlewares/logger.middleware';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: env.OPENAI_TIMEOUT_MS, maxRetries: 1 });

export async function askJson(instructions: string, prompt: string, { webSearch = false } = {}): Promise<string> {
  const started = Date.now();
  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    instructions,
    input: prompt,
    temperature: 0,
    ...(webSearch ? { tools: [{ type: 'web_search' as const }] } : {}),
  });
  logger.info('OpenAI request completed', {
    model: env.OPENAI_MODEL,
    webSearch,
    ms: Date.now() - started,
    tokens: response.usage?.total_tokens,
  });
  return response.output_text ?? '';
}
