/**
 * Type-level tests for generic utilities
 */

import { expectType, expectAssignable, expectNotAssignable } from 'tsd';

import {
  NonEmptyArray,
  Prettify,
  DeepReadonly,
  Result,
  success,
  failure,
  isSuccess,
  isFailure,
  Builder,
  TypedEventEmitter,
  chunk,
  groupBy,
  mapToObject,
  unique,
  partition,
  pick,
  omit,
  mapValues,
  mapKeys
} from '../../utils/generics';

// Utility types
describe('Utility Types', () => {
  test('NonEmptyArray ensures at least one element', () => {
    const empty: string[] = [];
    const nonEmpty: NonEmptyArray<string> = ['first'];
    const multipleElements: NonEmptyArray<string> = ['first', 'second'];

    expectType<NonEmptyArray<string>>(nonEmpty);
    expectType<NonEmptyArray<string>>(multipleElements);
    expectNotAssignable<NonEmptyArray<string>>(empty);

    // First element is guaranteed to exist
    expectType<string>(nonEmpty[0]);
  });

  test('Prettify flattens intersection types', () => {
    interface A {
      a: string;
    }
    interface B {
      b: number;
    }

    type Intersection = A & B;
    type Prettified = Prettify<A & B>;

    const obj: Prettified = { a: 'test', b: 42 };
    expectType<Prettified>(obj);
    expectType<string>(obj.a);
    expectType<number>(obj.b);
  });

  test('DeepReadonly makes nested properties readonly', () => {
    interface MutableObj {
      name: string;
      nested: {
        value: number;
        array: string[];
      };
    }

    type ReadonlyObj = DeepReadonly<MutableObj>;

    const obj: ReadonlyObj = {
      name: 'test',
      nested: {
        value: 42,
        array: ['a', 'b']
      }
    };

    expectType<string>(obj.name);
    expectType<number>(obj.nested.value);
    expectType<readonly string[]>(obj.nested.array);

    // These should cause compilation errors
    expectError(obj.name = 'new name');
    expectError(obj.nested.value = 100);
    expectError(obj.nested.array.push('c'));
  });
});

// Result type
describe('Result Type', () => {
  test('success creates success result', () => {
    const result = success('data');
    expectType<Result<string, never>>(result);
    expectType<true>(result.success);
    expectType<string>(result.data);
  });

  test('failure creates failure result', () => {
    const result = failure(new Error('failed'));
    expectType<Result<never, Error>>(result);
    expectType<false>(result.success);
    expectType<Error>(result.error);
  });

  test('isSuccess narrows to success type', () => {
    const result: Result<string, Error> = success('data');

    if (isSuccess(result)) {
      expectType<{ success: true; data: string }>(result);
      expectType<string>(result.data);
      expectNotAssignable<{ success: false; error: Error }>(result);
    }
  });

  test('isFailure narrows to failure type', () => {
    const result: Result<string, Error> = failure(new Error('failed'));

    if (isFailure(result)) {
      expectType<{ success: false; error: Error }>(result);
      expectType<Error>(result.error);
      expectNotAssignable<{ success: true; data: string }>(result);
    }
  });
});

// Builder pattern
describe('Builder Pattern', () => {
  test('Builder maintains type safety', () => {
    interface Config {
      name: string;
      port: number;
      enabled: boolean;
    }

    const builder = new Builder<Config>();
    const result = builder
      .set('name', 'test')
      .set('port', 3000)
      .set('enabled', true)
      .build();

    expectType<Config>(result);
    expectType<string>(result.name);
    expectType<number>(result.port);
    expectType<boolean>(result.enabled);
  });

  test('Builder set method enforces correct types', () => {
    interface User {
      id: string;
      age: number;
    }

    const builder = new Builder<User>();
    
    // These should work
    builder.set('id', '123');
    builder.set('age', 30);

    // Test invalid type assignments
    // @ts-expect-error id should be string
    builder.set('id', 123 as any);
    
    // @ts-expect-error age should be number
    builder.set('age', '30' as any);
    
    // @ts-expect-error invalid key
    builder.set('invalid' as any, 'value');
  });

  test('buildWith merges with defaults', () => {
    interface Settings {
      theme: 'light' | 'dark';
      fontSize: number;
      autoSave: boolean;
    }

    const defaults: Settings = {
      theme: 'light',
      fontSize: 14,
      autoSave: true
    };

    const builder = new Builder<Settings>();
    const result = builder
      .set('theme', 'dark')
      .buildWith(defaults);

    expectType<Settings>(result);
    expectType<'light' | 'dark'>(result.theme);
  });
});

// TypedEventEmitter
describe('TypedEventEmitter', () => {
  test('event emitter with typed events', () => {
    type Events = {
      userCreated: [string, { name: string; email: string }];
      userDeleted: [string];
      error: [Error];
    } & Record<string, unknown[]>;

    const emitter = new TypedEventEmitter<Events>();

    // These should work
    emitter.on('userCreated', (id, user) => {
      expectType<string>(id);
      expectType<{ name: string; email: string }>(user);
    });

    emitter.on('userDeleted', (id) => {
      expectType<string>(id);
    });

    emitter.on('error', (err) => {
      expectType<Error>(err);
    });

    // Test invalid event names and handlers
    // @ts-expect-error Invalid event name
    emitter.on('invalidEvent' as any, () => {});
    
    // @ts-expect-error Wrong parameter type
    emitter.on('userCreated', (wrongType: number) => {});
  });

  test('emit enforces correct argument types', () => {
    type Events = {
      test: [string, number];
    } & Record<string, unknown[]>;

    const emitter = new TypedEventEmitter<Events>();

    // This should work
    emitter.emit('test', 'hello', 42);

    // Test invalid emit calls
    // @ts-expect-error Missing number argument
    emitter.emit('test', 'hello');
    
    // @ts-expect-error Wrong type for second argument
    emitter.emit('test', 'hello', '42' as any);
    
    // @ts-expect-error Wrong type for first argument
    emitter.emit('test', 123 as any, 42);
  });
});

