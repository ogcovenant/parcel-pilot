import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export const AppConfigSchema = z.object({
  port: z.coerce.number().default(3000),
  nodeEnv: z.string().default('development'),
  datasetAsOf: z.string().default('2026-08-16T11:00:00+05:30'),
  datasetTimezone: z.string().default('Asia/Kolkata'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export default registerAs('app', (): AppConfig => {
  const parsed = AppConfigSchema.parse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    datasetAsOf: process.env.DATASET_AS_OF,
    datasetTimezone: process.env.DATASET_TIMEZONE,
  });
  return parsed;
});
