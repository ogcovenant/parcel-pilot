import { Injectable } from '@nestjs/common';

/**
 * Deterministic severity classifier using the Support Policy v3 definitions.
 * P1 = outage/security/credential exposure, P2 = material feature degradation
 * with a workaround, P3 = minor/how-to/config.
 */
@Injectable()
export class SeverityClassifier {
  private readonly p1Patterns = [
    /all shipment creation/i,
    /cannot create.*shipment/i,
    /http 500/i,
    /internal server error/i,
    /outage/i,
    /api key/i,
    /credential/i,
    /security/i,
    /breach/i,
    /leak/i,
  ];

  private readonly p2Patterns = [
    /bulk upload/i,
    /csv/i,
    /webhook/i,
    /still shows/i,
    /shows book/i,
    /not updating/i,
    /fails/i,
    /intermittent/i,
    /error/i,
  ];

  classify(subject: string, description: string): 'P1' | 'P2' | 'P3' {
    const text = `${subject} ${description}`;
    if (this.p1Patterns.some((p) => p.test(text))) return 'P1';
    if (this.p2Patterns.some((p) => p.test(text))) return 'P2';
    return 'P3';
  }
}
