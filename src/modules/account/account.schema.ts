import { z } from 'zod';

export const setPlanSchema = z.object({
  pro: z.boolean(),
});

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);

export const credentialsSchema = z.object({
  email,
  password,
  current_password: z.string().max(128).optional(),
});

export const recoverSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});
