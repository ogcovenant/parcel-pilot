import { Module } from '@nestjs/common';
import { ToolRegistry } from './tools/tool-registry';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { OrdersModule } from '../orders/orders.module';
import { TicketsModule } from '../tickets/tickets.module';
import { DocumentsModule } from '../documents/documents.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { CalculationsModule } from '../calculations/calculations.module';
import { SlaModule } from '../sla/sla.module';
import { ActionsModule } from '../actions/actions.module';
import { IssuesModule } from '../issues/issues.module';

@Module({
  imports: [
    AccountsModule,
    OrdersModule,
    TicketsModule,
    DocumentsModule,
    RetrievalModule,
    CalculationsModule,
    SlaModule,
    ActionsModule,
    IssuesModule,
  ],
  controllers: [AgentController],
  providers: [ToolRegistry, AgentService],
  exports: [AgentService],
})
export class AgentModule {}
