import { Router } from 'express';
import * as controller from './account.controller';

export const accountRoutes = Router();

accountRoutes.get('/', controller.get);
accountRoutes.put('/plan', controller.setPlan);
