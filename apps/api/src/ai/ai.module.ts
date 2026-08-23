import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { AiProvider, AI_PROVIDER, AiProviderInstance } from './ai.provider';
import { AiConfig } from '../config/ai.config';

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (configService: ConfigService): AiProviderInstance => {
        const config = configService.get<AiConfig>('ai');
        return createOpenRouter({ apiKey: config?.openRouterApiKey ?? '' });
      },
      inject: [ConfigService],
    },
    AiProvider,
  ],
  exports: [AiProvider],
})
export class AiModule {}