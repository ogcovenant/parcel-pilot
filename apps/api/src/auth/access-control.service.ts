import { Injectable } from '@nestjs/common';
import { Role, User } from './mock-users';

export interface AccessResult {
  allowed: boolean;
  reason: string;
}

const ROLE_LEVEL: Record<Role, number> = {
  support_agent: 1,
  support_manager: 2,
  operations: 3,
};

/**
 * Centralized authorization decisions for the tool/service layer.
 * Never rely on prompts — every tool checks through this service.
 */
@Injectable()
export class AccessControlService {
  hasRole(user: User, required: Role): boolean {
    return ROLE_LEVEL[user.role] >= ROLE_LEVEL[required];
  }

  /**
   * Whether the user may view data belonging to `accountId`.
   * - support_agent is scoped to their assigned account.
   * - support_manager and operations are cross-account.
   */
  canAccessAccount(user: User, accountId: string): AccessResult {
    if (user.accountId !== null && user.accountId !== accountId) {
      return {
        allowed: false,
        reason: `Access denied: user scope is ${user.accountId}, not ${accountId}`,
      };
    }
    return { allowed: true, reason: '' };
  }

  canViewIssueDashboard(user: User): AccessResult {
    if (user.role === 'support_agent') {
      return {
        allowed: false,
        reason: 'Issue dashboard requires manager or operations role',
      };
    }
    return { allowed: true, reason: '' };
  }

  canExecuteActions(
    user: User,
    actionType: 'escalation' | 'ticket_update' | 'follow_up',
  ): AccessResult {
    if (user.role === 'support_agent') {
      return {
        allowed: false,
        reason: `Executing ${actionType} requires manager or operations role`,
      };
    }
    return { allowed: true, reason: '' };
  }

  canPrepareActions(user: User): AccessResult {
    if (
      user.role !== 'support_agent' &&
      user.role !== 'support_manager' &&
      user.role !== 'operations'
    ) {
      return {
        allowed: false,
        reason: `Role ${user.role} cannot prepare actions`,
      };
    }
    return { allowed: true, reason: '' };
  }
}
