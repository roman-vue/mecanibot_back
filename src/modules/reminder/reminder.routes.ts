import { Router } from 'express';
import * as controller from './reminder.controller';

export const reminderRoutes = Router();

reminderRoutes.post('/:id/complete', controller.complete);
