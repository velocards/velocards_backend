# Joi to Zod Migration Guide

## Overview

This guide documents the migration patterns and considerations when migrating validation schemas from Joi to Zod in the VeloCards backend API. While the current implementation already uses Zod, this guide serves as a reference for understanding the migration patterns and maintaining both validators in parallel during transition periods.

## Table of Contents

1. [Why Migrate to Zod](#why-migrate-to-zod)
2. [Migration Strategy](#migration-strategy)
3. [Common Pattern Conversions](#common-pattern-conversions)
4. [Gotchas and Differences](#gotchas-and-differences)
5. [Testing Strategy](#testing-strategy)
6. [Feature Flag Configuration](#feature-flag-configuration)
7. [Step-by-Step Migration Instructions](#step-by-step-migration-instructions)

## Why Migrate to Zod

### Advantages of Zod

- **TypeScript-First Design**: Zod provides automatic TypeScript type inference
- **Better Type Safety**: Compile-time type checking for schemas
- **Smaller Bundle Size**: More efficient for frontend usage
- **Cleaner API**: More intuitive method chaining
- **Better Error Messages**: More descriptive validation errors out of the box

### Current State

- Backend validation has been migrated to Zod
- Joi remains as a dependency for legacy compatibility
- Parallel testing infrastructure ensures parity between validators

## Migration Strategy

### Phased Approach

1. **Phase 1**: Create Zod schemas alongside existing Joi schemas ✅
2. **Phase 2**: Implement parallel testing to verify parity ✅
3. **Phase 3**: Deploy with feature flag for gradual rollout ✅
4. **Phase 4**: Monitor and fix any discrepancies
5. **Phase 5**: Remove Joi schemas and dependencies

### Current Implementation

```typescript
// Feature flag controls which validator is active
USE_ZOD_VALIDATOR=true  # Use Zod (default)
USE_ZOD_VALIDATOR=false # Use Joi (fallback)
```

## Common Pattern Conversions

### Basic Types

#### String Validation

```typescript
// Joi
Joi.string().min(1).max(50).required()

// Zod
z.string().min(1).max(50)
```

#### Number Validation

```typescript
// Joi
Joi.number().integer().positive().min(10).max(100)

// Zod
z.number().int().positive().min(10).max(100)
```

#### Email Validation

```typescript
// Joi
Joi.string().email().required()

// Zod
z.string().email()
```

### Complex Validations

#### Object with Optional Fields

```typescript
// Joi
Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  age: Joi.number().optional()
}).min(1) // At least one field required

// Zod
z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  age: z.number().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
})
```

#### Enum Validation

```typescript
// Joi
Joi.string().valid('active', 'inactive', 'pending')

// Zod
z.enum(['active', 'inactive', 'pending'])
```

#### Custom Validation

```typescript
// Joi
Joi.string().custom((value, helpers) => {
  if (!isValidPhone(value)) {
    return helpers.error('any.invalid');
  }
  return value;
})

// Zod
z.string().refine(value => isValidPhone(value), {
  message: 'Invalid phone number'
})
```

#### Conditional Validation

```typescript
// Joi
Joi.object({
  type: Joi.string().required(),
  details: Joi.when('type', {
    is: 'advanced',
    then: Joi.object().required(),
    otherwise: Joi.optional()
  })
})

// Zod
z.object({
  type: z.string(),
  details: z.object().optional()
}).refine(data => {
  if (data.type === 'advanced' && !data.details) {
    return false;
  }
  return true;
}, {
  message: 'Details required for advanced type'
})
```

### Arrays and Nested Objects

```typescript
// Joi
Joi.object({
  users: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid(),
      name: Joi.string().required()
    })
  ).min(1).max(10)
})

// Zod
z.object({
  users: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string()
    })
  ).min(1).max(10)
})
```

## Gotchas and Differences

### 1. Required vs Optional Default Behavior

- **Joi**: Fields are optional by default, use `.required()` to make mandatory
- **Zod**: Fields are required by default, use `.optional()` to make optional

### 2. Type Coercion

```typescript
// Joi automatically coerces types
Joi.number() // Accepts "123" and converts to 123

// Zod requires explicit coercion
z.string().transform(val => parseInt(val, 10))
// or
z.coerce.number()
```

### 3. Error Message Format

```typescript
// Joi custom messages
Joi.string().min(8).messages({
  'string.min': 'Password must be at least 8 characters'
})

// Zod custom messages
z.string().min(8, 'Password must be at least 8 characters')
```

### 4. Validation Options

```typescript
// Joi
schema.validate(data, {
  abortEarly: false,  // Get all errors
  stripUnknown: true, // Remove unknown fields
  convert: true       // Type coercion
})

// Zod
schema.parse(data)     // Throws on error
schema.safeParse(data) // Returns result object
schema.strip()         // Remove unknown fields
```

### 5. Default Values

```typescript
// Joi
Joi.string().default('defaultValue')

// Zod
z.string().default('defaultValue')
// or
z.string().optional().default('defaultValue')
```

## Testing Strategy

### Parallel Testing Implementation

The parallel testing utility (`src/validation/testing/parity-tester.ts`) allows you to:

1. Test both validators with the same input
2. Compare validation results
3. Identify discrepancies
4. Generate detailed reports

### Running Parity Tests

```bash
# Run all parity tests
npm test -- --testPathPattern=parity

# Run specific schema tests
npm test -- user-parity.test.ts
```

### Example Test Case

```typescript
import { parityTester } from '../testing/parity-tester';
import * as zodSchemas from '../zod';
import * as joiSchemas from '../joi';

describe('Schema Parity', () => {
  it('should validate equivalently', () => {
    const result = parityTester.testSingle(
      zodSchemas.userSchema,
      joiSchemas.userSchema,
      { /* test data */ }
    );
    
    expect(result.isEquivalent).toBe(true);
  });
});
```

## Feature Flag Configuration

### Environment Variable

```bash
# .env file
USE_ZOD_VALIDATOR=true  # Use Zod (recommended)
USE_ZOD_VALIDATOR=false # Use Joi (fallback)
```

### Middleware Configuration

```typescript
// Using dual validation middleware
import { validateDual } from './middlewares/validate-dual';

router.post('/endpoint',
  validateDual(zodSchema, joiSchema),
  controller.handler
);
```

### Monitoring Active Validator

```typescript
// Check which validator is active
import { getCurrentValidator } from './middlewares/validate-dual';

console.log('Active validator:', getCurrentValidator()); // 'zod' or 'joi'
```

## Step-by-Step Migration Instructions

### For New Schemas

1. **Create Zod schema only** - New schemas should be Zod-only
2. **Use standard validate middleware**
3. **Add comprehensive tests**

### For Existing Schemas

1. **Identify Target Schema**
   - Locate the Joi schema to migrate
   - Document current validation rules

2. **Create Zod Equivalent**
   ```typescript
   // Create new Zod schema matching Joi behavior
   export const userSchemaZod = z.object({
     // ... schema definition
   });
   ```

3. **Add Parity Tests**
   ```typescript
   // Create test file to verify equivalence
   describe('User Schema Parity', () => {
     // Test various inputs
   });
   ```

4. **Update Route to Use Dual Validation**
   ```typescript
   router.post('/users',
     validateDual(userSchemaZod, userSchemaJoi),
     userController.create
   );
   ```

5. **Deploy with Monitoring**
   - Enable parallel validation logging
   - Monitor for discrepancies
   - Fix any issues found

6. **Switch to Zod-Only**
   - Set `USE_ZOD_VALIDATOR=true`
   - Monitor for issues
   - Remove Joi schema after stability confirmed

## Best Practices

1. **Always Write Tests**: Every schema should have comprehensive test coverage
2. **Use Type Inference**: Leverage Zod's TypeScript integration
3. **Document Complex Validations**: Add comments for complex refinements
4. **Gradual Migration**: Migrate one schema at a time
5. **Monitor in Production**: Use parallel validation to catch edge cases

## Common Issues and Solutions

### Issue: Different Error Messages

**Solution**: Standardize error messages in both validators or update client expectations

### Issue: Type Coercion Differences

**Solution**: Use explicit transforms in Zod or adjust input preprocessing

### Issue: Optional/Required Mismatches

**Solution**: Carefully review field requirements and adjust accordingly

### Issue: Performance Differences

**Solution**: Zod is generally faster; optimize complex Joi custom validators

## Conclusion

The migration from Joi to Zod provides better TypeScript integration, improved developer experience, and better performance. Using the parallel testing approach ensures a smooth transition with minimal risk to production systems.

For questions or issues during migration, consult the test suite examples and parity testing reports.