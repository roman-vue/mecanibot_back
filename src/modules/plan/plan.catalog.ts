// The AI may only pick task ids from this closed list; anything else is discarded (avoids hallucinated tasks).
export const VEHICLE_TYPES = { ebike: 0, motorcycle: 1, car: 2 } as const;

export interface CatalogTask {
  id: string;
  name: string;
  km: { min: number; max: number; def: number } | null;
  months: { min: number; max: number; def: number };
}

export type Range = { min: number; max: number; def: number };
const r = (min: number, max: number, def: number): Range => ({ min, max, def });

const MOTO: CatalogTask[] = [
  { id: "oil_change",      name: "Cambio de aceite de motor",            km: r(1000, 10000, 3000),  months: r(1, 12, 4) },
  { id: "air_filter",      name: "Limpieza o cambio de filtro de aire",  km: r(3000, 20000, 6000),  months: r(3, 24, 6) },
  { id: "spark_plug",      name: "Revisión o cambio de bujía",           km: r(3000, 20000, 8000),  months: r(6, 24, 12) },
  { id: "chain_kit",       name: "Lubricación y tensión de cadena",      km: r(300, 3000, 1000),    months: r(1, 6, 1) },
  { id: "brakes",          name: "Revisión de frenos",                   km: r(2000, 15000, 5000),  months: r(3, 12, 6) },
  { id: "tires",           name: "Revisión de llantas y presión",        km: r(500, 10000, 2000),   months: r(1, 6, 1) },
  { id: "battery",         name: "Revisión de batería",                  km: null,                  months: r(3, 24, 6) },
  { id: "valve_clearance", name: "Calibración de válvulas",              km: r(4000, 24000, 8000),  months: r(6, 24, 12) },
  { id: "general_service", name: "Revisión general (sincronización)",    km: r(3000, 20000, 6000),  months: r(3, 12, 6) },
];

const CARRO: CatalogTask[] = [
  { id: "oil_change",         name: "Cambio de aceite de motor",          km: r(3000, 15000, 5000),   months: r(3, 12, 6) },
  { id: "oil_filter",         name: "Cambio de filtro de aceite",         km: r(3000, 15000, 5000),   months: r(3, 12, 6) },
  { id: "air_filter",         name: "Cambio de filtro de aire",           km: r(10000, 40000, 15000), months: r(6, 24, 12) },
  { id: "cabin_filter",       name: "Cambio de filtro de cabina",         km: r(10000, 30000, 15000), months: r(6, 24, 12) },
  { id: "spark_plug",         name: "Cambio de bujías",                   km: r(20000, 100000, 40000),months: r(12, 60, 24) },
  { id: "brakes",             name: "Revisión de frenos",                 km: r(5000, 30000, 10000),  months: r(6, 12, 6) },
  { id: "tires",              name: "Revisión de llantas y rotación",     km: r(5000, 15000, 10000),  months: r(3, 12, 6) },
  { id: "battery",            name: "Revisión de batería",                km: null,                   months: r(6, 24, 12) },
  { id: "coolant",            name: "Cambio de refrigerante",             km: r(20000, 100000, 40000),months: r(12, 60, 24) },
  { id: "alignment",          name: "Alineación y balanceo",              km: r(5000, 20000, 10000),  months: r(6, 12, 6) },
  { id: "timing_belt",        name: "Revisión de correa de distribución", km: r(40000, 120000, 60000),months: r(24, 84, 48) },
  { id: "suspension",         name: "Revisión de suspensión",             km: r(10000, 40000, 20000), months: r(6, 24, 12) },
  { id: "transmission_fluid", name: "Cambio de aceite de caja",           km: r(30000, 100000, 50000),months: r(24, 60, 36) },
  { id: "general_service",    name: "Revisión general",                   km: r(5000, 20000, 10000),  months: r(6, 12, 12) },
];

const EBIKE: CatalogTask[] = [
  { id: "ebike_battery", name: "Revisión de batería",                 km: null,               months: r(1, 12, 3) },
  { id: "brakes",        name: "Revisión de frenos",                  km: r(300, 3000, 1000), months: r(1, 6, 3) },
  { id: "chain_kit",     name: "Lubricación de cadena",               km: r(100, 1000, 300),  months: r(1, 3, 1) },
  { id: "tires",         name: "Revisión de llantas y presión",       km: r(100, 2000, 500),  months: r(1, 3, 1) },
  { id: "electrical",    name: "Revisión de sistema eléctrico",       km: null,               months: r(3, 12, 6) },
  { id: "motor_check",   name: "Revisión de motor eléctrico",         km: r(1000, 10000, 3000), months: r(6, 24, 12) },
];

export const CATALOG: Record<number, CatalogTask[]> = { 0: EBIKE, 1: MOTO, 2: CARRO };

// Used to turn km intervals into dates until the vehicle's real usage is learned.
export const DEFAULT_KM_PER_MONTH: Record<number, number> = { 0: 300, 1: 1000, 2: 1000 };

// Free-text last_task (older app versions) is matched to catalog ids by keyword.
const TASK_KEYWORDS: Record<string, RegExp> = {
  oil_change: /aceite(?! de caja)|oil/,
  oil_filter: /filtro de aceite|aceite y filtro/,
  air_filter: /filtro de aire/,
  cabin_filter: /cabina/,
  spark_plug: /buj/,
  chain_kit: /cadena|chain/,
  brakes: /fren|pastilla|brake/,
  tires: /llanta|neum|presi[oó]n|rotaci/,
  battery: /bater/,
  ebike_battery: /bater/,
  valve_clearance: /v[aá]lvula/,
  coolant: /refrigerante|coolant/,
  alignment: /alineaci|balanceo/,
  timing_belt: /correa|distribuci/,
  suspension: /suspensi|amortigua/,
  transmission_fluid: /aceite de caja|transmisi/,
  electrical: /el[eé]ctric/,
  general_service: /general|sincroniz|servicio completo/,
};

export function matchTasks(type: number, text: string | null | undefined): string[] {
  const t = (text ?? '').toLowerCase();
  if (!t.trim() || t.trim() === 'ninguno') return [];
  const catalog = catalogFor(type);
  const parts = t.split(',').map((p) => p.trim());
  const exact = catalog.filter((task) => parts.includes(task.name.toLowerCase())).map((task) => task.id);
  if (exact.length === parts.length) return exact;
  return catalog.filter((task) => TASK_KEYWORDS[task.id]?.test(t)).map((task) => task.id);
}

export function catalogFor(type: number): CatalogTask[] {
  return CATALOG[type] ?? CARRO;
}

export function clamp(value: unknown, range: Range): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return range.def;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}
