import { db } from '../../config/database';

export interface HistoryRow {
  id: number;
  deviceId: string;
  car_plate: string;
  task: string;
  km: string | null;
  date: string;
  reminder_id: number | null;
  cost: number | null;
}

export interface NewHistoryRow {
  deviceId: string;
  car_plate: string;
  task: string;
  km: string | null;
  date: string;
  reminder_id: number | null;
  cost: number | null;
}

export function insertHistory(row: NewHistoryRow): void {
  db.prepare(
    `INSERT INTO maintenance_history (deviceId, car_plate, task, km, date, reminder_id, cost)
     VALUES (@deviceId, @car_plate, @task, @km, @date, @reminder_id, @cost)`,
  ).run(row);
}

export function listHistory(deviceId: string, plate: string, fromDate: string): HistoryRow[] {
  return db
    .prepare(
      `SELECT * FROM maintenance_history
       WHERE deviceId = ? AND car_plate = ? AND date >= ?
       ORDER BY date DESC, id DESC`,
    )
    .all(deviceId, plate, fromDate) as HistoryRow[];
}

export function countHistoryBefore(deviceId: string, plate: string, date: string): number {
  return (
    db
      .prepare('SELECT COUNT(*) AS n FROM maintenance_history WHERE deviceId = ? AND car_plate = ? AND date < ?')
      .get(deviceId, plate, date) as { n: number }
  ).n;
}

export function listCosts(deviceId: string, plate: string, year: number) {
  return db
    .prepare(
      `SELECT task, date, cost FROM maintenance_history
       WHERE deviceId = ? AND car_plate = ? AND cost IS NOT NULL AND substr(date, 1, 4) = ?
       ORDER BY date DESC`,
    )
    .all(deviceId, plate, String(year)) as { task: string; date: string; cost: number }[];
}
