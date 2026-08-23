import { ToolRegistry } from './tool-registry';
import { AccessControlService } from '../../auth/access-control.service';
import { MOCK_USERS } from '../../auth/mock-users';
import { ConfigService } from '@nestjs/config';
import { SlaService } from '../../sla/sla.service';

const noopService = () => ({}) as never;

function buildRegistry() {
  const accessControl = new AccessControlService();
  const configService = new ConfigService({
    app: { datasetAsOf: '2026-08-16T05:30:00.000Z' },
  });
  const registry = new ToolRegistry(
    noopService(),
    {
      findByOrderId: async (orderId: string) => {
        if (orderId === 'ORD-1001')
          return { account: { accountId: 'ACCT-001' } };
        if (orderId === 'ORD-2001')
          return { account: { accountId: 'ACCT-002' } };
        return null;
      },
      toDetail: (o: Record<string, unknown>) => o,
    } as never,
    {
      findByTicketId: async () => null,
    } as never,
    noopService(),
    noopService(),
    new SlaService(),
    accessControl,
    configService,
    noopService(),
  );
  return registry;
}

describe('ToolRegistry — required tool set', () => {
  it('exposes the three required tool categories', () => {
    const names = buildRegistry().list().map((t) => t.name);
    expect(names).toContain('search_documents');
    expect(names).toContain('get_account');
    expect(names).toContain('get_order');
    expect(names).toContain('get_ticket');
    expect(names).toContain('search_tickets');
    expect(names).toContain('calculate_sla');
    expect(names).toContain('prepare_escalation');
    expect(names).toContain('prepare_ticket_update');
    expect(names).toContain('prepare_follow_up_task');
  });
});

describe('ToolRegistry — authorization at the tool layer', () => {
  const northstarAgent = MOCK_USERS['agent@parcelpilot.local'];
  const lumenAgent = MOCK_USERS['lumen@parcelpilot.local'];

  it('get_order on an order outside the agent scope is denied', async () => {
    const registry = buildRegistry();
    const orderTool = registry.find('get_order')!;
    const result = await orderTool.handler({ orderId: 'ORD-1001' }, lumenAgent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('get_order on an order inside the agent scope succeeds', async () => {
    const registry = buildRegistry();
    const orderTool = registry.find('get_order')!;
    const result = await orderTool.handler({ orderId: 'ORD-1001' }, northstarAgent);
    expect(result.ok).toBe(true);
  });

  it('get_order for an unknown ID returns not found, not hallucination', async () => {
    const registry = buildRegistry();
    const orderTool = registry.find('get_order')!;
    const result = await orderTool.handler({ orderId: 'ORD-9999' }, northstarAgent);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('invalid tool arguments are rejected by zod validation', () => {
    const registry = buildRegistry();
    const orderTool = registry.find('get_order')!;
    const parsed = orderTool.schema.safeParse({ orderId: 123 });
    expect(parsed.success).toBe(false);
  });
});