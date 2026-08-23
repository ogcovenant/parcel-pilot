import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escalation } from './escalation.entity';
import { FollowUpTask } from './follow-up-task.entity';
import { TicketUpdate } from './ticket-update.entity';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Escalation, FollowUpTask, TicketUpdate])],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
