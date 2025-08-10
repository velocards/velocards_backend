import { z } from 'zod';

// KYC initiation schema
export const initiateKYCSchema = z.object({
  body: z.object({
    type: z.enum(['individual', 'business']).optional().default('individual'),
    redirectUrl: z.string().url().optional()
  }).optional()
});

// KYC reset schema
export const resetKYCSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long')
  })
});

// KYC webhook schema (based on SumSub webhook documentation)
export const kycWebhookSchema = z.object({
  body: z.object({
    type: z.string(),
    applicantId: z.string(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
    externalUserId: z.string().optional(),
    reviewStatus: z.string().optional(),
    reviewResult: z.object({
      reviewAnswer: z.enum(['GREEN', 'RED', 'YELLOW']).optional(),
      label: z.string().optional(),
      rejectLabels: z.array(z.string()).optional(),
      reviewRejectType: z.string().optional()
    }).optional(),
    createdAt: z.string().datetime().optional(),
    applicantType: z.string().optional()
  })
});

// Export type definitions
export type InitiateKYCInput = z.infer<typeof initiateKYCSchema>['body'];
export type ResetKYCInput = z.infer<typeof resetKYCSchema>['body'];
export type KYCWebhookPayload = z.infer<typeof kycWebhookSchema>['body'];