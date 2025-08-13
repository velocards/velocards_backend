# API Response Standardization Documentation

## Overview

This document describes the standardized response formats implemented across all VeloCards API endpoints. The standardization ensures consistency, improves developer experience, and maintains backward compatibility.

## API Versioning

### Version Strategy
- **URL-based versioning**: `/api/v1` and `/api/v2`
- **Migration period**: 90 days overlap for parallel versioning
- **Default version**: v1 (for backward compatibility)

### Version Detection
The API version is determined in the following order:
1. URL path (e.g., `/api/v2/users`)
2. Accept header (e.g., `application/vnd.velocards.v2+json`)
3. Custom header (e.g., `X-API-Version: v2`)
4. Query parameter (e.g., `?apiVersion=v2`)
5. Default to v1 if not specified

## Response Formats

### Base Response Structure (v1)
```json
{
  "success": boolean,
  "data": any,
  "error": string
}
```

### Enhanced Response Structure (v2)
```json
{
  "success": boolean,
  "data": any,
  "error": string,
  "timestamp": "2025-08-12T10:30:00Z",
  "correlationId": "uuid-v4",
  "version": "v2"
}
```

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "errorCode": "ERROR_CODE",
  "statusCode": 400,
  "details": {
    // Additional error details (non-production only)
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "pages": 10,
      "limit": 10
    }
  }
}
```

### Cursor-Based Pagination Response
```json
{
  "success": true,
  "data": {
    "edges": [
      {
        "node": {},
        "cursor": "base64-encoded-cursor"
      }
    ],
    "pageInfo": {
      "hasNextPage": true,
      "hasPreviousPage": false,
      "startCursor": "cursor",
      "endCursor": "cursor",
      "totalCount": 100
    }
  }
}
```

## Error Codes

### Authentication Errors (AUTH_XXX)
- `AUTH_001`: Invalid credentials
- `AUTH_002`: Token expired
- `AUTH_003`: Invalid token
- `AUTH_004`: Invalid refresh token
- `AUTH_005`: Session expired
- `AUTH_006`: Unauthorized access
- `AUTH_007`: 2FA required
- `AUTH_008`: Invalid 2FA code
- `AUTH_009`: Email not verified
- `AUTH_010`: Account locked

### Validation Errors (VAL_XXX)
- `VAL_001`: Validation failed
- `VAL_002`: Required field missing
- `VAL_003`: Invalid format
- `VAL_004`: Invalid type
- `VAL_005`: Value out of range
- `VAL_006`: Duplicate value
- `VAL_007`: Invalid enum value

### Resource Errors (RES_XXX)
- `RES_001`: Resource not found
- `RES_002`: Resource already exists
- `RES_003`: Resource conflict
- `RES_004`: Resource locked
- `RES_005`: Resource deleted

### Business Logic Errors (BUS_XXX)
- `BUS_001`: Insufficient balance
- `BUS_002`: Transaction limit exceeded
- `BUS_003`: Card limit reached
- `BUS_004`: KYC required
- `BUS_005`: KYC pending
- `BUS_006`: KYC rejected
- `BUS_007`: Tier restriction
- `BUS_008`: Operation not allowed

### Rate Limiting Errors (RATE_XXX)
- `RATE_001`: Rate limit exceeded
- `RATE_002`: Global rate limit exceeded
- `RATE_003`: User rate limit exceeded

## HTTP Status Codes

### Success Codes
- `200 OK`: Successful GET, PUT
- `201 Created`: Successful POST creating new resource
- `204 No Content`: Successful DELETE

### Client Error Codes
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded

### Server Error Codes
- `500 Internal Server Error`: Generic server error
- `502 Bad Gateway`: External service error
- `503 Service Unavailable`: Service temporarily unavailable
- `504 Gateway Timeout`: Request timeout

## Migration Guide

### For v1 Clients

#### No Action Required
Existing v1 clients will continue to work without modifications. The compatibility layer ensures:
- Responses maintain v1 format
- No breaking changes
- Automatic response transformation

#### Recommended Migration Steps
1. Update base URL to include version: `/api/v1`
2. Test with v2 endpoints
3. Update response handling for v2 format
4. Migrate gradually endpoint by endpoint

### For New Implementations

#### Use v2 Endpoints
New implementations should use v2 endpoints for:
- Enhanced error information
- Correlation IDs for debugging
- Consistent pagination
- Better type safety

#### Example Migration

**v1 Request:**
```javascript
fetch('/api/users?page=1&limit=10')
```

**v2 Request:**
```javascript
fetch('/api/v2/users', {
  method: 'GET',
  headers: {
    'X-API-Version': 'v2'
  },
  body: JSON.stringify({
    pagination: {
      page: 1,
      limit: 10
    }
  })
})
```

## Response Headers

### Standard Headers
- `X-API-Version`: Current API version
- `X-Supported-Versions`: List of supported versions
- `X-Correlation-Id`: Request tracking ID

### Deprecation Headers
- `X-API-Deprecated`: Indicates deprecated endpoint
- `X-API-Sunset-Date`: Date when endpoint will be removed
- `X-API-Deprecation-Info`: Migration instructions

## Usage Examples

### TypeScript Client

```typescript
import { BaseApiResponse, PaginatedResponse } from '@velocards/api-types';

// Success response
interface UserResponse extends BaseApiResponse<User> {
  success: true;
  data: User;
}

// Paginated response
interface UsersResponse extends PaginatedResponse<User> {
  success: true;
  data: {
    items: User[];
    pagination: {
      total: number;
      page: number;
      pages: number;
    };
  };
}

// Error handling
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/v2/users/${id}`);
  const data: BaseApiResponse<User> = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data.data;
}
```

### Error Handling

```typescript
try {
  const user = await fetchUser('123');
} catch (error) {
  if (error.errorCode === 'AUTH_001') {
    // Handle authentication error
  } else if (error.errorCode === 'RES_001') {
    // Handle not found error
  } else {
    // Handle generic error
  }
}
```

## Testing

### Response Validation
All responses are validated against the standardized format:
- Structure validation
- Type checking
- Required fields verification

### Backward Compatibility Testing
- v1 endpoints tested with legacy clients
- Response transformation validated
- No breaking changes verified

## Monitoring

### Metrics Tracked
- API version usage
- Response times by version
- Error rates by endpoint
- Deprecation warning frequency

### Migration Tracking
- v1 endpoint usage statistics
- Client version distribution
- Migration progress monitoring

## Support

For questions or issues with the API standardization:
- Documentation: https://api.velocards.com/docs
- Support: support@velocards.com
- Migration Guide: https://velocards.com/api-migration