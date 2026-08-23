import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Ticket } from '../tickets/ticket.entity';
import { Order } from '../orders/order.entity';
import { IssueCluster } from './issue-cluster.entity';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';

export interface DetectedIssue {
  type: string;
  title: string;
  severity: 'P1' | 'P2' | 'P3';
  confidence: number;
  affectedCustomerIds: string[];
  relatedTicketIds: string[];
  relatedOrderIds: string[];
  summary: string;
}

interface ThemeGroup {
  pattern: RegExp;
  title: string;
  severity: 'P1' | 'P2' | 'P3';
}

const THEMES: ThemeGroup[] = [
  {
    pattern: /bulk upload|csv/i,
    title: 'Bulk CSV upload failures (possible KI-208)',
    severity: 'P2',
  },
  {
    pattern: /swiftship|webhook|still shows book/i,
    title: 'SwiftShip pickup webhook / status delay (possible KI-211)',
    severity: 'P2',
  },
  {
    pattern: /all shipment creation|http 500|cannot create.*shipment/i,
    title: 'Shipment creation failures',
    severity: 'P1',
  },
  {
    pattern: /api key|credential|security|breach/i,
    title: 'Security / credential exposure',
    severity: 'P1',
  },
  {
    pattern: /billing contact|change.*(email|contact)/i,
    title: 'Account administration requests',
    severity: 'P3',
  },
];

const SEVERITY_ORDER: Record<string, number> = { P1: 3, P2: 2, P3: 1 };

/**
 * Deterministic, explainable issue detection. Produces hypotheses only; the
 * agent verifies them during investigation. Uses SQL + keyword themes + thresholds.
 */
