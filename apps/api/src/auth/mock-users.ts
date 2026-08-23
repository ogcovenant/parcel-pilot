export const ROLES = [
  'support_agent',
  'support_manager',
  'operations',
] as const;

export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Account scope. Null = cross-account (manager/operations). */
  accountId: string | null;
}

/**
 * Mock directory of internal support users. In production this is replaced by SSO.
 * accountId scopes a support_agent to a single customer account.
 */
export const MOCK_USERS: Record<string, User> = {
  'agent@parcelpilot.local': {
    id: 'usr-agent-northstar',
    email: 'agent@parcelpilot.local',
    name: 'Northstar Support Agent',
    role: 'support_agent',
    accountId: 'ACCT-001',
  },
  'lumen@parcelpilot.local': {
    id: 'usr-agent-lumen',
    email: 'lumen@parcelpilot.local',
    name: 'LumenWorks Support Agent',
    role: 'support_agent',
    accountId: 'ACCT-002',
  },
  'manager@parcelpilot.local': {
    id: 'usr-manager',
    email: 'manager@parcelpilot.local',
    name: 'Priya Mehta (Manager)',
    role: 'support_manager',
    accountId: null,
  },
  'operations@parcelpilot.local': {
    id: 'usr-operations',
    email: 'operations@parcelpilot.local',
    name: 'Operations Analyst',
    role: 'operations',
    accountId: null,
  },
};

export function findMockUser(email: string): User | null {
  return MOCK_USERS[email.toLowerCase()] ?? null;
}
