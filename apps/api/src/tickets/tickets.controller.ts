import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AccessControlService } from '../auth/access-control.service';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '../auth/user.decorator';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  async list(
    @Query('accountId') accountId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('severity') severity: string | undefined,
    @CurrentUser() user: User,
  ) {
    if (accountId) {
      const access = this.accessControl.canAccessAccount(user, accountId);
      if (!access.allowed) throw new ForbiddenException(access.reason);
      const tickets = await this.ticketsService.findByAccount(accountId);
      return tickets.map((t) => this.ticketsService.toDetail(t));
    }
    if (user.accountId !== null) {
      const tickets = await this.ticketsService.findByAccount(user.accountId);
      return tickets.map((t) => this.ticketsService.toDetail(t));
    }
    const tickets = await this.ticketsService.findAll();
    return tickets.map((t) => this.ticketsService.toDetail(t));
  }

  @Get(':ticketId')
  async get(@Param('ticketId') ticketId: string, @CurrentUser() user: User) {
    const ticket = await this.ticketsService.findByTicketId(ticketId);
    if (!ticket) return { found: false, ticketId };
    const access = this.accessControl.canAccessAccount(
      user,
      ticket.account.accountId,
    );
    if (!access.allowed) throw new ForbiddenException(access.reason);
    return this.ticketsService.toDetail(ticket);
  }
}
