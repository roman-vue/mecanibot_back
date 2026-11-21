import { z } from 'zod';
import { km, ymd } from '../vehicle/vehicle.schema';

export const reminderParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const completeReminderSchema = z.object({
  km: km.optional(),
  cost: z.number().int().min(0).optional(),
});

export const customReminderSchema = z.object({
  task: z.string().trim().min(2).max(80),
  date: ymd,
  repeat_months: z.number().int().min(1).max(24).optional(),
});
