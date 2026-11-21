import { getOwnedVehicle } from '../vehicle/vehicle.service';
import { DocumentKind, listDocuments, upsertDocument } from './document.model';

export function list(deviceId: string, plate: string) {
  getOwnedVehicle(deviceId, plate);
  return listDocuments(deviceId, plate);
}

export function set(deviceId: string, plate: string, kind: DocumentKind, expiresOn: string) {
  getOwnedVehicle(deviceId, plate);
  upsertDocument(deviceId, plate, kind, expiresOn);
  return listDocuments(deviceId, plate);
}
