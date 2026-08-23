import appConfig from './app.config';
import databaseConfig from './database.config';
import aiConfig from './ai.config';

export const config = [appConfig, databaseConfig, aiConfig];
export type { AppConfig } from './app.config';
export type { DatabaseConfig } from './database.config';
export type { AiConfig } from './ai.config';