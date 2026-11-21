import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { setPlanSchema } from './account.schema';
import * as accountService from './account.service';

export function get(req: Request, res: Response) {
  return ok(res, accountService.getAccount(req.deviceId));
}

export function setPlan(req: Request, res: Response) {
  const { pro } = setPlanSchema.parse(req.body);
  return ok(res, accountService.setPlan(req.deviceId, pro));
}
