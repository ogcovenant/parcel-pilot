import { Injectable } from '@nestjs/common';
import { Order } from '../orders/order.entity';
import { policyOverrideFor } from '../policy/policy-overrides';

export interface CancellationDecision {
  canCancel: boolean;
  cancellationFeeInr: number;
  reason: string;
  source: string;
}

export interface CreditDecision {
  eligible: boolean;
  creditAmountInr: number | null;
  reason: string;
  source: string;
  confident: boolean;
}

/**
 * Deterministic business calculations for cancellation fees and failed-pickup
 * service credits, driven by the SOP and customer agreements.
 */
@Injectable()
export class CalculationsService {
  private readonly DEFAULT_CANCEL_FEE_INR = 250;
  private readonly FREE_CANCEL_WINDOW_MINUTES = 30;
  private readonly DEFAULT_CREDIT_CAP_INR = 500;
  private readonly DEFAULT_CREDIT_PCT = 0.1;

  determineCancellation(order: Order, asOf: Date): CancellationDecision {
    const override = policyOverrideFor(order.account.accountId);

    if (order.status === 'PICKED_UP' || order.status === 'DELIVERED') {
      return {
        canCancel: false,
        cancellationFeeInr: 0,
        reason:
          order.status === 'PICKED_UP'
            ? 'Shipment is PICKED_UP; use the return-to-origin workflow instead of cancelling.'
            : 'DELIVERED shipments cannot be cancelled.',
        source: 'Cancellation & Service Credit SOP v4 (section 1)',
      };
    }

    if (order.cancellationRequestedAt === null) {
      return {
        canCancel: false,
        cancellationFeeInr: 0,
        reason: 'No cancellation has been requested for this order.',
        source: 'operational data',
      };
    }

    if (override?.cancellationFeeWaiver) {
      return {
        canCancel: true,
        cancellationFeeInr: 0,
        reason:
          'Northstar may cancel any BOOKED shipment before pickup with no cancellation fee.',
        source: 'Northstar Logistics Enterprise Agreement (section 2)',
      };
    }

    const minutesSinceBooking =
      (order.cancellationRequestedAt.getTime() - order.bookedAt.getTime()) /
      60000;

    if (minutesSinceBooking <= this.FREE_CANCEL_WINDOW_MINUTES) {
      return {
        canCancel: true,
        cancellationFeeInr: 0,
        reason:
          'Cancellation requested within 30 minutes of booking; no fee applies.',
        source: 'Cancellation & Service Credit SOP v4 (section 1)',
      };
    }

    return {
      canCancel: true,
      cancellationFeeInr: this.DEFAULT_CANCEL_FEE_INR,
      reason:
        'Cancellation requested more than 30 minutes after booking; the INR 250 cancellation fee applies.',
      source: 'Cancellation & Service Credit SOP v4 (section 1)',
    };
  }

  determineServiceCredit(order: Order, asOf: Date): CreditDecision {
    const override = policyOverrideFor(order.account.accountId);
    const rule = override?.creditRule ?? {
      delayHoursPastWindow: 2,
      mode: 'default' as const,
    };

    const pickup = order.pickupActualAt;
    const windowEnd = order.pickupWindowEnd;
    const thresholdMs = rule.delayHoursPastWindow * 60 * 60 * 1000;

    if (pickup) {
      const delayMs = pickup.getTime() - windowEnd.getTime();
      if (delayMs > thresholdMs && order.carrierFault && !order.customerFault) {
        return this.creditFor(order, rule);
      }
      if (delayMs <= thresholdMs) {
        return {
          eligible: false,
          creditAmountInr: null,
          reason: `Pickup was ${formatDelay(delayMs)} after the scheduled window end, which is within the ${rule.delayHoursPastWindow}h threshold.`,
          source: 'Cancellation & Service Credit SOP v4 (section 2)',
          confident: true,
        };
      }
      return {
        eligible: false,
        creditAmountInr: null,
        reason:
          'Carrier fault or customer fault conditions for a service credit are not satisfied.',
        source: 'Cancellation & Service Credit SOP v4 (section 2)',
        confident: true,
      };
    }

    // No pickup recorded yet.
    if (order.carrierFault && !order.customerFault) {
      const elapsedPastWindow = asOf.getTime() - windowEnd.getTime();
      if (elapsedPastWindow > thresholdMs) {
        return this.creditFor(order, rule, true);
      }
      return {
        eligible: false,
        creditAmountInr: null,
        reason: `Pickup is not yet confirmed; the failed-pickup window (${rule.delayHoursPastWindow}h past scheduled window end) has not elapsed.`,
        source: 'Cancellation & Service Credit SOP v4 (section 2)',
        confident: true,
      };
    }

    return {
      eligible: false,
      creditAmountInr: null,
      reason:
        'Pickup timing, carrier fault, or customer fault is unknown; no credit can be promised.',
      source: 'Cancellation & Service Credit SOP v4 (section 3)',
      confident: false,
    };
  }

  private creditFor(
    order: Order,
    rule: {
      delayHoursPastWindow: number;
      mode: 'fixed' | 'default';
      fixedAmountInr?: number;
      monthlyCapInr?: number;
    },
    pickupPending = false,
  ): CreditDecision {
    if (rule.mode === 'fixed' && rule.fixedAmountInr !== undefined) {
      return {
        eligible: true,
        creditAmountInr: rule.fixedAmountInr,
        reason: pickupPending
          ? 'Pickup window exceeded by more than the agreed threshold with carrier fault; fixed INR 300 credit applies.'
          : 'Pickup exceeded the agreed threshold with carrier fault; fixed INR 300 credit applies.',
        source: 'LumenWorks Service Agreement (section 3)',
        confident: true,
      };
    }

    const cap = Math.min(
      this.DEFAULT_CREDIT_CAP_INR,
      Number(order.shipmentFeeInr) * this.DEFAULT_CREDIT_PCT,
    );
    const amount = Math.floor(cap);
    const capNote =
      rule.monthlyCapInr !== undefined
        ? ` Northstar aggregate monthly credits are capped at INR ${rule.monthlyCapInr}.`
        : '';
    return {
      eligible: true,
      creditAmountInr: amount,
      reason: `Failed pickup beyond the ${rule.delayHoursPastWindow}h threshold with carrier fault. Default credit is the lower of INR 500 or 10% of the shipment fee (INR ${order.shipmentFeeInr}).${capNote}`,
      source: 'Cancellation & Service Credit SOP v4 (section 2)',
      confident: true,
    };
  }
}

function formatDelay(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  return `${hours.toFixed(1)}h`;
}
