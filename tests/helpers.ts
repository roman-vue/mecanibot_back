import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/config/database';
import { resetRateLimits } from '../src/middlewares/rate-limit.middleware';

export const API_KEY = 'test-api-key-0123456789';
export const DEVICE = 'device-test-1';

export function api(deviceId = DEVICE) {
  const withHeaders = (r: request.Test) => r.set('x-api-key', API_KEY).set('x-device-id', deviceId);
  return {
    get: (url: string) => withHeaders(request(app).get(url)),
    post: (url: string) => withHeaders(request(app).post(url)),
    patch: (url: string) => withHeaders(request(app).patch(url)),
    put: (url: string) => withHeaders(request(app).put(url)),
    delete: (url: string) => withHeaders(request(app).delete(url)),
  };
}

let keyCounter = 0;
export const idempotencyKey = () => `test-key-${++keyCounter}-${Date.now()}`;

export const newVehicle = (overrides: Record<string, unknown> = {}) => ({
  car_plate: 'ABC123',
  type: 1,
  model: 'TVS Raider 125',
  km: '10000',
  last_maintenance: '2026-10-01',
  ...overrides,
});

export function createVehicle(body = newVehicle(), deviceId = DEVICE) {
  return api(deviceId).post('/api/vehicles').set('Idempotency-Key', idempotencyKey()).send(body);
}

export function resetDb() {
  for (const table of ['users', 'reminders', 'maintenance_history', 'idempotency_keys', 'model_plans', 'accounts', 'vehicle_documents']) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  resetRateLimits();
}
