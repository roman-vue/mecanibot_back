import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/integrations/openai', () => ({
  askJson: vi.fn(async () => JSON.stringify({ source: 'Manual de prueba', tasks: [{ id: 'oil_change', interval_km: 3000, interval_months: 4 }] })),
}));
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

describe('buildMaintenancePlan base dates', () => {
  it('does not repeat a task done at the last maintenance soon after', async () => {
    const { buildMaintenancePlan } = await import('../src/modules/plan/plan.service');
    const lastMaintenance = toYmd(addMonths(today(), -3));
    const plan = await buildMaintenancePlan({
      type: 1, model: `test-moto-${Date.now()}`, km: '25000', lastMaintenance, lastTask: 'Cambio de aceite', lastKm: '25000',
    });
    const oil = plan.find((t) => t.task_id === 'oil_change')!;
    expect(oil.base_date).toBe(lastMaintenance);
    expect(oil.base_km).toBe(25000);
    const chain = plan.find((t) => t.task_id === 'chain_kit')!;
    expect(chain.base_date).toBe(toYmd(today()));
    expect(new Date(chain.dateTime) > today()).toBe(true);
  });

  it('shows an overdue task as overdue instead of tomorrow', async () => {
    const { buildMaintenancePlan } = await import('../src/modules/plan/plan.service');
    const plan = await buildMaintenancePlan({
      type: 1, model: `test-moto-${Date.now()}-b`, km: '25000', lastMaintenance: toYmd(addMonths(today(), -24)), lastTasks: ['battery'], lastTask: '',
    });
    const battery = plan.find((t) => t.task_id === 'battery')!;
    expect(new Date(`${battery.dateTime}T00:00:00`) < today()).toBe(true);
  });

  it('matches free-text last tasks to catalog ids', async () => {
    const { matchTasks } = await import('../src/modules/plan/plan.catalog');
    expect(matchTasks(2, 'Cambio de aceite y filtro')).toEqual(['oil_change', 'oil_filter']);
    expect(matchTasks(1, 'ninguno')).toEqual([]);
    expect(matchTasks(2, 'Cambio de filtro de aceite')).toEqual(['oil_filter']);
  });
});

describe('stable AI plans', () => {
  const plan = (km: number, months: number) => ({ tasks: [{ id: 'oil_change', interval_km: km, interval_months: months, basis: 'manual' as const }] });

  it('takes the shorter interval when both answers agree', async () => {
    const { mergePlans } = await import('../src/modules/plan/plan.service');
    const catalog = catalogFor(1);
    const merged = mergePlans(validatePlan(plan(3000, 4), catalog), validatePlan(plan(3500, 4), catalog));
    expect(merged.get('oil_change')?.interval_km).toBe(3000);
    expect(merged.get('oil_change')?.basis).toBe('manual');
  });

  it('drops a task when the answers disagree', async () => {
    const { mergePlans } = await import('../src/modules/plan/plan.service');
    const catalog = catalogFor(1);
    const merged = mergePlans(validatePlan(plan(2000, 4), catalog), validatePlan(plan(6000, 4), catalog));
    expect(merged.has('oil_change')).toBe(false);
  });

  it('uses the only valid answer when the other one failed', async () => {
    const { mergePlans } = await import('../src/modules/plan/plan.service');
    const catalog = catalogFor(1);
    const merged = mergePlans(validatePlan(null, catalog), validatePlan(plan(3000, 4), catalog));
    expect(merged.get('oil_change')?.interval_km).toBe(3000);
  });

  it('builds a prompt without user data', async () => {
    const { buildPrompt } = await import('../src/modules/plan/plan.service');
    const prompt = buildPrompt(1, 'TVS Raider 125', catalogFor(1));
    expect(prompt).not.toMatch(/Kilometraje|Fecha de hoy|Último mantenimiento/);
    expect(prompt).toMatch(/INSPECCIÓN/);
  });

  it('asks twice without cache and never with cache', async () => {
    const { askJson } = await import('../src/integrations/openai');
    const { buildMaintenancePlan } = await import('../src/modules/plan/plan.service');
    const v = { type: 1, model: `test-moto-${Date.now()}-c`, km: '1000', lastMaintenance: toYmd(today()), lastTask: '' };
    vi.mocked(askJson).mockClear();
    await buildMaintenancePlan(v);
    expect(vi.mocked(askJson)).toHaveBeenCalledTimes(2);
    vi.mocked(askJson).mockClear();
    await buildMaintenancePlan(v);
    expect(vi.mocked(askJson)).toHaveBeenCalledTimes(0);
  });
});
