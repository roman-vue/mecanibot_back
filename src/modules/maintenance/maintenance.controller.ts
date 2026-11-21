import type { Request, Response } from 'express';
import { created, ok } from '../../shared/http';
import { plateParamsSchema } from '../vehicle/vehicle.schema';
import { addMaintenanceSchema, expensesQuerySchema } from './maintenance.schema';
import * as maintenanceService from './maintenance.service';

export function history(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  return ok(res, maintenanceService.history(req.deviceId, plate));
}

export function add(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  const { task, date, km, cost } = addMaintenanceSchema.parse(req.body);
  return created(res, maintenanceService.add(req.deviceId, plate, task, date, km, cost));
}

export function expenses(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  const { year } = expensesQuerySchema.parse(req.query);
  return ok(res, maintenanceService.expenses(req.deviceId, plate, year));
}
