import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { logger } from './logger.middleware';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Invalid data',
      code: 'VALIDATION_ERROR',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ success: false, message: err.message, code: err.code, details: err.details });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Malformed JSON body', code: 'VALIDATION_ERROR' });
    return;
  }
  logger.error('Unhandled error', { path: req.originalUrl, message: err?.message, stack: err?.stack });
  res.status(500).json({ success: false, message: 'Internal error', code: 'INTERNAL' });
};
