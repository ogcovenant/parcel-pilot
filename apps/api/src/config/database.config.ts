import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const DatabaseConfigSchema = z.object({
  dbHost: z.string().default('localhost'),
  dbPort: z.coerce.number().default(5432),
  dbUser: z.string().default('parelpilot'),
  dbPassword: z.string().default('parelpilot_dev'),
  dbName: z.string().default('parcel_pilot'),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

export default registerAs('database', (): DatabaseConfig => {
  const parsed = DatabaseConfigSchema.parse({
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
  });
  return parsed;
});
