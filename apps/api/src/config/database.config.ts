import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
}

export default registerAs('database', (): DatabaseConfig => ({
  dbHost: process.env.DB_HOST as string,
  dbPort: parseInt(process.env.DB_PORT as string),
  dbName: process.env.DB_NAME as string,
  dbPassword: process.env.DB_PASSWORD as string,
  dbUser: process.env.DB_USER as string,
}));
