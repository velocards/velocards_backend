import { z } from 'zod';

export const calculateFeesSchema = z.object({
  body: z.object({
    action: z.enum(['card_creation', 'deposit', 'withdrawal']),
    amount: z.number().positive().optional()
  })
});