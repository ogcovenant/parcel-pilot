import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
}

export default registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT as string) || 3000,
  nodeEnv: process.env.NODE_ENV as string,
}));
