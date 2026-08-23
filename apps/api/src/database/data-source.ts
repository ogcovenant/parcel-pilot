import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'parelpilot',
  password: process.env.DB_PASSWORD ?? 'parelpilot_dev',
  database: process.env.DB_NAME ?? 'parcel_pilot',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
});
