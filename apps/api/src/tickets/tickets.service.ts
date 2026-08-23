import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Ticket } from './ticket.entity';
import { Account } from '../accounts/account.entity';
import { SlaService } from '../sla/sla.service';
import { SeverityClassifier } from '../sla/severity-classifier';
import { policyOverrideFor } from '../policy/policy-overrides';

export interface TicketDetail {
  ticketId: string;
  accountId: string;
  orderId: string | null;
  createdAt: string;
  status: string;
  severity: string | null;
  subject: string;
  description: string;
  channel: string;
  assignedTo: string;
  lastCustomerMessageAt: string | null;
  historicalResolution: string | null;
  slaDueAt: string | null;
}

@Injectable()
export class TicketsService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
    private readonly slaService: SlaService,
    private readonly classifier: SeverityClassifier,
  ) {}

  private repo() {
    return this.dataSource.getRepository(Ticket);
  }

  async findByTicketId(ticketId: string): Promise<Ticket | null> {
    return this.repo().findOne({
      where: { ticketId },
      relations: { account: true, order: true },
    });
  }

  async findAll(): Promise<Ticket[]> {
    return this.repo().find({ relations: { account: true, order: true } });
  }

  async findByAccount(accountId: string): Promise<Ticket[]> {
    return this.repo().find({
      relations: { account: true, order: true },
      where: { account: { accountId } },
    });
  }

  async accountIdForTicket(ticketId: string): Promise<string | null> {
    const ticket = await this.findByTicketId(ticketId);
    return ticket?.account?.accountId ?? null;
  }

  /** Deterministic severity + SLA computation for a ticket. */
  computeSla(ticket: Ticket): string | null {
    const account = ticket.account as Account;
    if (!account) return null;
    const override = policyOverrideFor(account.accountId);
    const severity =
      ticket.severity ??
      this.classifier.classify(ticket.subject, ticket.description);
    return this.slaService
      .computeSlaDue(ticket.createdAt, account.plan, severity, override?.sla)
      .toISOString();
  }

  toDetail(ticket: Ticket): TicketDetail {
    const account = ticket.account as Account;
    return {
      ticketId: ticket.ticketId,
      accountId: account?.accountId,
      orderId: ticket.order?.orderId ?? null,
      createdAt: ticket.createdAt.toISOString(),
      status: ticket.status,
      severity: ticket.severity,
      subject: ticket.subject,
      description: ticket.description,
      channel: ticket.channel,
      assignedTo: ticket.assignedTo,
      lastCustomerMessageAt:
        ticket.lastCustomerMessageAt?.toISOString() ?? null,
      historicalResolution: ticket.historicalResolution ?? null,
      slaDueAt: ticket.slaDueAt ? ticket.slaDueAt.toISOString() : null,
    };
  }
}
