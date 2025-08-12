/**
 * Type-level tests for type guards
 * These tests verify that type guards properly narrow types at compile time
 */

import { expectType, expectAssignable, expectNotAssignable } from 'tsd';

import * as guards from '../../utils/typeGuards';
import { ApiSuccessResponse, ApiErrorResponse } from '../../types/apiResponses';

// Basic type guards
describe('Basic Type Guards', () => {
  test('isString narrows to string', () => {
    const value: unknown = 'test';
    if (guards.isString(value)) {
      expectType<string>(value);
    }
  });

  test('isNumber narrows to number', () => {
    const value: unknown = 42;
    if (guards.isNumber(value)) {
      expectType<number>(value);
    }
  });

  test('isBoolean narrows to boolean', () => {
    const value: unknown = true;
    if (guards.isBoolean(value)) {
      expectType<boolean>(value);
    }
  });

  test('isObject narrows to Record<string, unknown>', () => {
    const value: unknown = { key: 'value' };
    if (guards.isObject(value)) {
      expectType<Record<string, unknown>>(value);
    }
  });

  test('isArray narrows to unknown[]', () => {
    const value: unknown = [1, 2, 3];
    if (guards.isArray(value)) {
      expectType<unknown[]>(value);
    }
  });

  test('isArrayOf with type parameter', () => {
    const value: unknown = ['a', 'b', 'c'];
    if (guards.isArrayOf(value, guards.isString)) {
      expectType<string[]>(value);
    }
  });

  test('isDefined excludes null and undefined', () => {
    const value: string | null | undefined = 'test';
    if (guards.isDefined(value)) {
      expectType<string>(value);
      expectNotAssignable<null>(value);
      expectNotAssignable<undefined>(value);
    }
  });
});

// Advanced type guards
describe('Advanced Type Guards', () => {
  test('isUUID narrows to string with format validation', () => {
    const value: unknown = '550e8400-e29b-41d4-a716-446655440000';
    if (guards.isUUID(value)) {
      expectType<string>(value);
    }
  });

  test('isEmail narrows to string with format validation', () => {
    const value: unknown = 'test@example.com';
    if (guards.isEmail(value)) {
      expectType<string>(value);
    }
  });

  test('isJWT narrows to string with format validation', () => {
    const value: unknown = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';
    if (guards.isJWT(value)) {
      expectType<string>(value);
    }
  });
});

// API response guards
describe('API Response Guards', () => {
  test('isSuccessResponse with generic type', () => {
    interface UserData {
      id: string;
      name: string;
    }

    const response: unknown = {
      success: true,
      data: { id: '123', name: 'John' }
    };

    if (guards.isSuccessResponse<UserData>(response)) {
      expectType<ApiSuccessResponse<UserData>>(response);
      expectType<UserData>(response.data);
    }
  });

  test('isErrorResponse narrows correctly', () => {
    const response: unknown = {
      success: false,
      error: { code: 'ERR001', message: 'Error occurred' }
    };

    if (guards.isErrorResponse(response)) {
      expectType<ApiErrorResponse>(response);
      expectType<false>(response.success);
      expectType<string>(response.error.code);
      expectType<string>(response.error.message);
    }
  });
});

// Object property guards
describe('Object Property Guards', () => {
  test('hasProperty creates proper type predicate', () => {
    const obj: unknown = { name: 'John', age: 30 };
    
    if (guards.hasProperty(obj, 'name')) {
      expectType<Record<'name', unknown>>(obj);
      expectType<unknown>(obj.name);
    }
  });

  test('hasProperties with multiple keys', () => {
    const obj: unknown = { name: 'John', age: 30, email: 'john@example.com' };
    
    if (guards.hasProperties(obj, 'name', 'age')) {
      expectType<Record<'name' | 'age', unknown>>(obj);
      expectType<unknown>(obj.name);
      expectType<unknown>(obj.age);
    }
  });
});

