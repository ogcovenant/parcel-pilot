import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface EvalCase {
  id: string;
  title: string;
  question: string;
  expectedTools: string[];
  expectedStatus: string;
  expectedSourceTypes: string[];
  expectedConfidence?: string;
  authorization: { role: string; accountId?: string };
  actionExpectations?: { prepared: boolean; executedWithoutConfirmation: boolean; executedAfterConfirmation: boolean };
}

describe('Evaluation cases — structural integrity', () => {
  const cases = JSON.parse(
    readFileSync(join(process.cwd(), '../../tests/evals/cases.json'), 'utf8'),
  ) as EvalCase[];

  it('contains at least 10 realistic scenarios', () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  it('every case has the required fields', () => {
    for (const c of cases) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.question).toBeTruthy();
      expect(Array.isArray(c.expectedTools)).toBe(true);
      expect(c.expectedStatus).toBeTruthy();
      expect(Array.isArray(c.expectedSourceTypes)).toBe(true);
      expect(c.authorization.role).toBeTruthy();
    }
  });

  it('every case has a unique id', () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all required evaluation themes', () => {
    const titles = cases.map((c) => c.title.toLowerCase());
    for (const theme of [
      'agreement override',
      'service credit',
      'sla calculation',
      'ticket investigation',
      'cross-customer',
      'unauthorized',
      'deprecated',
      'historical',
      'escalation',
      'policy lookup',
    ]) {
      expect(titles.some((t) => t.includes(theme))).toBe(true);
    }
  });
});