// Array utilities
describe('Array Utilities', () => {
  test('chunk preserves element type', () => {
    const numbers = [1, 2, 3, 4, 5];
    const chunks = chunk(numbers, 2);

    expectType<number[][]>(chunks);
    if (chunks[0]) {
      expectType<number[]>(chunks[0]);
      if (chunks[0][0] !== undefined) {
        expectType<number>(chunks[0][0]);
      }
    }
  });

  test('groupBy with proper key and value types', () => {
    interface Person {
      name: string;
      age: number;
      department: 'engineering' | 'sales' | 'marketing';
    }

    const people: Person[] = [
      { name: 'John', age: 30, department: 'engineering' },
      { name: 'Jane', age: 25, department: 'sales' }
    ];

    const grouped = groupBy(people, p => p.department);

    expectType<Record<'engineering' | 'sales' | 'marketing', Person[]>>(grouped);
    expectType<Person[]>(grouped.engineering);
    expectType<Person | undefined>(grouped.engineering?.[0]);
  });

  test('mapToObject transforms array to object with correct types', () => {
    interface User {
      id: string;
      name: string;
    }

    const users: User[] = [
      { id: '1', name: 'John' },
      { id: '2', name: 'Jane' }
    ];

    const userMap = mapToObject(users, (u: User) => u.id, (u: User) => u.name);

    expectType<Record<string, string>>(userMap);
    expectType<string>(userMap['1']);
  });

  test('unique with and without key selector', () => {
    const numbers = [1, 2, 2, 3, 1];
    const uniqueNumbers = unique(numbers);

    expectType<number[]>(uniqueNumbers);

    interface Item {
      id: string;
      value: number;
    }

    const items: Item[] = [
      { id: '1', value: 10 },
      { id: '2', value: 20 },
      { id: '1', value: 30 }
    ];

    const uniqueItems = unique(items, (item: Item) => item.id);
    expectType<Item[]>(uniqueItems);
  });

  test('partition splits array maintaining types', () => {
    const numbers = [1, 2, 3, 4, 5];
    const [evens, odds] = partition(numbers, (n: number) => n % 2 === 0);

    expectType<number[]>(evens);
    expectType<number[]>(odds);
  });
});

// Object utilities
describe('Object Utilities', () => {
  test('pick selects specific properties', () => {
    interface User {
      id: string;
      name: string;
      email: string;
      age: number;
    }

    const user: User = {
      id: '1',
      name: 'John',
      email: 'john@example.com',
      age: 30
    };

    const picked = pick(user, 'id', 'name');

    expectType<Pick<User, 'id' | 'name'>>(picked);
    expectType<string>(picked.id);
    expectType<string>(picked.name);
    // @ts-expect-error email should not exist
    const _email = (picked as any).email;
    // @ts-expect-error age should not exist
    const _age = (picked as any).age;
  });

  test('omit excludes specific properties', () => {
    interface User {
      id: string;
      name: string;
      email: string;
      password: string;
    }

    const user: User = {
      id: '1',
      name: 'John',
      email: 'john@example.com',
      password: 'secret'
    };

    const publicUser = omit(user, 'password');

    expectType<Omit<User, 'password'>>(publicUser);
    expectType<string>(publicUser.id);
    expectType<string>(publicUser.name);
    expectType<string>(publicUser.email);
    // @ts-expect-error password should not exist
    const _password = (publicUser as any).password;
  });

  test('mapValues transforms object values', () => {
    const numbers = { a: 1, b: 2, c: 3 };
    const strings = mapValues(numbers, (value: number, key: string) => {
      expectType<number>(value);
      expectType<string>(key);
      return value.toString();
    });

    expectType<Record<string, string>>(strings);
    expectType<string>(strings['a']);
  });

  test('mapKeys transforms object keys', () => {
    const obj = { firstName: 'John', lastName: 'Doe' };
    const snakeCase = mapKeys(obj, (key: string, value: string) => {
      expectType<string>(key);
      expectType<string>(value);
      return key.replace(/([A-Z])/g, '_$1').toLowerCase();
    });

    expectType<Record<string, string>>(snakeCase);
  });
});

// Generic constraint testing
describe('Generic Constraints', () => {
  test('function with generic constraint', () => {
    function processEntity<T extends { id: string }>(entity: T): T & { processed: boolean } {
      return { ...entity, processed: true };
    }

    const user = { id: '123', name: 'John' };
    const result = processEntity(user);

    expectType<typeof user & { processed: boolean }>(result);
    expectType<string>(result.id);
    expectType<string>(result.name);
    expectType<boolean>(result.processed);

    // Test missing required property
    // Missing id property should cause error
    // @ts-expect-error
    processEntity({ name: 'John' });
  });

  test('conditional types based on generic parameters', () => {
    type ApiResult<T> = T extends string 
      ? { message: T }
      : T extends number
      ? { count: T }
      : { data: T };

    function createResult<T>(value: T): ApiResult<T> {
      if (typeof value === 'string') {
        return { message: value } as ApiResult<T>;
      }
      if (typeof value === 'number') {
        return { count: value } as ApiResult<T>;
      }
      return { data: value } as ApiResult<T>;
    }

    const stringResult = createResult('hello');
    expectType<{ message: string }>(stringResult);

    const numberResult = createResult(42);
    expectType<{ count: number }>(numberResult);

    const objectResult = createResult({ id: '123' });
    expectType<{ data: { id: string } }>(objectResult);
  });
});