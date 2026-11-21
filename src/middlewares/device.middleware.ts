import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors';

const DEVICE_ID = /^[\w.:-]{6,128}$/;

export const device: RequestHandler = (req, _res, next) => {
  const deviceId = String(req.headers['x-device-id'] ?? '').trim();
  if (!DEVICE_ID.test(deviceId)) return next(new AppError(400, 'Missing or invalid x-device-id header', 'DEVICE_REQUIRED'));
  req.deviceId = deviceId;
  next();
};
