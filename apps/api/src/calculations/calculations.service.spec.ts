import { CalculationsService } from './calculations.service';
import { Order } from '../orders/order.entity';
import { Account } from '../accounts/account.entity';

const AS_OF = new Date('2026-08-16T05:30:00.000Z');

function account(accountId: string, plan = 'enterprise'): Account {
  return {
    id: 'u',
    accountId,
    accountName: accountId,
    plan,
    status: 'active',
    csm: 'CSM',
    contractFile: null,
    premiumSupport: false,
    notes: null,
    orders: [],
    tickets: [],
  } as Account;
}

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: 'u',
    orderId: 'ORD-X',
    account: account('ACCT-003', 'standard'),
    carrier: 'Carrier',
    status: 'BOOKED',
    bookedAt: new Date('2026-08-16T04:30:00.000Z'),
    pickupWindowStart: new Date('2026-08-16T05:30:00.000Z'),
    pickupWindowEnd: new Date('2026-08-16T06:30:00.000Z'),
    pickupActualAt: null,
    shipmentFeeInr: '1200',
    carrierFault: false,
    customerFault: false,
    cancellationRequestedAt: null,
    notes: null,
    ...partial,
  } as Order;
}

describe('CalculationsService — cancellation', () => {
  const service = new CalculationsService();

  it('Northstar can cancel any BOOKED order before pickup with no fee (agreement override)', () => {
    const order = makeOrder({
      orderId: 'ORD-1001',
      account: account('ACCT-001', 'enterprise'),
      bookedAt: new Date('2026-08-16T03:30:00.000Z'),
      cancellationRequestedAt: new Date('2026-08-16T05:30:00.000Z'), // >30 min after booking
    });
    const decision = service.determineCancellation(order, AS_OF);
    expect(decision.canCancel).toBe(true);
    expect(decision.cancellationFeeInr).toBe(0);
    expect(decision.source).toContain('Northstar');
  });

  it('standard customer within 30 minutes pays no fee', () => {
    const order = makeOrder({
      bookedAt: new Date('2026-08-16T05:00:00.000Z'),
      cancellationRequestedAt: new Date('2026-08-16T05:20:00.000Z'),
    });
    const decision = service.determineCancellation(order, AS_OF);
    expect(decision.canCancel).toBe(true);
    expect(decision.cancellationFeeInr).toBe(0);
  });

  it('standard customer after 30 minutes pays INR 250', () => {
    const order = makeOrder({
      bookedAt: new Date('2026-08-16T04:00:00.000Z'),
      cancellationRequestedAt: new Date('2026-08-16T05:00:00.000Z'),
    });
    const decision = service.determineCancellation(order, AS_OF);
    expect(decision.canCancel).toBe(true);
    expect(decision.cancellationFeeInr).toBe(250);
  });

  it('PICKED_UP orders cannot be cancelled', () => {
    const order = makeOrder({
      account: account('ACCT-001', 'enterprise'),
      status: 'PICKED_UP',
      cancellationRequestedAt: new Date('2026-08-16T05:00:00.000Z'),
    });
    const decision = service.determineCancellation(order, AS_OF);
    expect(decision.canCancel).toBe(false);
    expect(decision.reason).toContain('return-to-origin');
  });
});

describe('CalculationsService — failed-pickup service credits', () => {
  const service = new CalculationsService();

  it('default: 2h past window + carrier fault → min(500, 10% of fee)', () => {
    const order = makeOrder({
      shipmentFeeInr: '4200',
      carrierFault: true,
      pickupActualAt: new Date('2026-08-16T09:00:00.000Z'), // 2.5h past window end
    });
    const decision = service.determineServiceCredit(order, AS_OF);
    expect(decision.eligible).toBe(true);
    expect(decision.creditAmountInr).toBe(420); // 10% of 4200 < 500
    expect(decision.confident).toBe(true);
  });

  it('default: credit caps at INR 500', () => {
    const order = makeOrder({
      shipmentFeeInr: '9000',
      carrierFault: true,
      pickupActualAt: new Date('2026-08-16T09:00:00.000Z'),
    });
    const decision = service.determineServiceCredit(order, AS_OF);
    expect(decision.creditAmountInr).toBe(500);
  });

  it('LumenWorks: fixed INR 300 replaces the default amount', () => {
    const order = makeOrder({
      account: account('ACCT-002', 'growth'),
      carrierFault: true,
      pickupActualAt: new Date('2026-08-16T11:00:00.000Z'), // >4h past window
    });
    const decision = service.determineServiceCredit(order, AS_OF);
    expect(decision.eligible).toBe(true);
    expect(decision.creditAmountInr).toBe(300);
    expect(decision.source).toContain('LumenWorks');
  });

  it('not eligible when pickup within the threshold', () => {
    const order = makeOrder({
      carrierFault: true,
      pickupActualAt: new Date('2026-08-16T07:00:00.000Z'), // 0.5h past window
    });
    const decision = service.determineServiceCredit(order, AS_OF);
    expect(decision.eligible).toBe(false);
  });

  it('no promise when fault conditions are unknown', () => {
    const order = makeOrder({ carrierFault: false, customerFault: false, pickupActualAt: null });
    const decision = service.determineServiceCredit(order, AS_OF);
    expect(decision.eligible).toBe(false);
    expect(decision.confident).toBe(false);
  });
});