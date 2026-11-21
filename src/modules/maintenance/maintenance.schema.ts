import { z } from 'zod';
import { km, ymd } from '../vehicle/vehicle.schema';

export const addMaintenanceSchema = z.object({
  task: z.string().trim().min(2).max(120),
  date: ymd.optional(),
  km: km.optional(),
  cost: z.number().int().min(0).optional(),
});

export const expensesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
