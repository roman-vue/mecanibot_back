import path from 'path';
import winston from 'winston';
import type { RequestHandler } from 'express';
import { env } from '../config/env';

const logDir = env.LOG_DIR ?? path.resolve(__dirname, '../../logs');
const isTest = env.NODE_ENV === 'test';

export const logger = winston.createLogger({
  level: isTest ? 'error' : 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    ...(isTest
      ? []
      : [new winston.transports.File({ filename: path.join(logDir, 'app.log'), maxsize: 5_000_000, maxFiles: 5 })]),
  ],
});

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('request', { method: req.method, path: req.originalUrl, status: res.statusCode, ms: Date.now() - started });
  });
  next();
};
