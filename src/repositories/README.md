# Repository Pattern Documentation

## Overview

This repository layer implements a standardized data access pattern for the Velocards backend, providing consistent interfaces and base implementations for all database operations.

## Core Components

### Interfaces

#### IRepository<T>
Base repository interface with standard CRUD operations:
- `create(data: Partial<T>): Promise<T>`
- `findById(id: string): Promise<T | null>`
- `findAll(filters?: QueryFilters): Promise<T[]>`
- `update(id: string, data: Partial<T>): Promise<T>`
- `delete(id: string): Promise<boolean>`
- `exists(id: string): Promise<boolean>`

#### IQueryable<T>
Interface for complex query operations:
- `query(options: QueryOptions): Promise<T[]>`
- `count(where?: Record<string, any>): Promise<number>`
- `findOne(where: Record<string, any>): Promise<T | null>`
- `findMany(where: Record<string, any>): Promise<T[]>`

#### ITransactional
Interface for transaction management:
- `beginTransaction(options?: TransactionOptions): Promise<ITransactionContext>`
- `executeInTransaction<T>(callback: Function, options?: TransactionOptions): Promise<T>`

### Base Implementation

#### BaseRepository<T>
Abstract class providing:
- Automatic retry logic for transient failures
- Connection pooling
- Audit logging for all state-changing operations
- Standardized error handling and mapping
- Soft delete support
- Query builder helpers

## Usage Examples

### Creating a New Repository

```typescript
import { BaseRepository } from './BaseRepository'
import { SupabaseClient } from '@supabase/supabase-js'

interface Product {
  id: string
  name: string
  price: number
  stock: number
}

class ProductRepository extends BaseRepository<Product> {
  constructor(client?: SupabaseClient) {
    super('products', client)
  }

  // Add custom methods specific to products
  async findByCategory(category: string): Promise<Product[]> {
    return this.findMany({ category })
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findById(id)
    if (!product) {
      throw new NotFoundError('Product')
    }
    return this.update(id, { stock: product.stock + quantity })
  }
}

export const productRepository = new ProductRepository()
```

### Using Transactions

```typescript
import { transactionManager } from './TransactionManager'

async function transferFunds(fromUserId: string, toUserId: string, amount: number) {
  return transactionManager.executeInTransaction(async (context) => {
    // Deduct from sender
    const sender = await userRepository.findById(fromUserId)
    if (sender.balance < amount) {
      throw new InsufficientBalanceError(amount, sender.balance)
    }
    await userRepository.update(fromUserId, { 
      balance: sender.balance - amount 
    })

    // Add to receiver
    const receiver = await userRepository.findById(toUserId)
    await userRepository.update(toUserId, { 
      balance: receiver.balance + amount 
    })

    // Log transaction
    await transactionRepository.create({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount: amount,
      type: 'transfer'
    })

    return { success: true }
  })
}
```

### Query Examples

```typescript
// Simple queries
const user = await userRepository.findById('user-123')
const allUsers = await userRepository.findAll()

// Filtered queries with pagination
const activeUsers = await userRepository.findAll({
  account_status: 'active',
  page: 1,
  limit: 20,
  sortBy: 'created_at',
  sortOrder: 'desc'
})

// Complex queries
const results = await userRepository.query({
  where: { 
    account_status: 'active',
    kyc_status: 'approved'
  },
  orderBy: [
    { field: 'virtual_balance', direction: 'desc' },
    { field: 'created_at', direction: 'asc' }
  ],
  limit: 10,
  offset: 0
})

// Count queries
const activeCount = await userRepository.count({ 
  account_status: 'active' 
})
```

### Error Handling

All repositories use standardized error handling:

```typescript
try {
  const user = await userRepository.create({
    email: 'user@example.com',
    // ... other fields
  })
} catch (error) {
  if (error.code === 'DUPLICATE_ENTRY') {
    // Handle duplicate email
  } else if (error.code === 'VALIDATION_ERROR') {
    // Handle validation errors
  } else {
    // Handle other errors
  }
}
```

## Security Features

- **Parameterized Queries**: All queries use Supabase's parameterized query system
- **Input Validation**: Integrated with Zod schemas for runtime validation
- **Audit Logging**: Automatic logging of all CREATE, UPDATE, DELETE operations
- **Error Sanitization**: Database errors are mapped to safe user-facing messages

## Performance Features

- **Connection Pooling**: Managed by Supabase client
- **Retry Logic**: Automatic retry for transient failures (3 attempts by default)
- **Query Optimization**: Built-in pagination and selective field queries
- **Correlation IDs**: All operations include correlation IDs for tracing

## Testing

See `backend/src/__tests__/repositories/` for comprehensive test examples.

### Test Utilities

```typescript
import { TransactionTestUtils } from './utils/TransactionTestUtils'

// Create mock transaction context
const mockContext = TransactionTestUtils.createMockContext()

// Verify transaction isolation
const isolated = await TransactionTestUtils.verifyTransactionIsolation(
  async () => operation1(),
  async () => operation2()
)

// Simulate transaction failure
const { error, context } = await TransactionTestUtils.simulateTransactionFailure(
  async () => riskyOperation(),
  new Error('Simulated failure')
)
assert(context.rollbackCalled === true)
```

## Migration Guide

### Migrating Existing Repositories

1. Extend `BaseRepository` instead of implementing from scratch
2. Remove redundant CRUD implementations
3. Override only custom business logic methods
4. Ensure backward compatibility for existing method signatures

Example migration:

```typescript
// Before
export class UserRepository {
  static async findById(id: string): Promise<User | null> {
    // Custom implementation
  }
}

// After
class UserRepositoryClass extends BaseRepository<User> {
  constructor() {
    super('user_profiles')
  }
  // Custom methods only
}

// Maintain static interface for backward compatibility
export class UserRepository {
  static async findById(id: string): Promise<User | null> {
    return userRepositoryInstance.findById(id)
  }
}
```