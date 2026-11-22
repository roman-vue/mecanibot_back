import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/integrations/openai', () => ({
  askJson: vi.fn(async () =>
    JSON.stringify({ source: 'Manual TVS', tasks: [{ id: 'oil_change', interval_km: 4000, interval_months: 5 }, { id: 'made_up' }] }),
  ),
}));

import { app } from '../src/app';
import { askJson } from '../src/integrations/openai';
import { catalogFor } from '../src/modules/plan/plan.catalog';
import { API_KEY, DEVICE, api, createVehicle, idempotencyKey, newVehicle, resetDb } from './helpers';

beforeEach(() => {
  resetDb();
  vi.mocked(askJson).mockClear();
});

describe('security', () => {
  it('rejects a wrong API key with 401', async () => {
    const res = await request(app).get('/api/vehicles').set('x-api-key', 'wrong-key').set('x-device-id', DEVICE);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
  });

  it('rejects a missing device id with 400', async () => {
    const res = await request(app).get('/api/vehicles').set('x-api-key', API_KEY);
    expect(res.body.code).toBe('DEVICE_REQUIRED');
  });

  it('keeps /health public', async () => {
    const res = await request(app).get('/health');
    expect(res.body.status).toBe('ok');
  });
});

describe('vehicles', () => {
  it('creates a vehicle with a plan that only uses catalog tasks', async () => {
    const res = await createVehicle();
    expect(res.status).toBe(201);
    expect(res.body.data.vehicle.car_plate).toBe('ABC123');
    const ids = res.body.data.reminders.map((r: { task_id: string }) => r.task_id);
    expect(ids).toContain('oil_change');
    expect(ids).not.toContain('made_up');
    const oil = res.body.data.reminders.find((r: { task_id: string }) => r.task_id === 'oil_change');
    expect(oil).toMatchObject({ interval_km: 4000, interval_months: 5 });
  });

  it('reuses the cached plan for the same model without calling OpenAI again', async () => {
    await createVehicle();
    await api('other-device-2').post('/api/account/plan').send({ pro: true });
    await createVehicle(newVehicle({ car_plate: 'XYZ999', model: 'tvs  raider-125' }), 'other-device-2');
    expect(askJson).toHaveBeenCalledTimes(2);
  });

  it('replays the same response for a repeated Idempotency-Key', async () => {
    const key = idempotencyKey();
    const first = await api().post('/api/vehicles').set('Idempotency-Key', key).send(newVehicle());
    const second = await api().post('/api/vehicles').set('Idempotency-Key', key).send(newVehicle());
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
  });

  it('enforces the free plan vehicle limit', async () => {
    await createVehicle();
    const res = await createVehicle(newVehicle({ car_plate: 'DEF456' }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PRO_REQUIRED');
  });

  it('returns 409 for a duplicated plate', async () => {
    await createVehicle();
    const res = await createVehicle();
    expect(res.status).toBe(409);
  });

  it('validates the body', async () => {
    const res = await createVehicle(newVehicle({ km: 'diez' }));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('km');
  });

  it('does not expose another device vehicles or reminders', async () => {
    await createVehicle();
    const other = api('intruder-device');
    expect((await other.get('/api/vehicles/ABC123')).status).toBe(404);
    expect((await other.get('/api/vehicles/ABC123/reminders')).status).toBe(404);
  });

  it('moves reminders, history and documents when the plate changes', async () => {
    await createVehicle();
    await api().put('/api/vehicles/ABC123/documents/soat').send({ expires_on: '2027-01-01' });
    const res = await api().patch('/api/vehicles/ABC123').send({ car_plate: 'NEW123' });
    expect(res.body.data.car_plate).toBe('NEW123');
    expect((await api().get('/api/vehicles/NEW123/reminders')).body.data.length).toBeGreaterThan(0);
    expect((await api().get('/api/vehicles/NEW123/documents')).body.data).toHaveLength(1);
  });

  it('deletes the vehicle with its reminders', async () => {
    await createVehicle();
    expect((await api().delete('/api/vehicles/ABC123')).status).toBe(204);
    const recreated = await createVehicle();
    const reminders = (await api().get('/api/vehicles/ABC123/reminders')).body.data;
    expect(reminders).toHaveLength(recreated.body.data.reminders.length);
    expect(reminders).toHaveLength(catalogFor(1).length);
  });
});

describe('plan recalculation', () => {
  it('rebuilds pending plan reminders from history and keeps custom and done ones', async () => {
    const created = await createVehicle(newVehicle({ last_tasks: ['chain_kit'], last_maintenance: '2026-11-01' }));
    const oil = created.body.data.reminders.find((r: { task_id: string }) => r.task_id === 'oil_change');
    await api().post(`/api/reminders/${oil.id}/complete`).send({ km: '10000' });
    await api().post('/api/vehicles/ABC123/reminders').send({ task: 'Lavar la moto', date: '2030-01-01' });

    const res = await api().post('/api/vehicles/ABC123/plan/recalculate');
    expect(res.status).toBe(200);
    const list = res.body.data.reminders as { task_id: string; status: number; base_date: string; base_km: number }[];

    const pendingOil = list.filter((r) => r.task_id === 'oil_change' && r.status === 0);
    expect(pendingOil).toHaveLength(1);
    expect(pendingOil[0].base_km).toBe(10000);
    expect(list.some((r) => r.task_id === 'oil_change' && r.status === 1)).toBe(true);
    expect(list.filter((r) => r.task_id === 'custom')).toHaveLength(1);
    expect(list.find((r) => r.task_id === 'chain_kit' && r.status === 0)?.base_date).toBe('2026-11-01');
    expect(history_untouched(await api().get('/api/vehicles/ABC123/history'))).toBe(true);
  });

  it('returns 404 for a vehicle of another device', async () => {
    await createVehicle();
    const res = await api('other-device-xyz').post('/api/vehicles/ABC123/plan/recalculate');
    expect(res.status).toBe(404);
  });
});

const history_untouched = (res: { body: { data: { history: unknown[] } } }) => res.body.data.history.length === 2;

describe('reminders and maintenance', () => {
  it('completes a reminder, logs history and schedules the next one', async () => {
    const created = await createVehicle();
    const oil = created.body.data.reminders.find((r: { task_id: string }) => r.task_id === 'oil_change');

    const res = await api().post(`/api/reminders/${oil.id}/complete`).send({ km: '10500' });
    expect(res.status).toBe(200);
    expect(res.body.data.next.message).toBe(oil.message);

    const history = await api().get('/api/vehicles/ABC123/history');
    expect(history.body.data.history[0]).toMatchObject({ task: oil.message, km: '10500' });

    const again = await api().post(`/api/reminders/${oil.id}/complete`).send({});
    expect(again.status).toBe(409);
  });

  it('requires Pro to register costs', async () => {
    const created = await createVehicle();
    const id = created.body.data.reminders[0].id;
    const res = await api().post(`/api/reminders/${id}/complete`).send({ cost: 50000 });
    expect(res.body.code).toBe('PRO_REQUIRED');
  });

  it('limits custom reminders on the free plan', async () => {
    await createVehicle();
    for (let i = 0; i < 3; i++) {
      const ok = await api().post('/api/vehicles/ABC123/reminders').send({ task: `Tarea ${i}`, date: '2099-01-01' });
      expect(ok.status).toBe(201);
    }
    const res = await api().post('/api/vehicles/ABC123/reminders').send({ task: 'Una más', date: '2099-01-01' });
    expect(res.body.code).toBe('PRO_REQUIRED');
  });

  it('sums expenses by task for Pro accounts', async () => {
    await api().put('/api/account/plan').send({ pro: true });
    await createVehicle();
    await api().post('/api/vehicles/ABC123/maintenances').send({ task: 'Frenos', date: '2026-03-01', cost: 80000 });
    await api().post('/api/vehicles/ABC123/maintenances').send({ task: 'Frenos', date: '2026-05-01', cost: 20000 });
    const res = await api().get('/api/vehicles/ABC123/expenses?year=2026');
    expect(res.body.data).toMatchObject({ total: 100000, byTask: [{ task: 'Frenos', amount: 100000 }] });
  });

  it('updates km and learns nothing on the same day', async () => {
    await createVehicle();
    const res = await api().patch('/api/vehicles/ABC123/km').send({ km: '12000' });
    expect(res.body.data).toMatchObject({ km: 12000, km_per_month: null });
  });
});

describe('account credentials', () => {
  const creds = { email: 'Roman@Example.com', password: 'secret-123' };

  it('links an email and recovers the same account on another device', async () => {
    const linked = await api().put('/api/account/credentials').send(creds);
    expect(linked.status).toBe(200);
    expect(linked.body.data.email).toBe('roman@example.com');
    expect(JSON.stringify(linked.body)).not.toMatch(/password|hash/);
    const res = await api('new-phone-0001').post('/api/account/recover').send({ email: 'roman@example.com', password: creds.password });
    expect(res.body.data).toEqual({ device_id: DEVICE });
  });

  it('rejects a wrong password and an unknown email the same way', async () => {
    await api().put('/api/account/credentials').send(creds);
    const wrong = await api('new-phone-0001').post('/api/account/recover').send({ ...creds, password: 'nope-nope' });
    const unknown = await api('new-phone-0001').post('/api/account/recover').send({ ...creds, email: 'x@y.com' });
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('rejects an email linked to another account', async () => {
    await api().put('/api/account/credentials').send(creds);
    const res = await api('other-device-3').put('/api/account/credentials').send(creds);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('asks for the current password before changing credentials', async () => {
    await api().put('/api/account/credentials').send(creds);
    const res = await api().put('/api/account/credentials').send({ email: 'new@example.com', password: 'another-123' });
    expect(res.status).toBe(401);
    const okRes = await api().put('/api/account/credentials').send({ email: 'new@example.com', password: 'another-123', current_password: creds.password });
    expect(okRes.body.data.email).toBe('new@example.com');
  });

  it('limits recovery attempts', async () => {
    for (let i = 0; i < 5; i++) await api('new-phone-0001').post('/api/account/recover').send(creds);
    const res = await api('new-phone-0001').post('/api/account/recover').send(creds);
    expect(res.status).toBe(429);
  });
});
