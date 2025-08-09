# Zod Validation Guide

## Overview

This guide documents the validation approach using Zod in the VeloCards backend. All validation is now handled through Zod schemas with automatic TypeScript type inference.

## Why Zod?

1. **Type Safety**: Automatic TypeScript type inference from schemas
2. **Performance**: 15-30% faster than Joi (verified in Story 1.2)
3. **Developer Experience**: Better IDE support and auto-completion
4. **Single Source of Truth**: Validation and types from same definition
5. **Modern**: Active development and TypeScript-first design

## Project Structure

```
backend/src/
├── api/
│   ├── validators/          # Zod validation schemas
│   │   ├── authValidators.ts
│   │   ├── cardValidators.ts
│   │   ├── transactionValidators.ts
│   │   ├── userValidators.ts
│   │   ├── cryptoValidators.ts
│   │   ├── announcementValidators.ts
│   │   └── tierValidators.ts
│   ├── middlewares/
│   │   └── validate.ts      # Validation middleware
│   └── types/
│       └── responses.ts     # API response type schemas
└── types/
    └── exported.ts          # Exported types for dashboard

```

## Basic Patterns

### 1. Creating a Validation Schema

```typescript
import { z } from 'zod';

// Define the schema
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone format').optional()
  })
});

// Export the inferred type
export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
```

### 2. Using in Routes

```typescript
import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { createUserSchema } from '../validators/userValidators';
import { UserController } from '../controllers/userController';

const router = Router();

router.post(
  '/users',
  validate(createUserSchema),
  UserController.createUser
);
```

### 3. Using Types in Services

```typescript
import { CreateUserInput } from '../api/validators/userValidators';

class UserService {
  static async createUser(data: CreateUserInput) {
    // data is fully typed with auto-completion
    const { email, password, firstName, lastName, phone } = data;
    // ... implementation
  }
}
```

## Common Validation Patterns

### String Validation

```typescript
// Basic string
z.string()

// With constraints
z.string()
  .min(2, 'Too short')
  .max(50, 'Too long')
  .trim()  // Remove whitespace

// Email
z.string().email('Invalid email')

// URL
z.string().url('Invalid URL')

// UUID
z.string().uuid('Invalid UUID')

// Regex pattern
z.string().regex(/^[A-Z]{2}$/, 'Must be 2 uppercase letters')

// Custom refinement
z.string().refine(
  (val) => !forbiddenWords.includes(val),
  'Contains forbidden words'
)
```

### Number Validation

```typescript
// Basic number
z.number()

// With constraints
z.number()
  .positive('Must be positive')
  .min(10, 'Minimum is 10')
  .max(1000, 'Maximum is 1000')

// Integer
z.number().int('Must be an integer')

// Transform string to number
z.string().transform(Number).pipe(
  z.number().positive()
)
```

### Enum Validation

```typescript
// String enum
z.enum(['active', 'inactive', 'pending'])

// With custom error
z.enum(['USD', 'EUR', 'GBP'], {
  errorMap: () => ({ message: 'Invalid currency' })
})

// Dynamic enum from array
const STATUSES = ['draft', 'published', 'archived'] as const;
z.enum(STATUSES)
```

### Object Validation

```typescript
// Basic object
z.object({
  name: z.string(),
  age: z.number()
})

// Nested object
z.object({
  user: z.object({
    profile: z.object({
      firstName: z.string(),
      lastName: z.string()
    })
  })
})

// Partial (all fields optional)
z.object({
  name: z.string(),
  age: z.number()
}).partial()

// Pick specific fields
const fullSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  password: z.string()
});

const updateSchema = fullSchema.pick({ name: true, email: true });
```

### Array Validation

```typescript
// Array of strings
z.array(z.string())

// With constraints
z.array(z.string())
  .min(1, 'At least one item required')
  .max(10, 'Maximum 10 items')

// Array of objects
z.array(
  z.object({
    id: z.string(),
    value: z.number()
  })
)
```

### Optional and Nullable

```typescript
// Optional (undefined allowed)
z.string().optional()  // string | undefined

// Nullable (null allowed)
z.string().nullable()  // string | null

// Both
z.string().nullish()  // string | null | undefined

// With default
z.string().optional().default('default value')
```

### Date Validation

```typescript
// Date string validation
z.string().datetime()  // ISO 8601

// Custom date validation
z.string().refine(
  (date) => {
    const d = new Date(date);
    const age = new Date().getFullYear() - d.getFullYear();
    return age >= 18 && age <= 120;
  },
  'Must be between 18 and 120 years old'
)

// Transform to Date object
z.string().transform((str) => new Date(str))
```

### Conditional Validation

```typescript
// Using refine for complex logic
z.object({
  type: z.enum(['personal', 'business']),
  companyName: z.string().optional(),
  taxId: z.string().optional()
}).refine(
  (data) => {
    if (data.type === 'business') {
      return !!data.companyName && !!data.taxId;
    }
    return true;
  },
  {
    message: 'Company name and tax ID required for business accounts',
    path: ['companyName']
  }
)

// Using discriminated union
z.discriminatedUnion('type', [
  z.object({
    type: z.literal('personal'),
    firstName: z.string(),
    lastName: z.string()
  }),
  z.object({
    type: z.literal('business'),
    companyName: z.string(),
    taxId: z.string()
  })
])
```

## Advanced Patterns

### Transform and Preprocess

