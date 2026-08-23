import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AccountsService } from '../../accounts/accounts.service';
import { OrdersService } from '../../orders/orders.service';
import { TicketsService } from '../../tickets/tickets.service';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { CalculationsService } from '../../calculations/calculations.service';
import { AccessControlService } from '../../auth/access-control.service';
import { User } from '../../auth/user.decorator';
import { ToolDefinition, denied, fail, ok } from './tools.types';
import { SlaService } from '../../sla/sla.service';
import { policyOverrideFor } from '../../policy/policy-overrides';
import { AppConfig } from '../../config/app.config';
import { ConfigService } from '@nestjs/config';
import { ActionsService } from '../../actions/actions.service';

/**
 * Registry of tools exposed to the agent. Every tool enforces authorization
 * here, in the tool layer, never in the prompt.
 */
@Injectable()
export class ToolRegistry {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly ordersService: OrdersService,
    private readonly ticketsService: TicketsService,
    private readonly retrievalService: RetrievalService,
    private readonly calculationsService: CalculationsService,
    private readonly slaService: SlaService,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
    private readonly actionsService: ActionsService,
  ) {}

  private asOf(): Date {
    const config = this.configService.get<AppConfig>('app');
    return new Date(config?.datasetAsOf ?? Date.now());
  }

  list(): ToolDefinition[] {
    return [
      this.searchDocuments(),
      this.getAccount(),
      this.getOrder(),
      this.getTicket(),
      this.searchTickets(),
      this.calculateSla(),
      this.calculateCancellation(),
      this.calculateServiceCredit(),
      this.prepareEscalation(),
      this.prepareTicketUpdate(),
      this.prepareFollowUpTask(),
    ];
  }

  find(name: string): ToolDefinition | undefined {
    return this.list().find((t) => t.name === name);
  }

  // ---- Document search ----

  private searchDocuments(): ToolDefinition {
    const schema = z.object({
      query: z.string(),
      customerAccountId: z.string().optional(),
      documentType: z
        .enum(['policy', 'sop', 'product', 'agreement'])
        .optional(),
      includeDeprecated: z.boolean().optional(),
    });
    return {
      name: 'search_documents',
      description:
        'Search approved ParcelPilot documents (policies, SOPs, product documentation, customer agreements) semantically. Pass customerAccountId when the question involves a specific customer so their applicable agreement is considered. Deprecated sources are excluded unless includeDeprecated=true. Returns source title, section, content, authority, status, effective dates, and applicability.',
      schema,
      handler: async (args, user) => {
        const { query, customerAccountId, documentType, includeDeprecated } =
          args as unknown as z.infer<typeof schema>;
        if (customerAccountId) {
          const access = this.accessControl.canAccessAccount(
            user,
            customerAccountId,
          );
          if (!access.allowed) return denied(access.reason);
        }
        try {
          const hits = await this.retrievalService.searchDocuments({
            query,
            customerAccountId,
            documentType,
            includeDeprecated,
            limit: 8,
          });
          return ok(hits);
        } catch (e) {
          return fail(`Document search failed: ${(e as Error).message}`);
        }
      },
    };
  }

  // ---- Structured data ----

  private getAccount(): ToolDefinition {
    const schema = z.object({ accountId: z.string() });
    return {
      name: 'get_account',
      description:
        'Get account details by accountId (e.g. ACCT-001). Includes plan, status, CSM, premium support, and whether a custom contract exists.',
      schema,
      handler: async (args, user) => {
        const { accountId } = args as unknown as z.infer<typeof schema>;
        const access = this.accessControl.canAccessAccount(user, accountId);
        if (!access.allowed) return denied(access.reason);
        const account = await this.accountsService.findByAccountId(accountId);
        if (!account) return fail(`Account ${accountId} not found`);
        return ok(this.accountsService.toSummary(account));
      },
    };
  }

  private getOrder(): ToolDefinition {
    const schema = z.object({ orderId: z.string() });
    return {
      name: 'get_order',
      description:
        'Get shipment/order details by orderId (e.g. ORD-1001): carrier, status, pickup windows, actual pickup, fees, fault flags, cancellation request. Access is scoped to the customer.',
      schema,
      handler: async (args, user) => {
        const { orderId } = args as unknown as z.infer<typeof schema>;
        const order = await this.ordersService.findByOrderId(orderId);
        if (!order) return fail(`Order ${orderId} not found`);
        const access = this.accessControl.canAccessAccount(
          user,
          order.account.accountId,
        );
        if (!access.allowed) return denied(access.reason);
        return ok(this.ordersService.toDetail(order));
      },
    };
  }

  private getTicket(): ToolDefinition {
    const schema = z.object({ ticketId: z.string() });
    return {
      name: 'get_ticket',
      description:
        'Get support ticket details by ticketId (e.g. TKT-501): subject, description, severity, status, SLA due, channel, assignee, historical resolution. Access is scoped to the customer.',
      schema,
      handler: async (args, user) => {
        const { ticketId } = args as unknown as z.infer<typeof schema>;
        const ticket = await this.ticketsService.findByTicketId(ticketId);
        if (!ticket) return fail(`Ticket ${ticketId} not found`);
        const access = this.accessControl.canAccessAccount(
          user,
          ticket.account.accountId,
        );
        if (!access.allowed) return denied(access.reason);
        return ok(this.ticketsService.toDetail(ticket));
      },
    };
  }

  private searchTickets(): ToolDefinition {
    const schema = z.object({
      accountId: z.string().optional(),
      status: z.enum(['open', 'closed']).optional(),
      severity: z.enum(['P1', 'P2', 'P3']).optional(),
      query: z.string().optional(),
      includeHistorical: z.boolean().optional(),
    });
    return {
      name: 'search_tickets',
      description:
        'Search tickets by account, status, severity, or free-text query. Omit accountId to search within your allowed scope. Use for finding high-severity tickets, approaching-SLA tickets, or recurring complaints.',
      schema,
      handler: async (args, user) => {
        const { accountId, status, severity, query, includeHistorical } =
          args as unknown as z.infer<typeof schema>;
        const targetAccount = accountId ?? user.accountId;
        if (targetAccount) {
          const access = this.accessControl.canAccessAccount(
            user,
            targetAccount,
          );
          if (!access.allowed) return denied(access.reason);
        }
        const tickets = targetAccount
          ? await this.ticketsService.findByAccount(targetAccount)
          : await this.ticketsService.findAll();
        const filtered = tickets.filter(
          (t) =>
            (!status || t.status === status) &&
            (!severity || t.severity === severity) &&
            (includeHistorical || t.status === 'open' || status === 'closed'),
        );
        let searched = filtered;
        if (query) {
          const q = query.toLowerCase();
          searched = filtered.filter(
            (t) =>
              t.subject.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q),
          );
        }
        return ok(searched.map((t) => this.ticketsService.toDetail(t)));
      },
    };
  }

  // ---- Calculations ----

  private calculateSla(): ToolDefinition {
    const schema = z.object({ ticketId: z.string() });
    return {
      name: 'calculate_sla',
      description:
        'Compute the SLA first-response due time for a ticket using the applicable plan and customer-agreement targets. Also returns the breach status relative to the dataset snapshot time.',
      schema,
      handler: async (args, user) => {
        const { ticketId } = args as unknown as z.infer<typeof schema>;
        const ticket = await this.ticketsService.findByTicketId(ticketId);
        if (!ticket) return fail(`Ticket ${ticketId} not found`);
        const access = this.accessControl.canAccessAccount(
          user,
          ticket.account.accountId,
        );
        if (!access.allowed) return denied(access.reason);

        const override = policyOverrideFor(ticket.account.accountId);
        const severity = ticket.severity ?? 'P3';
        const due = this.slaService.computeSlaDue(
          ticket.createdAt,
          ticket.account.plan,
          severity,
          override?.sla,
        );
        const asOf = this.asOf();
        return ok({
          ticketId,
          accountId: ticket.account.accountId,
          plan: ticket.account.plan,
          severity,
          targetSource: override
            ? `customer agreement (${override.notes})`
            : 'Support Policy v3 default',
          slaDueAt: due.toISOString(),
          snapshotTime: asOf.toISOString(),
          breached: due < asOf,
          status: due < asOf ? 'BREACHED' : 'WITHIN_SLA',
        });
      },
    };
  }

  private calculateCancellation(): ToolDefinition {
    const schema = z.object({ orderId: z.string() });
    return {
      name: 'calculate_cancellation',
      description:
        'Determine whether an order can be cancelled and whether a cancellation fee applies, using the SOP and the customer agreement. Deterministic calculation.',
      schema,
      handler: async (args, user) => {
        const { orderId } = args as unknown as z.infer<typeof schema>;
        const order = await this.ordersService.findByOrderId(orderId);
        if (!order) return fail(`Order ${orderId} not found`);
        const access = this.accessControl.canAccessAccount(
          user,
          order.account.accountId,
        );
        if (!access.allowed) return denied(access.reason);
        return ok(
          this.calculationsService.determineCancellation(order, this.asOf()),
        );
      },
    };
  }

  private calculateServiceCredit(): ToolDefinition {
    const schema = z.object({ orderId: z.string() });
    return {
      name: 'calculate_service_credit',
      description:
        'Determine failed-pickup service credit eligibility and amount using the SOP and the customer agreement. Deterministic calculation. Use when a customer reports a late or missed pickup.',
      schema,
      handler: async (args, user) => {
        const { orderId } = args as unknown as z.infer<typeof schema>;
        const order = await this.ordersService.findByOrderId(orderId);
        if (!order) return fail(`Order ${orderId} not found`);
        const access = this.accessControl.canAccessAccount(
          user,
          order.account.accountId,
        );
        if (!access.allowed) return denied(access.reason);
        return ok(
          this.calculationsService.determineServiceCredit(order, this.asOf()),
        );
      },
    };
  }

  // ---- Actions (prepare only; execution happens via direct API after confirmation) ----

  private prepareEscalation(): ToolDefinition {
    const schema = z.object({
      ticketId: z.string().optional(),
      accountId: z.string().optional(),
      priority: z.enum(['P1', 'P2', 'P3']),
      targetTeam: z.string(),
      reason: z.string(),
    });
    return {
      name: 'prepare_escalation',
      description:
        'Prepare (not execute) an escalation for a ticket or account. Produces a proposal with priority, target team, reason, and evidence. Execution requires explicit user confirmation via the confirmation UI. Never claim the escalation was created — only prepared.',
      schema,
      handler: async (args, user) => {
        const { ticketId, accountId, priority, targetTeam, reason } =
          args as unknown as z.infer<typeof schema>;
        const access = this.accessControl.canPrepareActions(user);
        if (!access.allowed) return denied(access.reason);
        try {
          const prepared = await this.actionsService.prepareEscalation(user, {
            ticketId,
            accountId,
            priority,
            targetTeam,
            reason,
            evidence: [],
          });
          return ok(prepared);
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    };
  }

  private prepareTicketUpdate(): ToolDefinition {
    const schema = z.object({
      ticketId: z.string(),
      kind: z.enum(['note', 'status_change']),
      note: z.string().optional(),
    });
    return {
      name: 'prepare_ticket_update',
      description:
        'Prepare (not execute) a ticket update: append an internal note or change ticket status. Execution requires explicit user confirmation. Never claim the update was applied — only prepared.',
      schema,
      handler: async (args, user) => {
        const { ticketId, kind, note } = args as unknown as z.infer<
          typeof schema
        >;
        const access = this.accessControl.canPrepareActions(user);
        if (!access.allowed) return denied(access.reason);
        try {
          const prepared = await this.actionsService.prepareTicketUpdate(user, {
            ticketId,
            kind,
            note,
          });
          return ok(prepared);
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    };
  }

  private prepareFollowUpTask(): ToolDefinition {
    const schema = z.object({
      ticketId: z.string().optional(),
      assignee: z.string(),
      dueAt: z.string().optional(),
      description: z.string(),
    });
    return {
      name: 'prepare_follow_up_task',
      description:
        'Prepare (not execute) a follow-up task for a ticket with an assignee and due time. Execution requires explicit user confirmation. Never claim the task was created — only prepared.',
      schema,
      handler: async (args, user) => {
        const { ticketId, assignee, dueAt, description } =
          args as unknown as z.infer<typeof schema>;
        const access = this.accessControl.canPrepareActions(user);
        if (!access.allowed) return denied(access.reason);
        try {
          const prepared = await this.actionsService.prepareFollowUpTask(user, {
            ticketId,
            assignee,
            dueAt,
            description,
          });
          return ok(prepared);
        } catch (e) {
          return fail((e as Error).message);
        }
      },
    };
  }
}
