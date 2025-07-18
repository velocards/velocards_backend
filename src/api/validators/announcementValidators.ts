import { z } from 'zod';

// Enum schemas
const categorySchema = z.enum(['news', 'updates', 'maintenance', 'features', 'promotions']);
const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

// Target audience schema
const targetAudienceSchema = z.object({
  tiers: z.array(z.number().min(0).max(3)).optional(),
  regions: z.array(z.string()).optional(),
  userIds: z.array(z.string().uuid()).optional()
}).optional();

// Get announcements query schema
export const getAnnouncementsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().positive()).optional(),
    limit: z.string().transform(Number).pipe(z.number().positive().max(100)).optional(),
    category: categorySchema.optional()
  })
});

// Create announcement schema
export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    message: z.string().min(1),
    category: categorySchema,
    priority: prioritySchema.default('medium'),
    icon: z.string().max(50).optional(),
    image_url: z.string().url().max(500).optional(),
    action_url: z.string().max(500).optional(),
    action_label: z.string().max(100).optional(),
    published_at: z.string().datetime().optional(),
    expires_at: z.string().datetime().optional(),
    target_audience: targetAudienceSchema,
    is_active: z.boolean().default(true)
  })
});

// Update announcement schema
export const updateAnnouncementSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    message: z.string().min(1).optional(),
    category: categorySchema.optional(),
    priority: prioritySchema.optional(),
    icon: z.string().max(50).optional(),
    image_url: z.string().url().max(500).optional(),
    action_url: z.string().max(500).optional(),
    action_label: z.string().max(100).optional(),
    published_at: z.string().datetime().optional(),
    expires_at: z.string().datetime().optional(),
    target_audience: targetAudienceSchema,
    is_active: z.boolean().optional()
  })
});

// Params with ID schema
export const announcementIdSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

// Admin query schema
export const getAdminAnnouncementsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().positive()).optional(),
    limit: z.string().transform(Number).pipe(z.number().positive().max(100)).optional(),
    includeInactive: z.string().transform(val => val === 'true').optional(),
    category: categorySchema.optional(),
    priority: prioritySchema.optional()
  })
});