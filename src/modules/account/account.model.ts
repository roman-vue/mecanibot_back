import { db } from '../../config/database';

interface AccountRow {
  deviceId: string;
  is_pro: number;
  pro_since: string | null;
}

export function findAccount(deviceId: string): AccountRow | undefined {
  return db.prepare('SELECT * FROM accounts WHERE deviceId = ?').get(deviceId) as AccountRow | undefined;
}

export function upsertAccount(deviceId: string, isPro: boolean, proSince: string | null): void {
  db.prepare(
    `INSERT INTO accounts (deviceId, is_pro, pro_since) VALUES (?, ?, ?)
     ON CONFLICT(deviceId) DO UPDATE SET is_pro = excluded.is_pro, pro_since = excluded.pro_since`,
  ).run(deviceId, isPro ? 1 : 0, proSince);
}
