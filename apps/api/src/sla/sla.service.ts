import { Injectable } from '@nestjs/common';

/**
 * Business calendar and SLA calculation.
 * All times are stored as UTC instants; business reasoning happens in the
 * dataset timezone (Asia/Kolkata = UTC+05:30, no DST).
 */
@Injectable()
export class SlaService {
  private readonly KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  private readonly WORK_START_LOCAL = 9 * 60; // 09:00 Kolkata
  private readonly WORK_END_LOCAL = 18 * 60; // 18:00 Kolkata

  private toLocalMinutes(date: Date): number {
    const local = new Date(date.getTime() + this.KOLKATA_OFFSET_MS);
    return local.getUTCHours() * 60 + local.getUTCMinutes();
  }

  private isWeekend(date: Date): boolean {
    const local = new Date(date.getTime() + this.KOLKATA_OFFSET_MS);
    const day = local.getUTCDay();
    return day === 0 || day === 6;
  }

  private startOfWork(date: Date): Date {
    const local = new Date(date.getTime() + this.KOLKATA_OFFSET_MS);
    local.setUTCHours(9, 0, 0, 0);
    return new Date(local.getTime() - this.KOLKATA_OFFSET_MS);
  }

  private isWithinWorkday(date: Date): boolean {
    if (this.isWeekend(date)) return false;
    const minutes = this.toLocalMinutes(date);
    return minutes >= this.WORK_START_LOCAL && minutes < this.WORK_END_LOCAL;
  }

  /** Advance `minutes` of working time from `from`, skipping weekends and after-hours. */
  addBusinessMinutes(from: Date, minutes: number): Date {
    let current = from;
    let remaining = minutes;
    while (remaining > 0) {
      if (this.isWeekend(current)) {
        current = this.startOfWork(nextDay(current));
        continue;
      }
      const minutes = this.toLocalMinutes(current);
      if (minutes < this.WORK_START_LOCAL) {
        current = this.startOfWork(current);
        continue;
      }
      if (minutes >= this.WORK_END_LOCAL) {
        current = this.startOfWork(nextDay(current));
        continue;
      }
      const available = this.WORK_END_LOCAL - minutes;
      if (available >= remaining) {
        return new Date(current.getTime() + remaining * 60 * 1000);
      }
      remaining -= available;
      current = this.startOfWork(nextDay(current));
    }
    return current;
  }

  /** Advance `days` of full business days from `from` (start of first workday). */
  addBusinessDays(from: Date, days: number): Date {
    let current = from;
    let remaining = days;
    while (remaining > 0) {
      if (this.isWeekend(current)) {
        current = this.startOfWork(nextDay(current));
        continue;
      }
      if (this.toLocalMinutes(current) >= this.WORK_END_LOCAL) {
        current = this.startOfWork(nextDay(current));
        continue;
      }
      current = this.startOfWork(nextDay(current));
      remaining -= 1;
    }
    return current;
  }

  /**
   * Compute the SLA first-response due time for a ticket.
   * Targets come from the applicable source (customer agreement first, else policy v3).
   */
  computeSlaDue(
    createdAt: Date,
    plan: string,
    severity: string,
    override?: {
      p1?: {
        value: number;
        unit:
          'minutes' | 'business_minutes' | 'business_hours' | 'business_days';
      };
      p2?: {
        value: number;
        unit:
          'minutes' | 'business_minutes' | 'business_hours' | 'business_days';
      };
      p3?: {
        value: number;
        unit:
          'minutes' | 'business_minutes' | 'business_hours' | 'business_days';
      };
    },
  ): Date {
    const target =
      override?.[severity.toLowerCase() as 'p1' | 'p2' | 'p3'] ??
      defaultTarget(plan, severity);

    switch (target.unit) {
      case 'minutes':
        return new Date(createdAt.getTime() + target.value * 60 * 1000);
      case 'business_minutes':
        return this.addBusinessMinutes(createdAt, target.value);
      case 'business_hours':
        return this.addBusinessMinutes(createdAt, target.value * 60);
      case 'business_days':
        return this.addBusinessDays(createdAt, target.value);
    }
  }
}

function nextDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

type Target = {
  value: number;
  unit: 'minutes' | 'business_minutes' | 'business_hours' | 'business_days';
};

/** Policy v3 default first-response targets by plan. */
function defaultTarget(plan: string, severity: string): Target {
  const key = severity.toLowerCase();
  if (plan === 'enterprise') {
    switch (key) {
      case 'p1':
        return { value: 30, unit: 'minutes' };
      case 'p2':
        return { value: 2, unit: 'business_hours' };
      default:
        return { value: 1, unit: 'business_days' };
    }
  }
  if (plan === 'growth') {
    switch (key) {
      case 'p1':
        return { value: 2, unit: 'business_hours' };
      case 'p2':
        return { value: 4, unit: 'business_hours' };
      default:
        return { value: 2, unit: 'business_days' };
    }
  }
  switch (key) {
    case 'p1':
      return { value: 4, unit: 'business_hours' };
    case 'p2':
      return { value: 1, unit: 'business_days' };
    default:
      return { value: 2, unit: 'business_days' };
  }
}
