import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embed, embedMany } from 'ai';
import type { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { AiConfig } from '../config/ai.config';

export const AI_PROVIDER = 'AI_PROVIDER';

/**
 * OpenRouter-backed AI provider built on the Vercel AI SDK.
 * Provides chat and embedding models through one API key and base URL.
 * Swap providers by changing the model factory here.
 */
@Injectable()
export class AiProvider {
  constructor(
    @Inject(AI_PROVIDER) private readonly client: AiProviderInstance,
    private readonly configService: ConfigService,
  ) {}

  private config(): AiConfig {
    return this.configService.get<AiConfig>('ai')!;
  }

  private requireKey(): void {
    const config = this.config();
    if (!config.openRouterApiKey) {
      throw new Error(
        'OPENROUTER_API_KEY is not set. Set it in apps/api/.env to enable the agent and retrieval.',
      );
    }
  }

  model(): ReturnType<AiProviderInstance['chat']> {
    this.requireKey();
    return this.client.chat(this.config().model);
  }

  private embeddingModel() {
    return this.client.textEmbeddingModel(this.config().embeddingModel);
  }

  async embedText(text: string): Promise<number[]> {
    this.requireKey();
    const { embedding } = await embed({
      model: this.embeddingModel(),
      value: text,
    });
    return embedding;
  }

  async embedManyTexts(texts: string[]): Promise<number[][]> {
    this.requireKey();
    const result = await embedMany({
      model: this.embeddingModel(),
      values: texts,
    });
    return result.embeddings;
  }
}

export type AiProviderInstance = ReturnType<typeof createOpenRouter>;