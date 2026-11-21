import type { RequestHandler } from 'express';
import { db } from '../config/database';
import { AppError } from '../shared/errors';

interface KeyRow {
  status: 'pending' | 'completed';
  response: string | null;
  status_code: number | null;
}

// Replays the first successful response for a repeated Idempotency-Key (e.g. a retried "create vehicle").
export const idempotency: RequestHandler = (req, res, next) => {
  const header = req.headers['idempotency-key'];
  if (typeof header !== 'string' || header.length < 8) {
    return next(new AppError(400, 'Missing Idempotency-Key header', 'IDEMPOTENCY_KEY_REQUIRED'));
  }
  const key = `${req.deviceId}:${header}`;

  const existing = db
    .prepare('SELECT status, response, status_code FROM idempotency_keys WHERE key = ?')
    .get(key) as KeyRow | undefined;

  if (existing?.status === 'completed' && existing.response) {
    res.status(existing.status_code ?? 200).json(JSON.parse(existing.response));
    return;
  }
  if (existing?.status === 'pending') {
    return next(new AppError(409, 'A request with this Idempotency-Key is in progress', 'IDEMPOTENCY_IN_PROGRESS'));
  }

  db.prepare("INSERT INTO idempotency_keys (key, status) VALUES (?, 'pending')").run(key);

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      db.prepare("UPDATE idempotency_keys SET status = 'completed', response = ?, status_code = ? WHERE key = ?")
        .run(JSON.stringify(body), res.statusCode, key);
    } else {
      db.prepare('DELETE FROM idempotency_keys WHERE key = ?').run(key);
    }
    return originalJson(body);
  };
  next();
};
