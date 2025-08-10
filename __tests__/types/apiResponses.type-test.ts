/**
 * Type-level tests for API response types
 */

import { expectType, expectAssignable, expectNotAssignable } from 'tsd';

import {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginatedResponse,
  ErrorDetails,
  isSuccessResponse,
  isErrorResponse
} from '../../types/apiResponses';

// Basic API response types
describe('API Response Types', () => {
  test('ApiSuccessResponse with generic data type', () => {
    interface User {
      id: string;
      name: string;
    }

    const response: ApiSuccessResponse<User> = {
      success: true,
      data: { id: '123', name: 'John' }
    };

    expectType<true>(response.success);
    expectType<User>(response.data);
    expectType<{ id: string; name: string }>(response.data);
  });

  test('ApiErrorResponse structure', () => {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'ERR_001',
        message: 'Something went wrong',
        details: { field: 'email', reason: 'invalid format' }
      },
      meta: {
        timestamp: '2023-01-01T00:00:00Z'
      }
    };

    expectType<false>(response.success);
    expectType<string>(response.error.code);
    expectType<string>(response.error.message);
    expectAssignable<ErrorDetails | undefined>(response.error.details);
  });

  test('ApiResponse union type', () => {
    interface UserData {
      id: string;
      email: string;
    }

    const successResponse: ApiResponse<UserData> = {
      success: true,
      data: { id: '123', email: 'user@example.com' }
    };

    const errorResponse: ApiResponse<UserData> = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
      meta: { timestamp: '2023-01-01T00:00:00Z' }
    };

    expectType<ApiResponse<UserData>>(successResponse);
    expectType<ApiResponse<UserData>>(errorResponse);
  });
});

// Error details typing
describe('Error Details Types', () => {
  test('ErrorDetails accepts string', () => {
    const details: ErrorDetails = 'Simple error message';
    expectType<ErrorDetails>(details);
  });

  test('ErrorDetails accepts object', () => {
    const details: ErrorDetails = {
      field: 'email',
      code: 'INVALID_FORMAT',
      suggestions: ['Check format', 'Try again']
    };
    expectType<ErrorDetails>(details);
  });

  test('ErrorDetails accepts array', () => {
    const details: ErrorDetails = [
      { field: 'email', message: 'Required' },
      { field: 'password', message: 'Too short' }
    ];
    expectType<ErrorDetails>(details);
  });
});

// Pagination types
describe('Pagination Types', () => {
  test('PaginatedResponse with generic items', () => {
    interface Product {
      id: string;
      name: string;
      price: number;
    }

    const response: PaginatedResponse<Product> = {
      items: [
        { id: '1', name: 'Product 1', price: 100 },
        { id: '2', name: 'Product 2', price: 200 }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasNext: true,
        hasPrevious: false
      }
    };

    expectType<Product[]>(response.items);
    expectType<number>(response.pagination.total);
    expectType<boolean>(response.pagination.hasNext);
  });
});

// Type guards for API responses
describe('API Response Type Guards', () => {
  test('isSuccessResponse type narrowing', () => {
    interface UserProfile {
      id: string;
      username: string;
    }

    const response: ApiResponse<UserProfile> = {
      success: true,
      data: { id: '123', username: 'johndoe' }
    };

    if (isSuccessResponse(response)) {
      expectType<ApiSuccessResponse<UserProfile>>(response);
      expectType<UserProfile>(response.data);
      expectType<true>(response.success);
      
      // Should not be assignable to error response
      expectNotAssignable<ApiErrorResponse>(response);
    }
  });

  test('isErrorResponse type narrowing', () => {
    const response: ApiResponse<unknown> = {
      success: false,
      error: { code: 'AUTH_FAILED', message: 'Authentication required' },
      meta: { timestamp: '2023-01-01T00:00:00Z' }
    };

    if (isErrorResponse(response)) {
      expectType<ApiErrorResponse>(response);
      expectType<false>(response.success);
      expectType<string>(response.error.code);
      expectType<string>(response.error.message);
      
      // Should not be assignable to success response
      expectNotAssignable<ApiSuccessResponse<unknown>>(response);
    }
  });
});

