import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { credentialsSchema, recoverSchema, setPlanSchema } from './account.schema';
import * as accountService from './account.service';

export function get(req: Request, res: Response) {
  return ok(res, accountService.getAccount(req.deviceId));
}

export function setPlan(req: Request, res: Response) {
  const { pro } = setPlanSchema.parse(req.body);
  return ok(res, accountService.setPlan(req.deviceId, pro));
}

export async function setCredentials(req: Request, res: Response) {
  const { email, password, current_password } = credentialsSchema.parse(req.body);
  return ok(res, await accountService.setCredentials(req.deviceId, email, password, current_password));
}

export async function recover(req: Request, res: Response) {
  const { email, password } = recoverSchema.parse(req.body);
  return ok(res, await accountService.recover(email, password));
}
