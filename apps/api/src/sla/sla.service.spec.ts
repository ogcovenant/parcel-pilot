import { SlaService } from './sla.service';

describe('SlaService — business calendar', () => {
  const service = new SlaService();

  it('24x7 P1 target uses wall-clock time', () => {
    const created = new Date('2026-08-16T05:00:00.000Z'); // Sunday 10:30 Kolkata
    const due = service.computeSlaDue(created, 'enterprise', 'P1');
    expect(due.toISOString()).toBe('2026-08-16T05:30:00.000Z'); // +30 min
  });

  it('business-hours target rolls forward to Monday for a Sunday ticket', () => {
    const created = new Date('2026-08-16T04:15:00.000Z'); // Sunday 09:45 Kolkata
    // Growth P1 = 2 business hours; next workday is Mon 09:00 Kolkata = 03:30 UTC
    const due = service.computeSlaDue(created, 'growth', 'P1');
    expect(due.toISOString()).toBe('2026-08-17T05:30:00.000Z'); // Mon 11:00 Kolkata
  });

  it('Northstar agreement override: P1 = 15 minutes', () => {
    const created = new Date('2026-08-16T05:00:00.000Z');
    const due = service.computeSlaDue(created, 'enterprise', 'P1', {
      p1: { value: 15, unit: 'minutes' },
    });
    expect(due.toISOString()).toBe('2026-08-16T05:15:00.000Z');
  });

  it('Northstar P3 = 8 business hours', () => {
    const created = new Date('2026-08-16T04:30:00.000Z'); // Sunday 10:00 Kolkata
    const due = service.computeSlaDue(created, 'enterprise', 'P3', {
      p3: { value: 8, unit: 'business_hours' },
    });
    // Mon 09:00 + 8h = Mon 17:00 Kolkata = 11:30 UTC
    expect(due.toISOString()).toBe('2026-08-17T11:30:00.000Z');
  });

  it('standard P3 = 2 business days', () => {
    const created = new Date('2026-08-16T04:35:00.000Z'); // Sunday
    const due = service.computeSlaDue(created, 'standard', 'P3');
    // Mon 09:00 Kolkata start + 2 business days => Wed 09:00 Kolkata = 03:30 UTC
    expect(due.toISOString()).toBe('2026-08-19T03:30:00.000Z');
  });
});

describe('SlaService — severity classifier', () => {
  const { SeverityClassifier } = require('./severity-classifier');
  const classifier = new SeverityClassifier();

  it('classifies outage/security as P1', () => {
    expect(classifier.classify('All shipment creation is failing', 'HTTP 500 for every user')).toBe('P1');
    expect(classifier.classify('Possible API key exposure', 'key in a public channel')).toBe('P1');
  });

  it('classifies feature degradation as P2', () => {
    expect(classifier.classify('Bulk upload fails for CSV', 'fails at 70%')).toBe('P2');
    expect(classifier.classify('Order still shows BOOKED', 'SwiftShip webhook delay')).toBe('P2');
  });

  it('classifies how-to requests as P3', () => {
    expect(classifier.classify('How do we change the billing contact?', 'replace email')).toBe('P3');
  });
});