import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseConfig } from '../config/database.config';
import { AppConfig } from '../config/app.config';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

const databaseProviders = [
  {
    provide: DATABASE_CONNECTION,
    useFactory: async (configService: ConfigService): Promise<DataSource> => {
      const database = configService.get<DatabaseConfig>('database');
      const app = configService.get<AppConfig>('app');
      if (!database) throw new Error('Database config missing');

      const dataSource = new DataSource({
        type: 'postgres',
        host: database.dbHost,
        port: database.dbPort,
        username: database.dbUser,
        password: database.dbPassword,
        database: database.dbName,
        entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
        synchronize: false,
      });

      await dataSource.initialize();

      const schemaPath = join(__dirname, 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');
      await dataSource.query(schemaSql);

      if (app?.nodeEnv !== 'test') {
        console.log('[db] initialized and schema ensured');
      }
      return dataSource;
    },
    inject: [ConfigService],
  },
];

@Global()
@Module({
  imports: [ConfigModule],
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule {}
