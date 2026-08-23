import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('app');
  const port = appConfig?.port ?? 3000;
  await app.listen(port);
  console.log(`ParcelPilot API running on :${port}`);
}
void bootstrap();
