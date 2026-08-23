import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config } from './config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from './config/database.config';
import { AppConfig } from './config/app.config';
import { join } from 'node:path';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: config,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const database = configService.get<DatabaseConfig>('database');
        const app = configService.get<AppConfig>('app');
        const isDevelopment = app?.nodeEnv === 'developmemt';

        return {
          type: 'postgres',
          host: database?.dbHost,
          port: database?.dbPort,
          username: database?.dbUser,
          password: database?.dbPassword,
          database: database?.dbName,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: !isDevelopment,
          migrationsTableName: 'migrations',
          migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
        };
      },
    }),
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
