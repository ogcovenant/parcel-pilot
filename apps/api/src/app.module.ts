import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { config } from './config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './ai/ai.module';
import { AccountsModule } from './accounts/accounts.module';
import { OrdersModule } from './orders/orders.module';
import { TicketsModule } from './tickets/tickets.module';
import { DocumentsModule } from './documents/documents.module';
import { AuthModule } from './auth/auth.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { ActionsModule } from './actions/actions.module';
import { IssuesModule } from './issues/issues.module';
import { AgentModule } from './agent/agent.module';

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
        return {
          type: 'postgres',
          host: database?.dbHost,
          port: database?.dbPort,
          username: database?.dbUser,
          password: database?.dbPassword,
          database: database?.dbName,
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
    DatabaseModule,
    AiModule,
    AuthModule,
    AccountsModule,
    OrdersModule,
    TicketsModule,
    DocumentsModule,
    RetrievalModule,
    ActionsModule,
    IssuesModule,
    AgentModule,
  ],
})
export class AppModule {}
