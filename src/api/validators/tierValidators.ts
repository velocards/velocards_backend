import { z } from 'zod';

export const calculateFeesSchema = z.object({
  body: z.object({
    action: z.enum(['card_creation', 'deposit', 'withdrawal']),
    amount: z.number().min(0).optional()
  })
});

// Inferred TypeScript types
export type CalculateFeesInput = z.infer<typeof calculateFeesSchema>['body'];
export type FeeAction = z.infer<typeof calculateFeesSchema>['body']['action'];