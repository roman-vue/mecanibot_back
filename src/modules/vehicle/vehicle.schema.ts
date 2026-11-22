import { z } from 'zod';

export const plate = z.string().trim().toUpperCase().min(3).max(12).regex(/^[A-Z0-9-]+$/, 'Plate may contain letters, numbers and dashes');
export const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
export const km = z.string().regex(/^\d{1,7}$/, 'km must be a number');

export const plateParamsSchema = z.object({ plate });

export const createVehicleSchema = z.object({
  car_plate: plate,
  type: z.number().int().min(0).max(2),
  model: z.string().trim().min(1).max(80),
  km,
  last_maintenance: ymd,
  last_task: z.string().trim().max(120).optional().default('ninguno'),
  last_tasks: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  last_km: km.optional(),
});

export const taskCatalogQuerySchema = z.object({ type: z.coerce.number().int().min(0).max(2) });

export const renameVehicleSchema = z.object({ car_plate: plate });

export const updateKmSchema = z.object({ km });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