@Injectable()
export class IssuesService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async detectIssues(): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const now = this.asOf();

    issues.push(...(await this.detectSlaRisks(now)));
    issues.push(...(await this.detectRecurringAndCrossCustomer(now)));
    issues.push(...(await this.detectUnusualActivity(now)));

    return issues;
  }

  async saveIssues(issues: DetectedIssue[]): Promise<IssueCluster[]> {
    const repo = this.dataSource.getRepository(IssueCluster);
    const saved: IssueCluster[] = [];
    for (const issue of issues) {
      const existing = await repo.findOne({
        where: { type: issue.type, status: 'open', title: issue.title },
      });
      if (existing) {
        existing.confidence = issue.confidence.toString();
        existing.affectedCustomers = issue.affectedCustomerIds.map((id) => ({
          accountId: id,
        }));
        existing.relatedTickets = issue.relatedTicketIds.map((id) => ({
          ticketId: id,
        }));
        existing.relatedOrders = issue.relatedOrderIds.map((id) => ({
          orderId: id,
        }));
        existing.summary = issue.summary;
        saved.push(await repo.save(existing));
        continue;
      }
      const cluster = repo.create({
        issueId: `ISS-${Math.floor(1000 + Math.random() * 9000)}`,
        type: issue.type,
        title: issue.title,
        severity: issue.severity,
        confidence: issue.confidence.toString(),
        affectedCustomers: issue.affectedCustomerIds.map((id) => ({
          accountId: id,
        })),
        relatedTickets: issue.relatedTicketIds.map((id) => ({ ticketId: id })),
        relatedOrders: issue.relatedOrderIds.map((id) => ({ orderId: id })),
        summary: issue.summary,
        detectedAt: new Date(),
        status: 'open',
      });
      saved.push(await repo.save(cluster));
    }
    return saved;
  }

  async listIssues(): Promise<IssueCluster[]> {
    return this.dataSource.getRepository(IssueCluster).find({
      order: { detectedAt: 'DESC' },
    });
  }

  private async detectSlaRisks(now: Date): Promise<DetectedIssue[]> {
    const result = (await this.dataSource.query(
      `SELECT t.ticket_id, t.account_id, t.severity, t.sla_due_at, t.created_at, a.account_name, a.account_id AS acct
       FROM tickets t
       JOIN accounts a ON a.id = t.account_id
       WHERE t.status = 'open' AND t.sla_due_at IS NOT NULL`,
    )) as Array<{
      ticket_id: string;
      account_id: string;
      severity: string;
      sla_due_at: string;
      acct: string;
    }>;

    const overdue = result.filter((r) => new Date(r.sla_due_at) < now);
    const approaching = result.filter((r) => {
      const due = new Date(r.sla_due_at);
      return due >= now && due.getTime() - now.getTime() <= 2 * 60 * 60 * 1000;
    });

    const issues: DetectedIssue[] = [];
    if (overdue.length > 0) {
      issues.push({
        type: 'sla_risk',
        title: `${overdue.length} open ticket(s) past SLA first-response target`,
        severity: 'P1',
        confidence: 0.95,
        affectedCustomerIds: [...new Set(overdue.map((r) => r.acct))],
        relatedTicketIds: overdue.map((r) => r.ticket_id),
        relatedOrderIds: [],
        summary: `Open tickets with SLA due before the dataset snapshot: ${overdue.map((r: { ticket_id: string }) => r.ticket_id).join(', ')}.`,
      });
    }
    if (approaching.length > 0) {
      issues.push({
        type: 'sla_risk',
        title: `${approaching.length} open ticket(s) approaching SLA first-response target`,
        severity: 'P2',
        confidence: 0.8,
        affectedCustomerIds: [...new Set(approaching.map((r) => r.acct))],
        relatedTicketIds: approaching.map((r) => r.ticket_id),
        relatedOrderIds: [],
        summary: `Open tickets with SLA due within 2 hours of the dataset snapshot: ${approaching.map((r: { ticket_id: string }) => r.ticket_id).join(', ')}.`,
      });
    }
    return issues;
  }

  private async detectRecurringAndCrossCustomer(
    now: Date,
  ): Promise<DetectedIssue[]> {
    const tickets = (await this.dataSource.query(
      `SELECT t.id, t.ticket_id, t.account_id, t.subject, t.description, a.account_id AS acct
       FROM tickets t JOIN accounts a ON a.id = t.account_id
       WHERE t.status = 'open'`,
    )) as {
      ticket_id: string;
      account_id: string;
      acct: string;
      subject: string;
      description: string;
    }[];

    const issues: DetectedIssue[] = [];
    for (const theme of THEMES) {
      const matches = tickets.filter((t) =>
        theme.pattern.test(`${t.subject} ${t.description}`),
      );
      if (matches.length === 0) continue;
      const customers = [...new Set(matches.map((m) => m.acct))];
      const type =
        customers.length >= 2 ? 'cross_customer' : 'recurring_complaint';
      issues.push({
        type,
        title: theme.title,
        severity: theme.severity,
        confidence: customers.length >= 2 ? 0.85 : 0.7,
        affectedCustomerIds: customers,
        relatedTicketIds: matches.map((m) => m.ticket_id),
        relatedOrderIds: [],
        summary: `${matches.length} open ticket(s) match '${theme.title}' across ${customers.length} customer(s): ${matches.map((m) => m.ticket_id).join(', ')}.`,
      });
    }
    return issues;
  }

  private async detectUnusualActivity(now: Date): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    const p1Open = (await this.dataSource.query(
      `SELECT t.ticket_id, a.account_id AS acct
       FROM tickets t JOIN accounts a ON a.id = t.account_id
       WHERE t.status = 'open' AND t.severity = 'P1'`,
    )) as { ticket_id: string; acct: string }[];

    if (p1Open.length >= 2) {
      issues.push({
        type: 'unusual_activity',
        title: `Elevated open P1 (critical) ticket volume: ${p1Open.length}`,
        severity: 'P1',
        confidence: 0.75,
        affectedCustomerIds: [...new Set(p1Open.map((p) => p.acct))],
        relatedTicketIds: p1Open.map((p) => p.ticket_id),
        relatedOrderIds: [],
        summary: `${p1Open.length} open critical (P1) tickets at the dataset snapshot: ${p1Open.map((p) => p.ticket_id).join(', ')}.`,
      });
    }

    const orderStats = (await this.dataSource.query(
      `SELECT o.carrier, o.status, o.cancellation_requested_at, o.account_id, a.account_id AS acct
       FROM orders o JOIN accounts a ON a.id = o.account_id`,
    )) as {
      carrier: string;
      status: string;
      cancellation_requested_at: string | null;
      acct: string;
    }[];

    const booked = orderStats.filter((o) => o.status === 'BOOKED');
    const cancelRequested = booked.filter((o) => o.cancellation_requested_at);
    if (
      cancelRequested.length >= 3 &&
      cancelRequested.length >= 0.5 * booked.length
    ) {
      issues.push({
        type: 'unusual_activity',
        title: `High proportion of cancellation requests among BOOKED orders (${cancelRequested.length}/${booked.length})`,
        severity: 'P2',
        confidence: 0.65,
        affectedCustomerIds: [...new Set(cancelRequested.map((c) => c.acct))],
        relatedTicketIds: [],
        relatedOrderIds: [],
        summary: `${cancelRequested.length} of ${booked.length} BOOKED orders have a cancellation request at the snapshot.`,
      });
    }

    return issues;
  }

  private asOf(): Date {
    const config = this.configService.get<AppConfig>('app');
    return new Date(config?.datasetAsOf ?? Date.now());
  }
}
