import type {
  AgentRunResult,
  EscalationRow,
  IssueCluster,
  OrderDetail,
  TicketDetail,
  User,
} from './types'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let currentUserEmail = 'manager@parcelpilot.local'

export function setCurrentUser(email: string) {
  currentUserEmail = email
  localStorage.setItem('pp_user', email)
}

export function loadStoredUser(): string {
  const stored = localStorage.getItem('pp_user')
  if (stored) currentUserEmail = stored
  return currentUserEmail
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': currentUserEmail,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      message = (body.message as string) ?? message
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

export const api = {
  me: () => request<User>('/auth/me'),
  users: () => request<User[]>('/auth/users'),
  tickets: (params?: { accountId?: string; status?: string; severity?: string }) =>
    request<TicketDetail[]>(`/tickets?${new URLSearchParams(params as Record<string, string>).toString()}`),
  ticket: (id: string) => request<TicketDetail>(`/tickets/${id}`),
  orders: (accountId?: string) =>
    request<OrderDetail[]>(`/orders${accountId ? `?accountId=${accountId}` : ''}`),
  order: (id: string) => request<OrderDetail>(`/orders/${id}`),
  issues: () => request<IssueCluster[]>('/issues'),
  detectIssues: () => request<{ detected: number; issues: IssueCluster[] }>('/issues/detect'),
  escalations: () => request<EscalationRow[]>('/actions/escalations'),
  prepareEscalation: (body: Record<string, unknown>) =>
    request<EscalationRow>('/actions/escalations', { method: 'POST', body: JSON.stringify(body) }),
  executeEscalation: (escalationId: string, confirmed: boolean) =>
    request(`/actions/escalations/execute`, {
      method: 'POST',
      body: JSON.stringify({ escalationId, confirmed }),
    }),
  executeFollowUp: (taskId: string, confirmed: boolean) =>
    request(`/actions/follow-ups/execute`, {
      method: 'POST',
      body: JSON.stringify({ taskId, confirmed }),
    }),
  executeTicketUpdate: (updateId: string, confirmed: boolean) =>
    request(`/actions/ticket-updates/execute`, {
      method: 'POST',
      body: JSON.stringify({ updateId, confirmed }),
    }),
  chat: (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    request<AgentRunResult>('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
  investigate: (issueId: string) =>
    request<AgentRunResult & { issueId: string }>('/agent/investigate', {
      method: 'POST',
      body: JSON.stringify({ issueId }),
    }),
}