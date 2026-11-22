import { db } from '../../config/database';

interface AccountRow {
  deviceId: string;
  is_pro: number;
  pro_since: string | null;
  email: string | null;
  password_hash: string | null;
}

export function findAccount(deviceId: string): AccountRow | undefined {
  return db.prepare('SELECT * FROM accounts WHERE deviceId = ?').get(deviceId) as AccountRow | undefined;
}

export function findAccountByEmail(email: string): AccountRow | undefined {
  return db.prepare('SELECT * FROM accounts WHERE email = ?').get(email) as AccountRow | undefined;
}

export function upsertAccount(deviceId: string, isPro: boolean, proSince: string | null): void {
  db.prepare(
    `INSERT INTO accounts (deviceId, is_pro, pro_since) VALUES (?, ?, ?)
     ON CONFLICT(deviceId) DO UPDATE SET is_pro = excluded.is_pro, pro_since = excluded.pro_since`,
  ).run(deviceId, isPro ? 1 : 0, proSince);
}

export function saveCredentials(deviceId: string, email: string, passwordHash: string): void {
  db.prepare(
    `INSERT INTO accounts (deviceId, email, password_hash) VALUES (?, ?, ?)
     ON CONFLICT(deviceId) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash`,
  ).run(deviceId, email, passwordHash);
}
