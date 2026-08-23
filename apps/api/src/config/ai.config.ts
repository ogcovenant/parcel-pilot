import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const AiConfigSchema = z.object({
  openRouterApiKey: z.string().default(''),
  model: z.string().default('google/gemini-2.5-flash'),
  embeddingModel: z.string().default('openai/text-embedding-3-small'),
  maxToolRounds: z.coerce.number().default(10),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

export default registerAs('ai', (): AiConfig => {
  const parsed = AiConfigSchema.parse({
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
    embeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL,
    maxToolRounds: process.env.AGENT_MAX_TOOL_ROUNDS,
  });
  return parsed;
});