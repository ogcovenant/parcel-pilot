export type Role = 'support_agent' | 'support_manager' | 'operations'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  accountId: string | null
}

export interface AccountSummary {
  accountId: string
  accountName: string
  plan: string
  status: string
  csm: string
  premiumSupport: boolean
  hasContract: boolean
  notes: string | null
}

export interface OrderDetail {
  orderId: string
  accountId: string
  carrier: string
  status: string
  bookedAt: string
  pickupWindowStart: string
  pickupWindowEnd: string
  pickupActualAt: string | null
  shipmentFeeInr: string
  carrierFault: boolean
  customerFault: boolean
  cancellationRequestedAt: string | null
  notes: string | null
}

export interface TicketDetail {
  ticketId: string
  accountId: string
  orderId: string | null
  createdAt: string
  status: string
  severity: string | null
  subject: string
  description: string
  channel: string
  assignedTo: string
  lastCustomerMessageAt: string | null
  historicalResolution: string | null
  slaDueAt: string | null
}

export interface IssueCluster {
  id: string
  issueId: string
  type: string
  title: string
  severity: string
  confidence: string
  affectedCustomers: Array<{ accountId: string }>
  relatedTickets: Array<{ ticketId: string }>
  relatedOrders: Array<{ orderId: string }>
  summary: string | null
  detectedAt: string
  status: string
}

export interface ToolActivity {
  name: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  ok: boolean
  denied?: boolean
}

export interface SourceRef {
  name: string
  type: string
  section?: string
}

export interface EvidenceResolution {
  applicableEvidence: string[]
  conflictingEvidence: string[]
  decision: string
  confidence: string
  reason: string
  recommendedAction: string
}

export interface PreparedAction {
  actionType: 'escalation' | 'ticket_update' | 'follow_up_task'
  referenceId: string
  status: string
  summary: Record<string, unknown>
}

export interface AgentRunResult {
  answer: string
  toolActivity: ToolActivity[]
  sources: SourceRef[]
  confidence: string
  evidence: EvidenceResolution | null
  requiresHumanReview: boolean
  preparedAction: PreparedAction | null
  conversationId: string
  error?: string
}

export interface EscalationRow {
  escalationId: string
  priority: string
  targetTeam: string
  reason: string
  status: string
  createdBy: string
  createdAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  activity?: ToolActivity[]
  sources?: SourceRef[]
  confidence?: string
  evidence?: EvidenceResolution | null
  preparedAction?: PreparedAction | null
  requiresHumanReview?: boolean
  pending?: boolean
}