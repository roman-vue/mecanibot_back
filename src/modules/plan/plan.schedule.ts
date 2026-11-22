import { DEFAULT_KM_PER_MONTH } from './plan.catalog';

const DAYS_PER_MONTH = 30.44;

export function toYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addMonths(d: Date, months: number): Date {
  const whole = Math.floor(months);
  const result = new Date(d.getFullYear(), d.getMonth() + whole, d.getDate());
  result.setDate(result.getDate() + Math.round((months - whole) * DAYS_PER_MONTH));
  return result;
}

export function monthsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (DAYS_PER_MONTH * 24 * 3600 * 1000);
}

export function usageFor(type: number | null | undefined, kmPerMonth?: number | null): number {
  if (kmPerMonth && kmPerMonth > 0) return kmPerMonth;
  return DEFAULT_KM_PER_MONTH[type ?? 2] ?? 1000;
}

export interface DueInput {
  baseDate: Date;
  baseKm: number | null;
  intervalKm: number | null;
  intervalMonths: number;
  currentKm: number | null;
  kmPerMonth: number;
  // A new plan may show a task as overdue; recalculations keep it from tomorrow on.
  allowPast?: boolean;
}

// A task is due by time or by km, whichever comes first, and never before tomorrow unless allowPast.
export function computeDueDate(input: DueInput): Date {
  let due = addMonths(input.baseDate, input.intervalMonths);

  if (input.intervalKm) {
    const baseKm = input.baseKm ?? input.currentKm ?? 0;
    const currentKm = input.currentKm ?? baseKm;
    const remainingKm = baseKm + input.intervalKm - currentKm;
    const byKm = remainingKm <= 0 ? today() : addMonths(today(), remainingKm / input.kmPerMonth);
    if (byKm < due) due = byKm;
  }

  const t = today();
  if (!input.allowPast && due <= t) {
    due = new Date(t);
    due.setDate(due.getDate() + 1);
  }
  return due;
}

export function parseKm(km: string | number | null | undefined): number | null {
  const raw = String(km ?? '').trim();
  if (raw === '') return null;
  const n = Number(raw.replace(/\D/g, ''));
  return Number.isFinite(n) ? n : null;
}
