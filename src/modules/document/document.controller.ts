import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { plateParamsSchema } from '../vehicle/vehicle.schema';
import { documentParamsSchema, setDocumentSchema } from './document.schema';
import * as documentService from './document.service';

export function list(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  return ok(res, documentService.list(req.deviceId, plate));
}

export function set(req: Request, res: Response) {
  const { plate, kind } = documentParamsSchema.parse(req.params);
  const { expires_on } = setDocumentSchema.parse(req.body);
  return ok(res, documentService.set(req.deviceId, plate, kind, expires_on));
}
