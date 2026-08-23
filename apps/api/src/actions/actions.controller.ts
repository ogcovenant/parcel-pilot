import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ActionsService } from './actions.service';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '../auth/user.decorator';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('escalations')
  listEscalations() {
    return this.actionsService.listEscalations();
  }

  @Get('follow-ups')
  listFollowUps() {
    return this.actionsService.listFollowUpTasks();
  }

  @Get('ticket-updates')
  listTicketUpdates() {
    return this.actionsService.listTicketUpdates();
  }

  @Post('escalations')
  prepareEscalation(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: User,
  ) {
    return this.actionsService.prepareEscalation(user, {
      ticketId: body.ticketId as string | undefined,
      accountId: body.accountId as string | undefined,
      priority: body.priority as string,
      targetTeam: body.targetTeam as string,
      reason: body.reason as string,
      evidence: (body.evidence as Record<string, unknown>[]) ?? [],
    });
  }

  @Post('escalations/execute')
  executeEscalation(
    @Body() body: { escalationId: string; confirmed: boolean },
    @CurrentUser() user: User,
  ) {
    if (!body.escalationId)
      throw new BadRequestException('escalationId is required');
    return this.actionsService.executeEscalation(
      user,
      body.escalationId,
      body.confirmed,
    );
  }

  @Post('follow-ups')
  prepareFollowUp(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: User,
  ) {
    return this.actionsService.prepareFollowUpTask(user, {
      ticketId: body.ticketId as string | undefined,
      assignee: body.assignee as string,
      dueAt: body.dueAt as string | undefined,
      description: body.description as string,
    });
  }

  @Post('follow-ups/execute')
  executeFollowUp(
    @Body() body: { taskId: string; confirmed: boolean },
    @CurrentUser() user: User,
  ) {
    if (!body.taskId) throw new BadRequestException('taskId is required');
    return this.actionsService.executeFollowUpTask(
      user,
      body.taskId,
      body.confirmed,
    );
  }

  @Post('ticket-updates')
  prepareTicketUpdate(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: User,
  ) {
    return this.actionsService.prepareTicketUpdate(user, {
      ticketId: body.ticketId as string,
      kind: body.kind as 'note' | 'status_change',
      note: body.note as string | undefined,
    });
  }

  @Post('ticket-updates/execute')
  executeTicketUpdate(
    @Body() body: { updateId: string; confirmed: boolean },
    @CurrentUser() user: User,
  ) {
    if (!body.updateId) throw new BadRequestException('updateId is required');
    return this.actionsService.executeTicketUpdate(
      user,
      body.updateId,
      body.confirmed,
    );
  }
}
