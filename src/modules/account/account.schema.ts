import { z } from 'zod';

export const setPlanSchema = z.object({
  pro: z.boolean(),
});
