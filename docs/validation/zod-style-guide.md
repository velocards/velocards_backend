# Zod Validation Style Guide

## Overview

This guide outlines the standards and best practices for implementing validation schemas using Zod in the VeloCards backend application.

## Table of Contents

1. [Schema Organization](#schema-organization)
2. [Naming Conventions](#naming-conventions)
3. [Common Patterns](#common-patterns)
4. [Performance Considerations](#performance-considerations)
5. [Error Messages](#error-messages)
6. [Type Inference](#type-inference)
7. [Testing](#testing)

## Schema Organization

### File Structure

```
src/
├── api/
│   └── validators/          # Route-specific validators
│       ├── authValidators.ts
│       ├── cardValidators.ts
│       └── ...
└── validation/
    └── zod/
        ├── common/          # Reusable validators
        │   └── validators.ts
        ├── monitoring/      # Performance monitoring
        │   └── performanceMonitor.ts
        └── __tests__/       # Validation tests
```

### Module Structure

```typescript
// 1. Imports
import { z } from 'zod';
import { CommonValidators } from '../../validation/zod/common/validators';

// 2. Constants
const SUPPORTED_TYPES = ['type1', 'type2'] as const;

// 3. Schema definitions
export const mySchema = z.object({
  // ...
});

// 4. Type exports
export type MyInput = z.infer<typeof mySchema>['body'];
```

## Naming Conventions

### Schema Names

- Use descriptive names ending with `Schema`
- Use verb + noun pattern for action schemas

```typescript
// Good
export const registerUserSchema = z.object({ /* ... */ });
export const updateProfileSchema = z.object({ /* ... */ });
export const createCardSchema = z.object({ /* ... */ });

// Bad
export const user = z.object({ /* ... */ });
export const schema1 = z.object({ /* ... */ });
```

### Type Names

- Append `Input` or `Output` to schema-derived types
- Use PascalCase for type names

```typescript
export type RegisterUserInput = z.infer<typeof registerUserSchema>['body'];
export type RegisterUserOutput = z.infer<typeof registerUserResponseSchema>;
```

## Common Patterns

### Request Validation

Always validate body, query, and params separately:

```typescript
export const myRouteSchema = z.object({
  body: z.object({
    // Body validation
  }),
  query: z.object({
    // Query validation
  }),
  params: z.object({
    // Params validation
  })
});
```

### Reusable Validators

Use the CommonValidators for standard validations:

```typescript
import { CommonValidators } from '../../validation/zod/common/validators';

export const userSchema = z.object({
  email: CommonValidators.email,
  password: CommonValidators.password,
  phone: CommonValidators.phoneNumber,
  birthDate: CommonValidators.birthDate
});
```

### Custom Refinements

Use refinements for business logic validation:

```typescript
export const withdrawalSchema = z.object({
  amount: z.number().positive(),
  accountBalance: z.number()
}).refine(
  (data) => data.amount <= data.accountBalance,
  {
    message: 'Insufficient balance',
    path: ['amount']
  }
);
```

### Optional Fields

Be explicit about optional fields:

```typescript
export const updateSchema = z.object({
  name: z.string().optional(),        // Can be undefined
  email: z.string().nullable(),       // Can be null
  phone: z.string().nullish(),        // Can be null or undefined
  address: z.string().optional().default('') // Has default value
});
```

### Array Validation

Use appropriate constraints for arrays:

```typescript
export const itemsSchema = z.object({
  tags: z.array(z.string())
    .min(1, 'At least one tag required')
    .max(10, 'Maximum 10 tags allowed'),
  
  items: CommonValidators.arrayLength(
    z.string(),
    1,  // min
    100 // max
  )
});
```

## Performance Considerations

### Async Validation

Use async validation sparingly:

```typescript
// Prefer synchronous validation
export const syncSchema = z.object({
  email: z.string().email()
});

// Use async only when necessary (e.g., database checks)
export const asyncSchema = z.object({
  username: z.string()
}).refineAsync(
  async (data) => {
    return await checkUsernameAvailable(data.username);
  },
  'Username already taken'
);
```

### Schema Caching

Cache compiled schemas when possible:

```typescript
// Create schema once
const compiledSchema = mySchema.strict();

// Reuse in middleware
export const validator = (req, res, next) => {
  compiledSchema.parse(req.body);
  next();
};
```

### Performance Monitoring

Enable monitoring for critical paths:

```typescript
import { validationMonitor } from '../../validation/zod/monitoring/performanceMonitor';

// In production, monitor slow validations
if (process.env.ENABLE_VALIDATION_MONITORING === 'true') {
  validationMonitor.recordValidation(schemaName, startTime, success);
}
```

## Error Messages

### User-Friendly Messages

Provide clear, actionable error messages:

```typescript
// Good
z.string().min(8, 'Password must be at least 8 characters')
z.number().max(100, 'Age cannot exceed 100 years')

// Bad
z.string().min(8, 'Invalid')
z.number().max(100, 'Error')
```

### Consistent Format

Use consistent error message format:

```typescript
const errorFormat = {
  required: '{field} is required',
  invalid: 'Invalid {field} format',
  tooShort: '{field} must be at least {min} characters',
  tooLong: '{field} cannot exceed {max} characters'
};
```

### Security Considerations

Never expose sensitive information in error messages:

```typescript
// Good
.refine(
  async (email) => await userExists(email),
  'Invalid credentials' // Generic message
)

// Bad
.refine(
  async (email) => await userExists(email),
  'User with this email does not exist' // Reveals information
)
```

## Type Inference

### Always Export Types

Export inferred types for use in services:

```typescript
// In validator file
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string()
  })
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];

// In service file
import { CreateUserInput } from '../validators/userValidators';

async function createUser(data: CreateUserInput) {
  // Type-safe usage
}
```

### Avoid Type Assertions

Let Zod handle type inference:

```typescript
// Good
const validated = schema.parse(data);
// validated is properly typed

// Bad
const validated = schema.parse(data) as MyType;
// Bypasses type safety
```

## Testing

### Test Structure

```typescript
describe('UserValidators', () => {
  describe('registerSchema', () => {
    it('should accept valid data', () => {
      const valid = { /* ... */ };
      expect(() => registerSchema.parse(valid)).not.toThrow();
    });

    it('should reject invalid data', () => {
      const invalid = { /* ... */ };
      expect(() => registerSchema.parse(invalid)).toThrow();
    });

    it('should transform data correctly', () => {
      const input = { /* ... */ };
      const result = registerSchema.parse(input);
      expect(result).toEqual(expected);
    });
  });
});
```

### Edge Cases

Always test edge cases:

```typescript
describe('edge cases', () => {
  it('should handle minimum values', () => {
    // Test minimum allowed values
  });

  it('should handle maximum values', () => {
    // Test maximum allowed values
  });

  it('should handle empty inputs', () => {
    // Test empty strings, arrays, etc.
  });

  it('should handle special characters', () => {
    // Test with special characters
  });
});
```

### Performance Tests

Include performance benchmarks:

```typescript
describe('performance', () => {
  it('should validate quickly', async () => {
    const startTime = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      schema.parse(testData);
    }
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100); // Less than 100ms for 1000 validations
  });
});
```

## Migration from Joi

### Key Differences

| Joi | Zod |
|-----|-----|
| `Joi.string().required()` | `z.string()` |
| `Joi.string().optional()` | `z.string().optional()` |
| `Joi.string().email()` | `z.string().email()` |
| `Joi.number().min(5)` | `z.number().min(5)` |
| `Joi.array().items()` | `z.array()` |
| `Joi.when()` | Use `z.union()` or `refine()` |

### Migration Checklist

- [ ] Replace Joi imports with Zod
- [ ] Update schema definitions
- [ ] Export TypeScript types
- [ ] Update middleware to use Zod
- [ ] Update tests
- [ ] Remove Joi dependency

## Best Practices Summary

1. **Use CommonValidators** for standard validations
2. **Export types** for all schemas
3. **Provide clear error messages** for users
4. **Test thoroughly** including edge cases
5. **Monitor performance** in production
6. **Sanitize input** before validation
7. **Use refinements** for business logic
8. **Keep schemas simple** and composable
9. **Document complex validations** with comments
10. **Version your API** when making breaking changes

## Examples

### Complete Route Validator Example

```typescript
import { z } from 'zod';
import { CommonValidators } from '../../validation/zod/common/validators';

// Constants
const CARD_TYPES = ['single_use', 'multi_use'] as const;

// Main schema
export const createCardSchema = z.object({
  body: z.object({
    type: z.enum(CARD_TYPES),
    fundingAmount: CommonValidators.monetaryAmount
      .min(10, 'Minimum funding is $10')
      .max(10000, 'Maximum funding is $10,000'),
    cardholderName: CommonValidators.sanitizedString
      .min(2, 'Name too short')
      .max(50, 'Name too long'),
    email: CommonValidators.email,
    phone: CommonValidators.phoneNumber.optional()
  }).refine(
    (data) => {
      // Business logic validation
      if (data.type === 'single_use' && data.fundingAmount > 1000) {
        return false;
      }
      return true;
    },
    {
      message: 'Single-use cards cannot exceed $1,000',
      path: ['fundingAmount']
    }
  )
});

// Export types
export type CreateCardInput = z.infer<typeof createCardSchema>['body'];

// Usage in route
router.post(
  '/cards',
  authenticate,
  validate(createCardSchema, 'createCard'),
  CardController.create
);
```

This style guide should be treated as a living document and updated as new patterns emerge or requirements change.