export type SlaTargetUnit =
  'minutes' | 'business_minutes' | 'business_hours' | 'business_days';
export interface SlaTarget {
  value: number;
  unit: SlaTargetUnit;
}
export type SlaOverride = Record<'p1' | 'p2' | 'p3', SlaTarget>;

export interface CreditRule {
  /** Hours past the end of the scheduled pickup window before credit is due. */
  delayHoursPastWindow: number;
  /** Credit amount: fixed amount or "lower of cap and pct of shipment fee". */
  mode: 'fixed' | 'default';
  fixedAmountInr?: number;
  /** Monthly aggregate cap for the customer. */
  monthlyCapInr?: number;
}

export interface PolicyOverride {
  accountId: string;
  sla: SlaOverride;
  cancellationFeeWaiver: boolean;
  creditRule: CreditRule;
  notes: string;
}

/**
 * Deterministic encoding of customer-specific agreement clauses, derived from
 * the supplied agreements. This is the calculation source of truth for SLA,
 * cancellation, and credit math. The retrieval layer supplies the same clauses
 * as evidence text.
 */
export const POLICY_OVERRIDES: Record<string, PolicyOverride> = {
  'ACCT-001': {
    accountId: 'ACCT-001',
    sla: {
      p1: { value: 15, unit: 'minutes' },
      p2: { value: 1, unit: 'business_hours' },
      p3: { value: 8, unit: 'business_hours' },
    },
    cancellationFeeWaiver: true,
    creditRule: {
      delayHoursPastWindow: 2,
      mode: 'default',
      monthlyCapInr: 5000,
    },
    notes: 'Northstar Logistics Enterprise Agreement',
  },
  'ACCT-002': {
    accountId: 'ACCT-002',
    sla: {
      p1: { value: 2, unit: 'business_hours' },
      p2: { value: 4, unit: 'business_hours' },
      p3: { value: 2, unit: 'business_days' },
    },
    cancellationFeeWaiver: false,
    creditRule: {
      delayHoursPastWindow: 4,
      mode: 'fixed',
      fixedAmountInr: 300,
    },
    notes: 'LumenWorks Service Agreement',
  },
};

export function policyOverrideFor(accountId: string): PolicyOverride | null {
  return POLICY_OVERRIDES[accountId] ?? null;
}
