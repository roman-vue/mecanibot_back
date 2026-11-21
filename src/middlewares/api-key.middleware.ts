import { timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../shared/errors';

const expected = Buffer.from(env.API_KEY);

export const apiKey: RequestHandler = (req, _res, next) => {
  const given = Buffer.from(String(req.headers['x-api-key'] ?? ''));
  // timingSafeEqual prevents guessing the key by measuring response time
  const valid = given.length === expected.length && timingSafeEqual(given, expected);
  if (!valid) return next(new AppError(401, 'Invalid API key', 'UNAUTHORIZED'));
  next();
};
