import { describe, expect, it } from 'vitest';
import { addMonths, computeDueDate, parseKm, toYmd, today } from '../src/modules/plan/plan.schedule';
import { validatePlan, parsePlan, normalizeModel } from '../src/modules/plan/plan.service';
import { catalogFor } from '../src/modules/plan/plan.catalog';

describe('computeDueDate', () => {
  it('uses the time limit when km is far away', () => {
    const base = today();
    const due = computeDueDate({ baseDate: base, baseKm: 0, intervalKm: 100000, intervalMonths: 6, currentKm: 0, kmPerMonth: 100 });
    expect(toYmd(due)).toBe(toYmd(addMonths(base, 6)));
  });

  it('uses the km limit when it comes first', () => {
    const due = computeDueDate({ baseDate: today(), baseKm: 0, intervalKm: 1000, intervalMonths: 12, currentKm: 0, kmPerMonth: 1000 });
    expect(toYmd(due)).toBe(toYmd(addMonths(today(), 1)));
  });

  it('never returns a date before tomorrow', () => {
    const due = computeDueDate({ baseDate: addMonths(today(), -24), baseKm: 0, intervalKm: null, intervalMonths: 6, currentKm: null, kmPerMonth: 1000 });
    expect(due > today()).toBe(true);
  });
});

describe('plan helpers', () => {
  it('parses JSON wrapped in a code block', () => {
    expect(parsePlan('```json\n{"tasks":[{"id":"oil_change"}]}\n```')?.tasks).toHaveLength(1);
    expect(parsePlan('no json here')).toBeNull();
  });

  it('clamps intervals to the catalog range and drops unknown tasks', () => {
    const chosen = validatePlan({ tasks: [{ id: 'oil_change', interval_km: 999999, interval_months: 0 }, { id: 'nope' }] }, catalogFor(1));
    expect([...chosen.keys()]).toEqual(['oil_change']);
    expect(chosen.get('oil_change')).toMatchObject({ interval_km: 10000, interval_months: 4 });
  });

  it('normalizes model names for the cache', () => {
    expect(normalizeModel('  TVS  Raider-125 ')).toBe('tvs raider 125');
  });

  it('parses km text', () => {
    expect(parseKm('12.500')).toBe(12500);
    expect(parseKm('')).toBeNull();
  });
});