// Complex response structures
describe('Complex Response Structures', () => {
  test('nested data structures maintain types', () => {
    interface ComplexData {
      user: {
        id: string;
        profile: {
          firstName: string;
          lastName: string;
          preferences: {
            theme: 'light' | 'dark';
            notifications: boolean;
          };
        };
      };
      permissions: string[];
    }

    const response: ApiSuccessResponse<ComplexData> = {
      success: true,
      data: {
        user: {
          id: '123',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            preferences: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        permissions: ['read', 'write']
      }
    };

    expectType<string>(response.data.user.id);
    expectType<'light' | 'dark'>(response.data.user.profile.preferences.theme);
    expectType<string[]>(response.data.permissions);
  });

  test('response with optional meta information', () => {
    const response: ApiSuccessResponse<string> = {
      success: true,
      data: 'Hello World',
      meta: {
        timestamp: '2023-01-01T00:00:00Z',
        requestId: 'req-123',
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10,
          // Additional pagination properties if needed
        }
      }
    };

    expectType<string | undefined>(response.meta?.requestId);
    // Cast to access pagination if needed
    const paginationMeta = response.meta as any;
    if (paginationMeta?.pagination) {
      expectType<number>(paginationMeta.pagination.total);
    }
  });
});

// Generic constraints and inference
describe('Generic Type Inference', () => {
  test('generic response factory function', () => {
    function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
      return {
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    }

    const stringResponse = createSuccessResponse('hello');
    expectType<ApiSuccessResponse<string>>(stringResponse);
    expectType<string>(stringResponse.data);

    const numberResponse = createSuccessResponse(42);
    expectType<ApiSuccessResponse<number>>(numberResponse);
    expectType<number>(numberResponse.data);

    const objectResponse = createSuccessResponse({ id: '123', active: true });
    expectType<ApiSuccessResponse<{ id: string; active: boolean }>>(objectResponse);
    expectType<string>(objectResponse.data.id);
    expectType<boolean>(objectResponse.data.active);
  });

  test('generic error response with constraints', () => {
    function createValidationError<T extends Record<string, unknown>>(
      details: T
    ): ApiErrorResponse {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    }

    const error = createValidationError({
      email: 'Required field',
      password: 'Too short'
    });

    expectType<ApiErrorResponse>(error);
    expectType<ErrorDetails | undefined>(error.error.details);
  });
});

// Error cases - should not compile
describe('Type Safety Error Cases', () => {
  test('cannot assign wrong success value', () => {
    const invalidSuccess1 = {
      success: 'true' as any, // Should be boolean true
      data: 'test'
    };
    expectNotAssignable<ApiSuccessResponse<string>>(invalidSuccess1);

    const invalidSuccess2 = {
      success: false as any, // Should be true for success response
      data: 'test'
    };
    expectNotAssignable<ApiSuccessResponse<string>>(invalidSuccess2);
  });

  test('cannot assign wrong data type', () => {
    interface User {
      id: string;
      name: string;
    }

    const invalidUser = {
      success: true as const,
      data: { id: 123, name: 'John' } // id should be string
    };
    expectNotAssignable<ApiSuccessResponse<User>>(invalidUser);
  });

  test('error response requires error field', () => {
    expectError({
      success: false,
      // Missing error field
      meta: { timestamp: '2023-01-01T00:00:00Z' }
    } as ApiErrorResponse);
  });

  test('cannot mix success and error response properties', () => {
    expectError({
      success: true,
      data: 'test',
      error: { code: 'ERR', message: 'Error' } // Should not have error in success response
    } as ApiSuccessResponse<string>);
  });
});