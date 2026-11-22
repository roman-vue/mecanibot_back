import { askJson } from '../../integrations/openai';
import { logger } from '../../middlewares/logger.middleware';
import { CatalogTask, catalogFor, clamp, matchTasks } from './plan.catalog';
import { AiPlan, AiTask, readCachedPlan, saveCachedPlan } from './plan.model';
import { computeDueDate, parseKm, parseYmd, toYmd, today, usageFor } from './plan.schedule';

export interface PlannedTask {
  task_id: string;
  message: string;
  description: string;
  dateTime: string;
  interval_km: number | null;
  interval_months: number;
  base_km: number | null;
  base_date: string;
}

export interface VehicleForPlan {
  type: number;
  model: string;
  km: string;
  lastMaintenance: string;
  lastTask: string;
  // Catalog ids done at lastMaintenance; when absent they are inferred from lastTask.
  lastTasks?: string[];
  // Odometer at lastMaintenance; when absent the current km is used (never guessed from usage).
  lastKm?: string;
  // Per-task last known service (from history); wins over lastTasks.
  taskBases?: Record<string, { date: string; km: number | null }>;
}

const TYPE_NAMES: Record<number, string> = { 0: 'electrobici (bicicleta eléctrica)', 1: 'moto', 2: 'carro' };
const TYPICAL_SOURCE = 'intervalo típico para este tipo de vehículo';
const INSTRUCTIONS = 'Eres un experto en mantenimiento de vehículos. Respondes únicamente con JSON válido.';

const MAX_DISAGREEMENT = 0.25;

const formatKm = (n: number) => n.toLocaleString('es-CO');

export function normalizeModel(model: string): string {
  return model
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildPrompt(type: number, model: string, catalog: CatalogTask[]): string {
  const list = catalog
    .map((t) => `- ${t.id}: ${t.name}${t.km ? ` (rango km ${t.km.min}-${t.km.max})` : ' (solo por tiempo)'} (rango meses ${t.months.min}-${t.months.max})`)
    .join('\n');
  const typeName = TYPE_NAMES[type] ?? 'carro';

  return `
Vehículo: ${typeName}, marca y modelo "${model}".

Busca en internet el plan de mantenimiento del fabricante (manual de usuario o de servicio) para "${model}" (${typeName}).

Elige SOLO tareas de esta lista cerrada (usa exactamente el id). No inventes tareas ni ids:
${list}

Evalúa TODAS las tareas de la lista. Para cada una indica el intervalo PERIÓDICO recomendado por el fabricante
(interval_km y interval_months; si la tarea es solo por tiempo usa interval_km: null).
Usa el intervalo regular de servicio, NO el del primer servicio de rodaje/asentamiento.
Si el nombre de la tarea empieza por "Revisión", da el intervalo de INSPECCIÓN, no el de reemplazo de la pieza.
Indica en "basis" si el dato viene del fabricante ("manual") o es un valor típico para ese tipo de vehículo ("typical").

Responde SOLO con JSON válido, sin texto adicional ni bloques de código:
{"source": "fuente principal (ej. Manual de servicio TVS Raider 125)", "tasks": [{"id": "oil_change", "interval_km": 5000, "interval_months": 6, "basis": "manual", "reason": "por qué es importante, en una frase, SIN mencionar intervalos ni km"}]}
`.trim();
}

export function parsePlan(text: string): AiPlan | null {
  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(parsed?.tasks) ? (parsed as AiPlan) : null;
  } catch {
    return null;
  }
}

async function askAiPlan(prompt: string, cacheKey: string): Promise<AiPlan | null> {
  try {
    return parsePlan(await askJson(INSTRUCTIONS, prompt, { webSearch: true, cacheKey }));
  } catch (err) {
    logger.warn('OpenAI with web search failed, retrying without it', { err: String(err) });
  }
  try {
    return parsePlan(await askJson(INSTRUCTIONS, prompt, { cacheKey }));
  } catch (err) {
    logger.error('OpenAI failed, using catalog defaults', { err: String(err) });
    return null;
  }
}

type ValidTask = AiTask & { task: CatalogTask };

const agree = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? a == b : Math.abs(a - b) <= MAX_DISAGREEMENT * Math.max(a, b);
const shorter = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? a ?? b ?? null : Math.min(a, b));

// Two independent answers per model: a task is trusted only when both agree, then the shorter interval wins.
export function mergePlans(a: Map<string, ValidTask>, b: Map<string, ValidTask>): Map<string, ValidTask> {
  if (!a.size) return b;
  if (!b.size) return a;
  const merged = new Map<string, ValidTask>();
  const inconsistent: string[] = [];
  for (const [id, x] of a) {
    const y = b.get(id);
    if (!y) continue;
    if (!agree(x.interval_km, y.interval_km) || !agree(x.interval_months, y.interval_months)) {
      inconsistent.push(id);
      continue;
    }
    merged.set(id, {
      ...x,
      interval_km: shorter(x.interval_km, y.interval_km),
      interval_months: shorter(x.interval_months, y.interval_months) ?? x.interval_months,
      basis: x.basis === 'manual' && y.basis === 'manual' ? 'manual' : 'typical',
    });
  }
  if (inconsistent.length) logger.warn('AI answers disagree, using catalog defaults', { inconsistent });
  return merged;
}

