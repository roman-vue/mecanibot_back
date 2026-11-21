import { Router } from 'express';
import { idempotency } from '../../middlewares/idempotency.middleware';
import { planRateLimit } from '../../middlewares/rate-limit.middleware';
import * as documents from '../document/document.controller';
import * as maintenance from '../maintenance/maintenance.controller';
import * as reminders from '../reminder/reminder.controller';
import * as vehicles from './vehicle.controller';

export const vehicleRoutes = Router();

vehicleRoutes.get('/', vehicles.list);
vehicleRoutes.post('/', idempotency, planRateLimit, vehicles.create);
vehicleRoutes.get('/:plate', vehicles.get);
vehicleRoutes.patch('/:plate', vehicles.rename);
vehicleRoutes.delete('/:plate', vehicles.remove);
vehicleRoutes.patch('/:plate/km', vehicles.updateKm);

vehicleRoutes.get('/:plate/reminders', reminders.list);
vehicleRoutes.post('/:plate/reminders', reminders.addCustom);

vehicleRoutes.get('/:plate/history', maintenance.history);
vehicleRoutes.post('/:plate/maintenances', maintenance.add);
vehicleRoutes.get('/:plate/expenses', maintenance.expenses);

vehicleRoutes.get('/:plate/documents', documents.list);
vehicleRoutes.put('/:plate/documents/:kind', documents.set);
