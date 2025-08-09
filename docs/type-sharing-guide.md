# Type Sharing Guide for Dashboard Repository

## Overview

This guide explains how to use TypeScript types exported from the backend repository in the dashboard repository. All types are now automatically inferred from Zod validation schemas, ensuring consistency between validation and TypeScript types.

## Type Export Location

All shared types are exported from:
```
backend/src/types/exported.ts
```

## How to Use in Dashboard

### Option 1: Direct Copy (Current Approach)

1. Copy the `exported.ts` file to your dashboard repository:
   ```bash
   cp ../backend/src/types/exported.ts ./types/backend-types.ts
   ```

2. Import types in your dashboard components:
   ```typescript
   import { 
     LoginInput, 
     UserProfileResponse,
     CardResponse 
   } from '@/types/backend-types';
   ```

### Option 2: Selective Import (Recommended)

Create specific type files in the dashboard for different domains:

**types/auth.types.ts:**
```typescript
export {
  RegisterInput,
  LoginInput,
  LoginResponse,
  UserProfileResponse
} from './backend-types';
```

**types/card.types.ts:**
```typescript
export {
  CreateCardInput,
  CardResponse,
  CardListResponse,
  CardStatus,
  CardType
} from './backend-types';
```

## Type Categories

### Input Types (Request Bodies)
- `*Input` - Types for API request bodies
- `*Query` - Types for query parameters
- `*Params` - Types for URL parameters

### Response Types
- `*Response` - Types for API responses
- `*ListResponse` - Types for paginated responses

### Enums and Constants
- Status enums (KycStatus, AccountStatus, CardStatus)
- Type enums (CardType, UserRole, TierLevel)
- Supported values (SUPPORTED_CURRENCIES)

## Example Usage

### Login Form
```typescript
import { LoginInput, LoginResponse } from '@/types/backend-types';

const loginUser = async (data: LoginInput): Promise<LoginResponse> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

### Card Creation
```typescript
import { CreateCardInput, CardResponse } from '@/types/backend-types';

interface CardFormProps {
  onSubmit: (data: CreateCardInput) => Promise<CardResponse>;
}

const CardForm: React.FC<CardFormProps> = ({ onSubmit }) => {
  // Form implementation using CreateCardInput type
};
```

### User Profile Display
```typescript
import { UserProfileResponse } from '@/types/backend-types';

interface ProfileProps {
  user: UserProfileResponse;
}

const UserProfile: React.FC<ProfileProps> = ({ user }) => {
  return (
    <div>
      <h1>{user.firstName} {user.lastName}</h1>
      <p>Email: {user.email}</p>
      <p>KYC Status: {user.kycStatus}</p>
      {user.tier && (
        <p>Tier: {user.tier.displayName}</p>
      )}
    </div>
  );
};
```

## Keeping Types in Sync

### Manual Sync Process

1. When backend types change, the backend team will update `src/types/exported.ts`
2. Dashboard team should regularly sync types:
   ```bash
   # From dashboard repository
   npm run sync-types  # Add this script to package.json
   ```

### Automated Sync (Future)

We plan to implement:
1. Shared npm package for types
2. Automated type generation from OpenAPI spec
3. CI/CD pipeline to validate type compatibility

## Benefits of Zod-Inferred Types

1. **Single Source of Truth**: Types are derived from validation schemas
2. **No Manual Sync**: Types automatically update when validation changes
3. **Runtime Safety**: Validation and types are always in sync
4. **Better DX**: Auto-completion and type checking in IDE

## Migration from Manual Types

If you're migrating from manually defined types:

1. Replace manual interface definitions with imported types
2. Update import statements to use the new location
3. Test thoroughly as some type names may have changed

### Common Type Name Changes

| Old Name | New Name |
|----------|----------|
| `IUser` | `UserProfileResponse` |
| `ICard` | `CardResponse` |
| `ITransaction` | `TransactionResponse` |
| `UserUpdateDto` | `UpdateProfileInput` |
| `CardCreateDto` | `CreateCardInput` |

## Troubleshooting

### Type Mismatch Errors

If you encounter type mismatches:
1. Ensure you have the latest types from backend
2. Check if the API response format has changed
3. Verify you're using the correct type (Input vs Response)

### Missing Types

If a type is missing:
1. Check if it's been added to `exported.ts`
2. Request backend team to export it if needed
3. Consider if it should be a shared type

## Future Improvements

1. **Shared Types Package**: Create `@velocards/types` npm package
2. **OpenAPI Integration**: Generate types from Swagger/OpenAPI spec
3. **Type Versioning**: Version types to handle breaking changes
4. **Automated Testing**: Add type compatibility tests in CI/CD

## Contact

For questions or issues with shared types:
- Backend Team: Update and maintain type exports
- Dashboard Team: Consume types and report issues
- DevOps: Help with automation and CI/CD integration