```typescript
// Transform after validation
z.string()
  .transform((val) => val.toLowerCase())
  .transform((val) => val.replace(/\s+/g, '-'))

// Preprocess before validation
z.preprocess(
  (val) => String(val).trim(),
  z.string().min(1)
)

// Parse JSON string
z.string()
  .transform((str) => JSON.parse(str))
  .pipe(z.object({ /* schema */ }))
```

### Custom Error Messages

```typescript
// Inline messages
z.string().min(5, { message: 'Must be 5 or more characters' })

// Error map
z.string().email({
  message: 'Please enter a valid email address'
})

// Global error map
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: `Expected ${issue.expected}, got ${issue.received}` };
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);
```

### Async Validation

```typescript
// Check database for uniqueness
const emailSchema = z.string().email().refine(
  async (email) => {
    const exists = await UserRepository.emailExists(email);
    return !exists;
  },
  { message: 'Email already in use' }
);

// Note: Use sparingly as it impacts performance
```

### Composing Schemas

```typescript
// Base schema
const baseUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string()
});

// Extend schema
const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8)
});

// Merge schemas
const profileSchema = z.object({
  bio: z.string(),
  avatar: z.string().url()
});

const fullUserSchema = baseUserSchema.merge(profileSchema);

// Intersection
const adminSchema = z.intersection(
  baseUserSchema,
  z.object({ role: z.literal('admin') })
);
```

## Request Validation Patterns

### Query Parameters

```typescript
export const paginationSchema = z.object({
  query: z.object({
    page: z.string()
      .transform(Number)
      .pipe(z.number().positive())
      .optional()
      .default('1'),
    limit: z.string()
      .transform(Number)
      .pipe(z.number().positive().max(100))
      .optional()
      .default('20'),
    sortBy: z.enum(['createdAt', 'updatedAt', 'name'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc'])
      .optional()
      .default('desc')
  })
});
```

### Path Parameters

```typescript
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID format')
  })
});
```

### Request Body

```typescript
export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional()
  }).refine(
    data => Object.keys(data).length > 0,
    { message: 'At least one field required' }
  )
});
```

### File Upload

```typescript
export const fileUploadSchema = z.object({
  file: z.object({
    fieldname: z.string(),
    originalname: z.string(),
    mimetype: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
    size: z.number().max(5 * 1024 * 1024, 'File too large (max 5MB)')
  })
});
```

## Testing Validation

### Unit Testing Schemas

```typescript
import { createUserSchema } from '../validators/userValidators';

describe('User Validation', () => {
  it('should validate correct input', () => {
    const input = {
      body: {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      }
    };
    
    const result = createUserSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid email', () => {
    const input = {
      body: {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      }
    };
    
    const result = createUserSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email address');
    }
  });
});
```

## Migration from Joi

### Joi to Zod Mapping

| Joi | Zod |
|-----|-----|
| `Joi.string()` | `z.string()` |
| `Joi.number()` | `z.number()` |
| `Joi.boolean()` | `z.boolean()` |
| `Joi.array()` | `z.array()` |
| `Joi.object()` | `z.object()` |
| `Joi.date()` | `z.date()` or `z.string().datetime()` |
| `Joi.string().email()` | `z.string().email()` |
| `Joi.string().uuid()` | `z.string().uuid()` |
| `Joi.string().min(5)` | `z.string().min(5)` |
| `Joi.string().max(10)` | `z.string().max(10)` |
| `Joi.string().pattern()` | `z.string().regex()` |
| `Joi.number().positive()` | `z.number().positive()` |
| `Joi.number().integer()` | `z.number().int()` |
| `Joi.required()` | Default (fields are required) |
| `Joi.optional()` | `.optional()` |
| `Joi.allow(null)` | `.nullable()` |
| `Joi.valid('a', 'b')` | `z.enum(['a', 'b'])` |
| `Joi.alternatives()` | `z.union()` |
| `Joi.when()` | Use `.refine()` or discriminated unions |

## Best Practices

1. **Export Inferred Types**: Always export TypeScript types from schemas
2. **Reuse Common Schemas**: Create shared schemas for common patterns
3. **Keep Schemas Close to Routes**: Define validators near where they're used
4. **Use Meaningful Error Messages**: Provide context-specific error messages
5. **Validate at the Edge**: Validate input as early as possible
6. **Avoid Complex Transformations**: Keep transformations simple and predictable
7. **Test Your Schemas**: Write unit tests for complex validation logic
8. **Document Complex Validations**: Add comments for non-obvious validation rules
9. **Use Strict Mode**: Enable TypeScript strict mode for better type safety
10. **Performance Considerations**: Avoid async validations when possible

## Performance Tips

1. **Cache Schemas**: Schemas are parsed once and reused
2. **Avoid Deep Nesting**: Flatten objects when possible
3. **Use `.pick()` and `.omit()`**: Instead of creating new schemas
4. **Lazy Evaluation**: Use `.lazy()` for recursive schemas
5. **Benchmark Critical Paths**: Test performance of high-traffic endpoints

## Common Pitfalls

1. **Forgetting `.optional()`**: Fields are required by default
2. **Type vs Runtime**: TypeScript types don't validate at runtime
3. **Transform Order**: Transforms execute in order defined
4. **Error Path**: Use `path` in `.refine()` to indicate error location
5. **Async in Sync Context**: Can't use async validation in sync middleware

## Resources

- [Zod Documentation](https://zod.dev)
- [Zod GitHub](https://github.com/colinhacks/zod)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- Internal: `/backend/src/api/validators/` for examples