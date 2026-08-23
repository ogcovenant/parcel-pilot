import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Escalation } from './escalation.entity';
import { FollowUpTask } from './follow-up-task.entity';
import { TicketUpdate } from './ticket-update.entity';
import { Ticket } from '../tickets/ticket.entity';
import { Account } from '../accounts/account.entity';
import { AccessControlService } from '../auth/access-control.service';
import { User } from '../auth/user.decorator';

export interface PreparedAction {
  actionType: 'escalation' | 'follow_up_task' | 'ticket_update';
  referenceId: string;
  status: string;
  summary: Record<string, unknown>;
}

@Injectable()
export class ActionsService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
    private readonly accessControl: AccessControlService,
  ) {}

  private nextRef(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${Date.now().toString(36).toUpperCase()}${rand}`;
  }

  // ---- Escalations ----

  async prepareEscalation(
    user: User,
    input: {
      ticketId?: string;
      accountId?: string;
      priority: string;
      targetTeam: string;
      reason: string;
      evidence: Record<string, unknown>[];
    },
  ): Promise<PreparedAction> {
    const access = this.accessControl.canPrepareActions(user);
    if (!access.allowed) throw new BadRequestException(access.reason);

    const ticket = input.ticketId
      ? await this.dataSource.getRepository(Ticket).findOne({
          where: { ticketId: input.ticketId },
          relations: { account: true },
        })
      : null;
    if (input.ticketId && !ticket) {
      throw new BadRequestException(`Ticket ${input.ticketId} not found`);
    }
    const accountId = input.accountId ?? ticket?.account?.accountId;
    if (accountId) {
      const accountAccess = this.accessControl.canAccessAccount(
        user,
        accountId,
      );
      if (!accountAccess.allowed)
        throw new BadRequestException(accountAccess.reason);
    }

    const escalation = this.dataSource.getRepository(Escalation).create({
      escalationId: this.nextRef('ESC'),
      ticket: ticket,
      account: ticket?.account ?? null,
      priority: input.priority,
      targetTeam: input.targetTeam,
      reason: input.reason,
      status: 'prepared',
      createdBy: user.id,
      evidence: input.evidence,
      createdAt: new Date(),
    });
    const saved = await this.dataSource
      .getRepository(Escalation)
      .save(escalation);

    return {
      actionType: 'escalation',
      referenceId: saved.escalationId,
      status: saved.status,
      summary: {
        priority: saved.priority,
        targetTeam: saved.targetTeam,
        reason: saved.reason,
        ticketId: input.ticketId ?? null,
        accountId,
      },
    };
  }

  async executeEscalation(
    user: User,
    escalationId: string,
    confirmed: boolean,
  ): Promise<Record<string, unknown>> {
    const access = this.accessControl.canExecuteActions(user, 'escalation');
    if (!access.allowed) throw new BadRequestException(access.reason);

    const repo = this.dataSource.getRepository(Escalation);
    const escalation = await repo.findOne({ where: { escalationId } });
    if (!escalation)
      throw new BadRequestException(`Escalation ${escalationId} not found`);

    if (escalation.status === 'executed') {
      return {
        referenceId: escalationId,
        status: 'executed',
        note: 'Already executed',
      };
    }
    if (!confirmed) {
      escalation.status = 'rejected';
      await repo.save(escalation);
      return {
        referenceId: escalationId,
        status: 'rejected',
        note: 'Not confirmed by user',
      };
    }
    if (escalation.status !== 'prepared') {
      throw new BadRequestException(
        `Escalation is in state '${escalation.status}', not 'prepared'`,
      );
    }

    escalation.status = 'executed';
    escalation.confirmedAt = new Date();
    escalation.executedAt = new Date();
    await repo.save(escalation);

    return {
      referenceId: escalationId,
      status: 'executed',
      priority: escalation.priority,
      targetTeam: escalation.targetTeam,
      executedAt: escalation.executedAt.toISOString(),
    };
  }

  async listEscalations(): Promise<Escalation[]> {
    return this.dataSource.getRepository(Escalation).find({
      relations: { ticket: true, account: true },
      order: { createdAt: 'DESC' },
    });
  }

  // ---- Follow-up tasks ----

  async prepareFollowUpTask(
    user: User,
    input: {
      ticketId?: string;
      assignee: string;
      dueAt?: string;
      description: string;
    },
  ): Promise<PreparedAction> {
    const access = this.accessControl.canPrepareActions(user);
    if (!access.allowed) throw new BadRequestException(access.reason);

    const ticket = input.ticketId
      ? await this.dataSource.getRepository(Ticket).findOne({
          where: { ticketId: input.ticketId },
          relations: { account: true },
        })
      : null;
    if (input.ticketId && !ticket) {
      throw new BadRequestException(`Ticket ${input.ticketId} not found`);
    }
    const accountId = ticket?.account?.accountId;
    if (accountId) {
      const accountAccess = this.accessControl.canAccessAccount(
        user,
        accountId,
      );
      if (!accountAccess.allowed)
        throw new BadRequestException(accountAccess.reason);
    }

    const task = this.dataSource.getRepository(FollowUpTask).create({
      taskId: this.nextRef('FUP'),
      ticket: ticket,
      assignee: input.assignee,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      description: input.description,
      status: 'prepared',
      createdBy: user.id,
      createdAt: new Date(),
    });
    const saved = await this.dataSource.getRepository(FollowUpTask).save(task);

    return {
      actionType: 'follow_up_task',
      referenceId: saved.taskId,
      status: saved.status,
      summary: {
        assignee: saved.assignee,
        description: saved.description,
        ticketId: input.ticketId ?? null,
      },
    };
  }

  async executeFollowUpTask(
    user: User,
    taskId: string,
    confirmed: boolean,
  ): Promise<Record<string, unknown>> {
    const access = this.accessControl.canExecuteActions(user, 'follow_up');
    if (!access.allowed) throw new BadRequestException(access.reason);

    const repo = this.dataSource.getRepository(FollowUpTask);
    const task = await repo.findOne({ where: { taskId } });
    if (!task)
      throw new BadRequestException(`Follow-up task ${taskId} not found`);

    if (task.status === 'executed') {
      return {
        referenceId: taskId,
        status: 'executed',
        note: 'Already executed',
      };
    }
    if (!confirmed) {
      task.status = 'cancelled';
      await repo.save(task);
      return {
        referenceId: taskId,
        status: 'cancelled',
        note: 'Not confirmed by user',
      };
    }
    if (task.status !== 'prepared') {
      throw new BadRequestException(
        `Task is in state '${task.status}', not 'prepared'`,
      );
    }

    task.status = 'executed';
    task.confirmedAt = new Date();
    task.executedAt = new Date();
    await repo.save(task);

    return {
      referenceId: taskId,
      status: 'executed',
      executedAt: task.executedAt.toISOString(),
    };
  }

  async listFollowUpTasks(): Promise<FollowUpTask[]> {
    return this.dataSource.getRepository(FollowUpTask).find({
      relations: { ticket: true },
      order: { createdAt: 'DESC' },
    });
  }

  // ---- Ticket updates ----

  async prepareTicketUpdate(
    user: User,
    input: { ticketId: string; kind: 'note' | 'status_change'; note?: string },
  ): Promise<PreparedAction> {
    const access = this.accessControl.canPrepareActions(user);
    if (!access.allowed) throw new BadRequestException(access.reason);

    const ticket = await this.dataSource.getRepository(Ticket).findOne({
      where: { ticketId: input.ticketId },
      relations: { account: true },
    });
    if (!ticket)
      throw new BadRequestException(`Ticket ${input.ticketId} not found`);
    const accountAccess = this.accessControl.canAccessAccount(
      user,
      ticket.account.accountId,
    );
    if (!accountAccess.allowed)
      throw new BadRequestException(accountAccess.reason);

    const update = this.dataSource.getRepository(TicketUpdate).create({
      updateId: this.nextRef('UPD'),
      ticket,
      kind: input.kind,
      note: input.note ?? null,
      status: 'prepared',
      createdBy: user.id,
      createdAt: new Date(),
    });
    const saved = await this.dataSource
      .getRepository(TicketUpdate)
      .save(update);

    return {
      actionType: 'ticket_update',
      referenceId: saved.updateId,
      status: saved.status,
      summary: {
        ticketId: input.ticketId,
        kind: saved.kind,
        note: saved.note,
      },
    };
  }

  async executeTicketUpdate(
    user: User,
    updateId: string,
    confirmed: boolean,
  ): Promise<Record<string, unknown>> {
    const access = this.accessControl.canExecuteActions(user, 'ticket_update');
    if (!access.allowed) throw new BadRequestException(access.reason);

    const repo = this.dataSource.getRepository(TicketUpdate);
    const update = await repo.findOne({
      where: { updateId },
      relations: { ticket: true },
    });
    if (!update)
      throw new BadRequestException(`Ticket update ${updateId} not found`);

    if (update.status === 'executed') {
      return {
        referenceId: updateId,
        status: 'executed',
        note: 'Already executed',
      };
    }
    if (!confirmed) {
      update.status = 'rejected';
      await repo.save(update);
      return {
        referenceId: updateId,
        status: 'rejected',
        note: 'Not confirmed by user',
      };
    }
    if (update.status !== 'prepared') {
      throw new BadRequestException(
        `Update is in state '${update.status}', not 'prepared'`,
      );
    }

    const ticketRepo = this.dataSource.getRepository(Ticket);
    const ticket = update.ticket;
    if (update.kind === 'note' && update.note) {
      const existing = (ticket.notes ?? '').trim();
      ticket.notes = existing
        ? `${existing}\n[${user.name}] ${update.note}`
        : `[${user.name}] ${update.note}`;
      await ticketRepo.save(ticket);
    }
    update.status = 'executed';
    update.confirmedAt = new Date();
    update.executedAt = new Date();
    await repo.save(update);

    return {
      referenceId: updateId,
      status: 'executed',
      kind: update.kind,
      ticketId: ticket.ticketId,
      executedAt: update.executedAt.toISOString(),
    };
  }

  async listTicketUpdates(): Promise<TicketUpdate[]> {
    return this.dataSource.getRepository(TicketUpdate).find({
      relations: { ticket: true },
      order: { createdAt: 'DESC' },
    });
  }
}
