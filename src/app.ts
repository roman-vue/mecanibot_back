import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { db } from './config/database';
import { apiKey } from './middlewares/api-key.middleware';
import { device } from './middlewares/device.middleware';
import { errorHandler } from './middlewares/error-handler.middleware';
import { requestLogger } from './middlewares/logger.middleware';
import { accountRoutes } from './modules/account/account.routes';
import { reminderRoutes } from './modules/reminder/reminder.routes';
import { vehicleRoutes } from './modules/vehicle/vehicle.routes';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.CORS_ORIGINS }));
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', apiKey, device);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/account', accountRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
});
app.use(errorHandler);
