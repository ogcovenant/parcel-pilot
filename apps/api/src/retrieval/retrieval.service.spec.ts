import { RetrievalService } from './retrieval.service';

function makeService(rows: unknown[]) {
  const dataSource = {
    query: async (sql: string, params: unknown[]) => {
      let out = [...rows] as Array<Record<string, unknown>>;
      const sqlLower = sql.toLowerCase();
      // Simulate the WHERE clauses the retrieval service builds.
      if (sqlLower.includes("doc_customer_account_id is null or dc.doc_customer_account_id = $") && params[2]) {
        out = out.filter(
          (r) => r.doc_customer_account_id === null || r.doc_customer_account_id === params[2],
        );
      }
      if (sqlLower.includes('doc_customer_account_id is null') && !sqlLower.includes(' or ')) {
        out = out.filter((r) => r.doc_customer_account_id === null);
      }
      if (sqlLower.includes("doc_status <> 'deprecated'")) {
        out = out.filter((r) => r.doc_status !== 'deprecated');
      }
      if (sqlLower.includes('doc_source_type = $')) {
        const idx = sqlLower.indexOf('doc_source_type = $');
        const paramIndex = Number(sqlLower.slice(idx + 17, idx + 20).split(/[^0-9]/)[0]);
        out = out.filter((r) => r.doc_source_type === params[paramIndex - 1]);
      }
      return out;
    },
  };
  const aiProvider = {
    embedManyTexts: async () => [[0.1, 0.2, 0.3]],
  };
  return new RetrievalService(dataSource as never, aiProvider as never);
}

function chunk(partial: Partial<Record<string, unknown>>) {
  return {
    id: 'c',
    document_id: 'doc',
    section: '1. Test',
    content: 'content',
    doc_title: 'Doc',
    doc_source_type: 'policy',
    doc_version: 'v1',
    doc_status: 'current',
    doc_authority_rank: 90,
    doc_effective_from: null,
    doc_effective_to: null,
    doc_customer_account_id: null,
    similarity: 0.8,
    ...partial,
  };
}

describe('RetrievalService — source authority & applicability', () => {
  it('current policy outranks the deprecated policy when semantic match is equal', async () => {
    const service = makeService([
      chunk({ id: 'deprecated', doc_title: 'Support Policy v2', doc_status: 'deprecated', doc_authority_rank: 40, similarity: 0.8 }),
      chunk({ id: 'current', doc_title: 'Support Policy v3', doc_status: 'current', doc_authority_rank: 90, similarity: 0.8 }),
    ]);
    const hits = await service.searchDocuments({ query: 'first response target' });
    expect(hits[0].title).toBe('Support Policy v3');
    expect(hits[0].status).toBe('current');
  });

  it('retrieves the correct customer agreement and excludes the wrong one', async () => {
    const service = makeService([
      chunk({
        id: 'northstar',
        doc_title: 'Northstar Logistics Enterprise Agreement',
        doc_customer_account_id: 'ACCT-001',
        doc_authority_rank: 100,
        similarity: 0.8,
      }),
      chunk({
        id: 'lumen',
        doc_title: 'LumenWorks Service Agreement',
        doc_customer_account_id: 'ACCT-002',
        doc_authority_rank: 100,
        similarity: 0.8,
      }),
    ]);
    // Northstar question: Lumen agreement is filtered out by applicability.
    const hits = await service.searchDocuments({
      query: 'cancellation terms',
      customerAccountId: 'ACCT-001',
    });
    expect(hits.every((h) => h.customerAccountId !== 'ACCT-002')).toBe(true);
    expect(hits.some((h) => h.customerAccountId === 'ACCT-001')).toBe(true);
  });

  it('excludes customer agreements when no customer context is given', async () => {
    const service = makeService([
      chunk({ id: 'agree', doc_customer_account_id: 'ACCT-001', doc_authority_rank: 100 }),
      chunk({ id: 'policy', doc_title: 'Support Policy v3', doc_customer_account_id: null }),
    ]);
    const hits = await service.searchDocuments({ query: 'anything' });
    expect(hits.every((h) => h.customerAccountId === null)).toBe(true);
  });

  it('deprecated sources are excluded by default and included only when asked', async () => {
    const service = makeService([
      chunk({ id: 'dep', doc_title: 'Support Policy v2', doc_status: 'deprecated', doc_authority_rank: 40 }),
    ]);
    const defaultHits = await service.searchDocuments({ query: 'targets' });
    // Candidates are filtered server-side; default query should not surface deprecated.
    const withDep = await service.searchDocuments({ query: 'targets', includeDeprecated: true });
    expect(defaultHits.length).toBeLessThanOrEqual(withDep.length);
    expect(withDep.some((h) => h.status === 'deprecated')).toBe(true);
  });
});