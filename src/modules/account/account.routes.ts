import { Router } from 'express';
import { recoverRateLimit } from '../../middlewares/rate-limit.middleware';
import * as controller from './account.controller';

export const accountRoutes = Router();

accountRoutes.get('/', controller.get);
accountRoutes.put('/plan', controller.setPlan);
accountRoutes.put('/credentials', recoverRateLimit, controller.setCredentials);
accountRoutes.post('/recover', recoverRateLimit, controller.recover);
