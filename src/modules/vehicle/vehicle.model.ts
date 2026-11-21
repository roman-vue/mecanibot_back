import { db } from '../../config/database';

export interface VehicleRow {
  id: number;
  deviceId: string;
  car_plate: string;
  type: number | null;
  model: string | null;
  km: string | null;
  last_maintenance: string | null;
  last_task: string | null;
  km_per_month: number | null;
  km_updated_at: string | null;
}

const COLUMNS = 'id, deviceId, car_plate, type, model, km, last_maintenance, last_task, km_per_month, km_updated_at';

// Tables that store data per vehicle; they must follow the vehicle when its plate changes or it is deleted.
const VEHICLE_TABLES = ['reminders', 'maintenance_history', 'vehicle_documents'] as const;

export function findVehicle(deviceId: string, plate: string): VehicleRow | undefined {
  return db
    .prepare(`SELECT ${COLUMNS} FROM users WHERE deviceId = ? AND car_plate = ?`)
    .get(deviceId, plate) as VehicleRow | undefined;
}

export function listVehicles(deviceId: string): VehicleRow[] {
  return db.prepare(`SELECT ${COLUMNS} FROM users WHERE deviceId = ? ORDER BY id`).all(deviceId) as VehicleRow[];
}

export function countVehicles(deviceId: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users WHERE deviceId = ?').get(deviceId) as { n: number }).n;
}

export interface NewVehicleRow {
  deviceId: string;
  car_plate: string;
  type: number;
  model: string;
  km: string;
  last_maintenance: string;
  last_task: string;
}

export function insertVehicle(v: NewVehicleRow): VehicleRow {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (deviceId, car_plate, type, model, km, last_maintenance, last_task, km_updated_at)
       VALUES (@deviceId, @car_plate, @type, @model, @km, @last_maintenance, @last_task, date('now', 'localtime'))`,
    )
    .run(v);
  return db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(lastInsertRowid) as VehicleRow;
}

export const renameVehicle = db.transaction((deviceId: string, oldPlate: string, newPlate: string) => {
  db.prepare('UPDATE users SET car_plate = ? WHERE deviceId = ? AND car_plate = ?').run(newPlate, deviceId, oldPlate);
  for (const table of VEHICLE_TABLES) {
    db.prepare(`UPDATE ${table} SET car_plate = ? WHERE deviceId = ? AND car_plate = ?`).run(newPlate, deviceId, oldPlate);
  }
});

export const deleteVehicle = db.transaction((deviceId: string, plate: string) => {
  for (const table of VEHICLE_TABLES) {
    db.prepare(`DELETE FROM ${table} WHERE deviceId = ? AND car_plate = ?`).run(deviceId, plate);
  }
  db.prepare('DELETE FROM users WHERE deviceId = ? AND car_plate = ?').run(deviceId, plate);
});

export function updateOdometer(id: number, km: number, kmPerMonth: number | null, updatedAt: string): void {
  db.prepare('UPDATE users SET km = ?, km_per_month = ?, km_updated_at = ? WHERE id = ?').run(String(km), kmPerMonth, updatedAt, id);
}

export function recordLastMaintenance(id: number, date: string, task: string, km: string | null): void {
  db.prepare(
    `UPDATE users SET last_maintenance = MAX(COALESCE(last_maintenance, ''), ?), last_task = ?, km = COALESCE(?, km)
     WHERE id = ?`,
  ).run(date, task, km, id);
}
