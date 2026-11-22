import { db } from '../../config/database';
import { env } from '../../config/env';

export interface AiTask {
  id: string;
  interval_km?: number | null;
  interval_months?: number;
  basis?: 'manual' | 'typical';
  reason?: string;
}

export interface AiPlan {
  tasks: AiTask[];
  source?: string;
}

export function readCachedPlan(cacheKey: string): AiPlan | null {
  const row = db
    .prepare("SELECT plan_json, source FROM model_plans WHERE cache_key = ? AND created_at >= datetime('now', ?)")
    .get(cacheKey, `-${env.PLAN_CACHE_DAYS} days`) as { plan_json: string; source: string | null } | undefined;
  if (!row) return null;
  try {
    const tasks = JSON.parse(row.plan_json) as AiTask[];
    db.prepare('UPDATE model_plans SET hits = hits + 1 WHERE cache_key = ?').run(cacheKey);
    return { tasks, source: row.source ?? undefined };
  } catch {
    return null;
  }
}

export function saveCachedPlan(cacheKey: string, type: number, model: string, plan: AiPlan): void {
  db.prepare(
    `INSERT INTO model_plans (cache_key, type, model, plan_json, source, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(cache_key) DO UPDATE SET
       plan_json = excluded.plan_json, source = excluded.source,
       model = excluded.model, hits = 0, created_at = excluded.created_at`,
  ).run(cacheKey, type, model, JSON.stringify(plan.tasks), plan.source ?? null);
}
