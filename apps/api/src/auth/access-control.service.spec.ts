import { AccessControlService } from './access-control.service';
import { MOCK_USERS } from './mock-users';

describe('AccessControlService — authorization', () => {
  const svc = new AccessControlService();

  it('support_agent is scoped to their assigned account', () => {
    const agent = MOCK_USERS['agent@parcelpilot.local'];
    expect(svc.canAccessAccount(agent, 'ACCT-001').allowed).toBe(true);
    expect(svc.canAccessAccount(agent, 'ACCT-002').allowed).toBe(false);
  });

  it('support_manager has cross-account access', () => {
    const manager = MOCK_USERS['manager@parcelpilot.local'];
    expect(svc.canAccessAccount(manager, 'ACCT-001').allowed).toBe(true);
    expect(svc.canAccessAccount(manager, 'ACCT-004').allowed).toBe(true);
  });

  it('only manager/operations can view the issue dashboard', () => {
    const agent = MOCK_USERS['agent@parcelpilot.local'];
    const manager = MOCK_USERS['manager@parcelpilot.local'];
    const ops = MOCK_USERS['operations@parcelpilot.local'];
    expect(svc.canViewIssueDashboard(agent).allowed).toBe(false);
    expect(svc.canViewIssueDashboard(manager).allowed).toBe(true);
    expect(svc.canViewIssueDashboard(ops).allowed).toBe(true);
  });

  it('support_agent cannot execute actions', () => {
    const agent = MOCK_USERS['agent@parcelpilot.local'];
    expect(svc.canExecuteActions(agent, 'escalation').allowed).toBe(false);
    expect(svc.canExecuteActions(agent, 'ticket_update').allowed).toBe(false);
    expect(svc.canExecuteActions(agent, 'follow_up').allowed).toBe(false);
  });

  it('manager/operations can execute actions', () => {
    const manager = MOCK_USERS['manager@parcelpilot.local'];
    const ops = MOCK_USERS['operations@parcelpilot.local'];
    expect(svc.canExecuteActions(manager, 'escalation').allowed).toBe(true);
    expect(svc.canExecuteActions(ops, 'escalation').allowed).toBe(true);
  });

  it('support_agent can prepare actions within scope', () => {
    const agent = MOCK_USERS['agent@parcelpilot.local'];
    expect(svc.canPrepareActions(agent).allowed).toBe(true);
  });
});