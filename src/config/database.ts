import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from './env';

const file = env.DB_PATH ?? path.resolve(__dirname, '../../data/mecanibot.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new Database(file);
db.pragma('journal_mode = WAL');

// Table "users" holds vehicles (one row per device + plate). The name is kept to preserve existing data.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId         TEXT NOT NULL,
    car_plate        TEXT NOT NULL,
    type             INTEGER,
    model            TEXT,
    km               TEXT,
    last_maintenance TEXT,
    last_task        TEXT,
    email            TEXT,
    password         TEXT,
    is_pro           INTEGER DEFAULT 0,
    UNIQUE(deviceId, car_plate)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    car_plate   TEXT NOT NULL,
    message     TEXT NOT NULL,
    description TEXT,
    dateTime    TEXT,
    status      INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS maintenance_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId    TEXT NOT NULL,
    car_plate   TEXT NOT NULL,
    task        TEXT NOT NULL,
    km          TEXT,
    date        TEXT NOT NULL,
    reminder_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS idempotency_keys (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'pending',
    response   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS model_plans (
    cache_key  TEXT PRIMARY KEY,
    type       INTEGER NOT NULL,
    model      TEXT NOT NULL,
    plan_json  TEXT NOT NULL,
    source     TEXT,
    hits       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_usage (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key     TEXT,
    model         TEXT NOT NULL,
    input_tokens  INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    web_searches  INTEGER NOT NULL,
    cost_usd      REAL NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    deviceId  TEXT PRIMARY KEY,
    is_pro    INTEGER NOT NULL DEFAULT 0,
    pro_since TEXT
  );

  CREATE TABLE IF NOT EXISTS vehicle_documents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId   TEXT NOT NULL,
    car_plate  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    expires_on TEXT NOT NULL,
    UNIQUE(deviceId, car_plate, kind)
  );
`);

function addColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

addColumn('reminders', 'task_id', 'TEXT');
addColumn('reminders', 'interval_km', 'INTEGER');
addColumn('reminders', 'interval_months', 'INTEGER');
addColumn('reminders', 'base_km', 'INTEGER');
addColumn('reminders', 'base_date', 'TEXT');
addColumn('reminders', 'deviceId', 'TEXT');
addColumn('users', 'km_per_month', 'REAL');
addColumn('users', 'km_updated_at', 'TEXT');
addColumn('maintenance_history', 'cost', 'INTEGER');
addColumn('idempotency_keys', 'status_code', 'INTEGER');
addColumn('accounts', 'email', 'TEXT');
addColumn('accounts', 'password_hash', 'TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts(email) WHERE email IS NOT NULL');

// Reminders used to be keyed by plate only; attach them to the device that owns the plate.
db.exec(`
  UPDATE reminders
  SET deviceId = (SELECT u.deviceId FROM users u WHERE u.car_plate = reminders.car_plate ORDER BY u.id LIMIT 1)
  WHERE deviceId IS NULL;

  CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON reminders(deviceId, car_plate);
  CREATE INDEX IF NOT EXISTS idx_history_vehicle ON maintenance_history(deviceId, car_plate);
`);
