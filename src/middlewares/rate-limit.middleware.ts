import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors';

const MAX_PLANS_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

const windows = new Map<string, { count: number; start: number }>();

// Limits vehicle creation per device because each one may call OpenAI (cost).
export const planRateLimit: RequestHandler = (req, _res, next) => {
  const now = Date.now();
  const entry = windows.get(req.deviceId);

  if (!entry || now - entry.start > WINDOW_MS) {
    windows.set(req.deviceId, { count: 1, start: now });
    return next();
  }
  if (entry.count >= MAX_PLANS_PER_HOUR) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - entry.start)) / 1000);
    return next(new AppError(429, `Max ${MAX_PLANS_PER_HOUR} vehicles per hour. Retry in ${retryAfter}s`, 'RATE_LIMITED'));
  }
  entry.count += 1;
  next();
};

const MAX_RECOVER_ATTEMPTS = 5;
const RECOVER_WINDOW_MS = 15 * 60 * 1000;
const recoverWindows = new Map<string, { count: number; start: number }>();

// Login attempts per IP, so passwords cannot be brute-forced.
export const recoverRateLimit: RequestHandler = (req, _res, next) => {
  const now = Date.now();
  const ip = req.ip ?? 'unknown';
  const entry = recoverWindows.get(ip);
  if (!entry || now - entry.start > RECOVER_WINDOW_MS) {
    recoverWindows.set(ip, { count: 1, start: now });
    return next();
  }
  if (entry.count >= MAX_RECOVER_ATTEMPTS) return next(new AppError(429, 'Too many attempts, try again later', 'RATE_LIMITED'));
  entry.count += 1;
  next();
};

export const resetRateLimits = () => {
  windows.clear();
  recoverWindows.clear();
};