// Business logic guards
describe('Business Logic Guards', () => {
  test('isValidAmount ensures positive finite number', () => {
    const value: unknown = 100.50;
    if (guards.isValidAmount(value)) {
      expectType<number>(value);
      // At compile time, we know it's a number but runtime constraints aren't enforced in types
    }
  });

  test('isValidCurrency ensures 3-letter currency code', () => {
    const value: unknown = 'USD';
    if (guards.isValidCurrency(value)) {
      expectType<string>(value);
    }
  });

  test('isValidStatus with enum constraint', () => {
    const validStatuses = ['active', 'inactive', 'pending'] as const;
    const value: unknown = 'active';
    
    if (guards.isValidStatus(value, validStatuses)) {
      expectType<'active' | 'inactive' | 'pending'>(value);
    }
  });
});

// Pagination guards
describe('Pagination Guards', () => {
  test('isPaginationParams narrows correctly', () => {
    const params: unknown = { page: 1, limit: 10 };
    
    if (guards.isPaginationParams(params)) {
      expectType<{ page: number; limit: number }>(params);
      expectType<number>(params.page);
      expectType<number>(params.limit);
    }
  });
});

// Assertion functions
describe('Assertion Functions', () => {
  test('assertDefined performs type assertion', () => {
    const value: string | null | undefined = 'test';
    guards.assertDefined(value);
    expectType<string>(value);
  });

  test('assertString performs type assertion', () => {
    const value: unknown = 'test';
    guards.assertString(value);
    expectType<string>(value);
  });

  test('assertNumber performs type assertion', () => {
    const value: unknown = 42;
    guards.assertNumber(value);
    expectType<number>(value);
  });

  test('assertObject performs type assertion', () => {
    const value: unknown = { key: 'value' };
    guards.assertObject(value);
    expectType<Record<string, unknown>>(value);
  });
});

// Union and intersection guards
describe('Composite Guards', () => {
  test('anyGuard creates union type predicate', () => {
    const stringOrNumber = guards.anyGuard(guards.isString, guards.isNumber);
    const value: unknown = 'test';
    
    if (stringOrNumber(value)) {
      expectType<string | number>(value);
    }
  });

  test('combineGuards creates intersection-like behavior', () => {
    const isUserLike = (obj: unknown): obj is { name: string } => {
      return guards.isObject(obj) && guards.hasProperty(obj, 'name') && guards.isString(obj.name);
    };
    
    const isWithAge = (obj: unknown): obj is { age: number } => {
      return guards.isObject(obj) && guards.hasProperty(obj, 'age') && guards.isNumber(obj.age);
    };

    const isFullUser = guards.combineGuards(isUserLike, isWithAge);
    const value: unknown = { name: 'John', age: 30 };
    
    if (isFullUser(value)) {
      expectType<{ name: string } & { age: number }>(value);
    }
  });
});

// Error cases - these should not compile
describe('Type Guard Error Cases', () => {
  test('cannot assign wrong types after guard checks', () => {
    const value: unknown = 'test';
    
    if (guards.isString(value)) {
      expectError(expectType<number>(value));
      expectError(expectType<boolean>(value));
    }
    
    if (guards.isNumber(value)) {
      expectError(expectType<string>(value));
    }
  });

  test('narrowed types maintain constraints', () => {
    const value: string | number = 'test';
    
    if (guards.isString(value)) {
      expectType<string>(value);
      expectError(expectType<number>(value));
    }
  });
});

// Generic type preservation
describe('Generic Type Preservation', () => {
  test('generic guards preserve original constraints', () => {
    function processValue<T extends { id: string }>(value: T | null): T | null {
      if (guards.isDefined(value)) {
        expectType<T>(value);
        return value;
      }
      return null;
    }

    const user = { id: '123', name: 'John' };
    const result = processValue(user);
    if (result) {
      expectType<typeof user>(result);
    }
  });
});

// Complex nested type narrowing
describe('Complex Type Narrowing', () => {
  test('nested object type narrowing', () => {
    interface ApiResponse {
      data?: {
        user?: {
          id: string;
          profile?: {
            name: string;
          };
        };
      };
    }

    const response: unknown = {
      data: {
        user: {
          id: '123',
          profile: {
            name: 'John'
          }
        }
      }
    };

    if (guards.isObject(response) &&
        guards.hasProperty(response, 'data') &&
        guards.isObject(response['data']) &&
        guards.hasProperty(response['data'], 'user') &&
        guards.isObject(response['data']['user']) &&
        guards.hasProperty(response['data']['user'], 'id') &&
        guards.isString(response['data']['user']['id'])) {
      
      expectType<string>(response['data']['user']['id']);
    }
  });
});