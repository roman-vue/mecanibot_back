import type { Request, Response } from 'express';
import { created, ok } from '../../shared/http';
import { createVehicleSchema, plateParamsSchema, renameVehicleSchema, updateKmSchema } from './vehicle.schema';
import * as vehicleService from './vehicle.service';

export function list(req: Request, res: Response) {
  return ok(res, vehicleService.list(req.deviceId));
}

export function get(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  return ok(res, vehicleService.get(req.deviceId, plate));
}

export async function create(req: Request, res: Response) {
  const input = createVehicleSchema.parse(req.body);
  return created(res, await vehicleService.create(req.deviceId, input));
}

export function rename(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  const { car_plate } = renameVehicleSchema.parse(req.body);
  return ok(res, vehicleService.rename(req.deviceId, plate, car_plate));
}

export function remove(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  vehicleService.remove(req.deviceId, plate);
  return res.status(204).end();
}

export function updateKm(req: Request, res: Response) {
  const { plate } = plateParamsSchema.parse(req.params);
  const { km } = updateKmSchema.parse(req.body);
  return ok(res, vehicleService.updateKm(req.deviceId, plate, km));
}