// Keeps only catalog tasks and clamps their intervals to the catalog ranges.
export function validatePlan(plan: AiPlan | null, catalog: CatalogTask[]): Map<string, ValidTask> {
  const byId = new Map(catalog.map((t) => [t.id, t]));
  const chosen = new Map<string, ValidTask>();
  const discarded: string[] = [];

  for (const t of plan?.tasks ?? []) {
    const task = byId.get(String(t?.id));
    if (!task) {
      discarded.push(String(t?.id));
      continue;
    }
    if (chosen.has(task.id)) continue;
    chosen.set(task.id, {
      task,
      id: task.id,
      interval_km: task.km ? clamp(t.interval_km, task.km) : null,
      interval_months: clamp(t.interval_months, task.months),
      basis: t.basis === 'manual' ? 'manual' : 'typical',
      reason: typeof t.reason === 'string' ? t.reason.slice(0, 300) : undefined,
    });
  }
  if (discarded.length) logger.warn('AI suggested tasks outside the catalog (discarded)', { discarded });
  return chosen;
}

// Never throws because of the AI: every catalog task is planned, the AI only refines intervals.
export async function buildMaintenancePlan(v: VehicleForPlan): Promise<PlannedTask[]> {
  const catalog = catalogFor(v.type);
  const cacheKey = `${v.type}|${normalizeModel(v.model)}`;

  const cached = readCachedPlan(cacheKey);
  let chosen: Map<string, ValidTask>;
  let rawSource: string | undefined;
  if (cached) {
    chosen = validatePlan(cached, catalog);
    rawSource = cached.source;
  } else {
    const prompt = buildPrompt(v.type, v.model, catalog);
    const [a, b] = await Promise.all([askAiPlan(prompt, cacheKey), askAiPlan(prompt, cacheKey)]);
    chosen = mergePlans(validatePlan(a, catalog), validatePlan(b, catalog));
    rawSource = a?.source ?? b?.source;
  }
  const aiSource = chosen.size > 0 && rawSource ? String(rawSource).slice(0, 120) : null;

  // Only validated AI results are cached, so a failed call is never reused.
  if (!cached && chosen.size > 0) {
    const tasks = [...chosen.values()].map(({ task: _task, ...t }) => t);
    try {
      saveCachedPlan(cacheKey, v.type, v.model, { tasks, source: aiSource ?? undefined });
    } catch (err) {
      logger.error('Could not cache maintenance plan', { cacheKey, err: String(err) });
    }
  }

  const lastDate = parseYmd(v.lastMaintenance) ?? today();
  const usage = usageFor(v.type);
  const currentKm = parseKm(v.km);
  const lastKm = parseKm(v.lastKm) ?? currentKm;
  const done = new Set(v.lastTasks?.length ? v.lastTasks : matchTasks(v.type, v.lastTask));

  const planned = catalog.map((task): PlannedTask => {
    const ai = chosen.get(task.id);
    const intervalKm = ai ? ai.interval_km ?? null : task.km?.def ?? null;
    const months = ai?.interval_months ?? task.months.def;
    const source = ai ? aiSource ?? TYPICAL_SOURCE : TYPICAL_SOURCE;

    const monthsText = months === 1 ? '1 mes' : `${months} meses`;
    const every = intervalKm ? `Cada ${formatKm(intervalKm)} km o ${monthsText}, lo que ocurra primero` : `Cada ${monthsText}`;
    const why = ai?.reason ? ai.reason.replace(/[.\s]+$/, '') + '. ' : '';
    // Tasks done at the last maintenance count from that day; the rest from today (history unknown).
    const known = v.taskBases?.[task.id];
    const wasDone = done.has(task.id);
    const baseDate = known ? parseYmd(known.date) ?? today() : wasDone ? lastDate : today();
    const baseKm = known ? known.km ?? currentKm : wasDone ? lastKm : currentKm;
    const due = computeDueDate({ baseDate, baseKm, intervalKm, intervalMonths: months, currentKm, kmPerMonth: usage, allowPast: true });

    return {
      task_id: task.id,
      message: task.name,
      description: `${why}${every}. Fuente: ${source}.`,
      dateTime: toYmd(due),
      interval_km: intervalKm,
      interval_months: months,
      base_km: baseKm,
      base_date: toYmd(baseDate),
    };
  });

  planned.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  logger.info('Maintenance plan built', { cacheKey, fromCache: !!cached, aiTasks: chosen.size, tasks: planned.length });
  return planned;
}
