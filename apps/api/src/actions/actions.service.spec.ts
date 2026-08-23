import { ActionsService } from './actions.service';
import { AccessControlService } from '../auth/access-control.service';
import { MOCK_USERS, User } from '../auth/mock-users';

class FakeRepo<T extends { id: string }> {
  store: T[] = [];
  create(data: Partial<T>): T {
    return { ...data } as T;
  }
  async findOne(opts: { where: Partial<T> }): Promise<T | null> {
    return this.store.find((r) =>
      Object.entries(opts.where).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
    ) ?? null;
  }
  async find(): Promise<T[]> {
    return this.store;
  }
  async save(entity: T): Promise<T> {
    if (!entity.id) (entity as { id: string }).id = crypto.randomUUID();
    const idx = this.store.findIndex((r) => r.id === entity.id);
    if (idx === -1) this.store.push(entity);
    else this.store[idx] = entity;
    return entity;
  }
}

function fakeDataSource(ticketRepo: FakeRepo<never> | null = null) {
  const repos = new Map<string, FakeRepo<never>>();
  if (ticketRepo) repos.set('Ticket', ticketRepo);
  return {
    getRepository(entity: { name: string }) {
      if (!repos.has(entity.name)) repos.set(entity.name, new FakeRepo());
      return repos.get(entity.name)!;
    },
  };
}

describe('ActionsService — action lifecycle', () => {
  const accessControl = new AccessControlService();
  const manager = MOCK_USERS['manager@parcelpilot.local'];
  const agent = MOCK_USERS['agent@parcelpilot.local'];

  let dataSource: ReturnType<typeof fakeDataSource>;
  let service: ActionsService;

  // Stub ticket so prepareEscalation can resolve the ticket.
  const ticketRepo = {
    store: [
      {
        id: 't1',
        ticketId: 'TKT-501',
        account: { accountId: 'ACCT-001' },
      },
    ],
    create: (x: never) => x,
    findOne: async (opts: { where: { ticketId: string } }) =>
      ticketRepo.store.find((r) => r.ticketId === opts.where.ticketId) ?? null,
    find: async () => ticketRepo.store,
    save: async (e: never) => e,
  };

  beforeEach(() => {
    dataSource = fakeDataSource(ticketRepo as never);
    service = new ActionsService(dataSource as never, accessControl);
  });

  it('prepare does not create an executed action (no mutation until confirm)', async () => {
    const prepared = await service.prepareEscalation(manager, {
      ticketId: 'TKT-501',
      priority: 'P1',
      targetTeam: 'Carrier Operations',
      reason: 'Outage',
      evidence: [],
    });
    expect(prepared.status).toBe('prepared');
    const escalations = await service.listEscalations();
    expect(escalations).toHaveLength(1);
    expect(escalations[0].status).toBe('prepared');
    expect(escalations[0].executedAt).toBeUndefined();
  });

  it('no confirmation = no execution (action rejected)', async () => {
    const prepared = await service.prepareEscalation(manager, {
      ticketId: 'TKT-501',
      priority: 'P1',
      targetTeam: 'Carrier Operations',
      reason: 'Outage',
      evidence: [],
    });
    const result = await service.executeEscalation(manager, prepared.referenceId, false);
    expect(result.status).toBe('rejected');
    const stored = (await service.listEscalations())[0];
    expect(stored.status).toBe('rejected');
    expect(stored.executedAt).toBeUndefined();
  });

  it('confirmation = execution', async () => {
    const prepared = await service.prepareEscalation(manager, {
      ticketId: 'TKT-501',
      priority: 'P1',
      targetTeam: 'Carrier Operations',
      reason: 'Outage',
      evidence: [],
    });
    const result = await service.executeEscalation(manager, prepared.referenceId, true);
    expect(result.status).toBe('executed');
    const stored = (await service.listEscalations())[0];
    expect(stored.status).toBe('executed');
    expect(stored.executedAt).not.toBeNull();
  });

  it('executing a rejected action fails honestly', async () => {
    const prepared = await service.prepareEscalation(manager, {
      ticketId: 'TKT-501',
      priority: 'P1',
      targetTeam: 'Carrier Operations',
      reason: 'Outage',
      evidence: [],
    });
    await service.executeEscalation(manager, prepared.referenceId, false);
    await expect(
      service.executeEscalation(manager, prepared.referenceId, true),
    ).rejects.toThrow(/not 'prepared'/);
  });

  it('support_agent cannot execute escalations', async () => {
    const prepared = await service.prepareEscalation(manager, {
      ticketId: 'TKT-501',
      priority: 'P1',
      targetTeam: 'Carrier Operations',
      reason: 'Outage',
      evidence: [],
    });
    await expect(service.executeEscalation(agent, prepared.referenceId, true)).rejects.toThrow(
      /manager or operations role/,
    );
  });
});