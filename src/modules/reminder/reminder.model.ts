import { db } from '../../config/database';

export interface ReminderRow {
  id: number;
  deviceId: string;
  car_plate: string;
  message: string;
  description: string | null;
  dateTime: string;
  status: number;
  task_id: string | null;
  interval_km: number | null;
  interval_months: number | null;
  base_km: number | null;
  base_date: string | null;
}

export interface NewReminderRow {
  deviceId: string;
  car_plate: string;
  message: string;
  description: string | null;
  dateTime: string;
  task_id: string | null;
  interval_km: number | null;
  interval_months: number | null;
  base_km: number | null;
  base_date: string | null;
}

export const CUSTOM_TASK = 'custom';

export function listReminders(deviceId: string, plate: string): ReminderRow[] {
  return db
    .prepare('SELECT * FROM reminders WHERE deviceId = ? AND car_plate = ? ORDER BY dateTime ASC, id ASC')
    .all(deviceId, plate) as ReminderRow[];
}

export function listPending(deviceId: string, plate: string): ReminderRow[] {
  return db
    .prepare('SELECT * FROM reminders WHERE deviceId = ? AND car_plate = ? AND status = 0')
    .all(deviceId, plate) as ReminderRow[];
}

export function findReminder(deviceId: string, id: number): ReminderRow | undefined {
  return db.prepare('SELECT * FROM reminders WHERE id = ? AND deviceId = ?').get(id, deviceId) as ReminderRow | undefined;
}

export function insertReminder(r: NewReminderRow): number {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO reminders (deviceId, car_plate, message, description, dateTime, task_id, interval_km, interval_months, base_km, base_date)
       VALUES (@deviceId, @car_plate, @message, @description, @dateTime, @task_id, @interval_km, @interval_months, @base_km, @base_date)`,
    )
    .run(r);
  return Number(lastInsertRowid);
}

export const insertReminders = db.transaction((rows: NewReminderRow[]) => {
  for (const r of rows) insertReminder(r);
});

export function markDone(id: number): void {
  db.prepare('UPDATE reminders SET status = 1 WHERE id = ?').run(id);
}

export function setDueDate(id: number, dateTime: string): void {
  db.prepare('UPDATE reminders SET dateTime = ? WHERE id = ?').run(dateTime, id);
}

export function countPendingCustom(deviceId: string, plate: string): number {
  return (
    db
      .prepare('SELECT COUNT(*) AS n FROM reminders WHERE deviceId = ? AND car_plate = ? AND task_id = ? AND status = 0')
      .get(deviceId, plate, CUSTOM_TASK) as { n: number }
  ).n;
}
