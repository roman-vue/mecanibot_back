import type { Request, Response } from 'express';
import { created, ok } from '../../shared/http';
import { plateParamsSchema } from '../vehicle/vehicle.schema';
import { completeReminderSchema, customReminderSchema, reminderParamsSchema } from './reminder.schema';
import * as reminderService from './reminder.service';

export function list(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  return ok(res, reminderService.list(req.deviceId, plate));
}

export function addCustom(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  const { task, date, repeat_months } = customReminderSchema.parse(req.body);
  return created(res, reminderService.addCustom(req.deviceId, plate, task, date, repeat_months));
}

export function complete(req: Request, res: Response) {
  const { id } = reminderParamsSchema.parse(req.params);
  const { km, cost } = completeReminderSchema.parse(req.body ?? {});
  return ok(res, reminderService.complete(req.deviceId, id, km, cost));
}
