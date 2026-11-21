import { db } from '../../config/database';

export const DOCUMENT_KINDS = ['soat', 'tecnomecanica'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function listDocuments(deviceId: string, plate: string) {
  return db
    .prepare('SELECT kind, expires_on FROM vehicle_documents WHERE deviceId = ? AND car_plate = ? ORDER BY kind')
    .all(deviceId, plate) as { kind: DocumentKind; expires_on: string }[];
}

export function upsertDocument(deviceId: string, plate: string, kind: DocumentKind, expiresOn: string): void {
  db.prepare(
    `INSERT INTO vehicle_documents (deviceId, car_plate, kind, expires_on) VALUES (?, ?, ?, ?)
     ON CONFLICT(deviceId, car_plate, kind) DO UPDATE SET expires_on = excluded.expires_on`,
  ).run(deviceId, plate, kind, expiresOn);
}
