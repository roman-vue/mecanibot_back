import { db } from '../src/config/database';

const usd = (n: number | null) => `$${(n ?? 0).toFixed(4)}`;
const total = (since: string | null) =>
  (db.prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS calls FROM ai_usage ${since ? 'WHERE created_at >= datetime(\'now\', ?)' : ''}`)
    .get(...(since ? [since] : [])) as { cost: number; calls: number });

const today = db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS calls FROM ai_usage WHERE date(created_at) = date('now')").get() as { cost: number; calls: number };
const month = total('-30 days');
const all = total(null);

console.log('AI spend');
console.log(`  today          ${usd(today.cost)}  (${today.calls} calls)`);
console.log(`  last 30 days   ${usd(month.cost)}  (${month.calls} calls)`);
console.log(`  all time       ${usd(all.cost)}  (${all.calls} calls)`);

const perPlan = db.prepare('SELECT AVG(cost) AS avg, COUNT(*) AS plans FROM (SELECT SUM(cost_usd) AS cost FROM ai_usage WHERE cache_key IS NOT NULL GROUP BY cache_key)').get() as { avg: number | null; plans: number };
const cache = db.prepare('SELECT COUNT(*) AS models, COALESCE(SUM(hits), 0) AS hits FROM model_plans').get() as { models: number; hits: number };
console.log(`\n  avg per new plan  ${usd(perPlan.avg)}  (${perPlan.plans} models researched)`);
console.log(`  cache             ${cache.models} models cached, ${cache.hits} plans served for free`);

const days = db.prepare("SELECT date(created_at) AS day, SUM(cost_usd) AS cost, COUNT(*) AS calls FROM ai_usage WHERE created_at >= datetime('now', '-30 days') GROUP BY day ORDER BY day DESC").all() as { day: string; cost: number; calls: number }[];
if (days.length) {
  console.log('\nBy day (last 30 days)');
  for (const d of days) console.log(`  ${d.day}  ${usd(d.cost)}  (${d.calls} calls)`);
}
