import { describe, test, expect, beforeEach } from 'bun:test';
import { validator } from '../src/primitives/validator.ts';
import { JetServer, use } from '../src/index.ts';
import type { JetRoute } from '../src/primitives/types.ts';

describe('Validation System', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('validator function validates simple schema', () => {
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
    };

    const validData = { name: 'John', age: 25 };
    const result = validator(schema, validData);

    expect(result.name).toBe('John');
    expect(result.age).toBe(25);
  });

  test('validator throws error for invalid data', () => {
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
    };

    const invalidData = { name: 'John' }; // Missing age

    expect(() => validator(schema, invalidData)).toThrow();
  });

  test('validator handles nested objects', () => {
    const schema = {
      user: {
        type: 'object',
        required: true,
        objectSchema: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
        },
      },
    };

    const validData = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    };

    const result = validator(schema, validData);
    expect(result.user.name).toBe('John Doe');
    expect(result.user.email).toBe('john@example.com');
  });

  test('validator handles arrays', () => {
    const schema = {
      tags: {
        type: 'array',
        required: true,
        arrayType: 'string',
      },
    };

    const validData = {
      tags: ['javascript', 'typescript', 'nodejs'],
    };

    const result = validator(schema, validData);
    expect(result.tags).toEqual(['javascript', 'typescript', 'nodejs']);
  });

  test('validator respects depth limit for recursion protection', () => {
    // Create deeply nested schema
    let deepSchema: any = {};
    let current = deepSchema;

    // Create 30 levels of nesting (exceeds default 20 limit)
    for (let i = 0; i < 30; i++) {
      current.nested = {
        type: 'object',
        required: true,
        objectSchema: {},
      };
      current = current.nested.objectSchema;
    }

    const deepData: any = {};
    let currentData = deepData;
    for (let i = 0; i < 30; i++) {
      currentData.nested = {};
      currentData = currentData.nested;
    }

    // Should throw due to depth limit
    expect(() => validator(deepSchema, deepData, 0, 20)).toThrow(
      'Maximum validation depth'
    );
  });

  test('Route with validation via use() API', async () => {
    const route: JetRoute<{ body: { email: string; password: string } }> =
      async function (ctx) {
        const body = await ctx.parse();
        ctx.send({ email: body.email, authenticated: true });
      };

    // Configure validation
    use(route).body((t) => ({
      email: t.string().required().email(),
      password: t.string().required().min(8),
    }));

    route.method = 'POST';
    route.path = '/login';

    // Test with valid data
    const mockRequest = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    const mockCtx = jetServer.createCTX(
      mockRequest,
      new Response(),
      '/login',
      route,
      {}
    );

    const result = await jetServer.runWithCTX(route, mockCtx);
    expect(result.code).toBe(200);
    expect(result.body.authenticated).toBe(true);
  });

  test('Custom validator functions work', () => {
    const schema = {
      age: {
        type: 'number',
        required: true,
        validator: (value: number) => {
          if (value < 0) return 'Age cannot be negative';
          if (value > 150) return 'Age seems unrealistic';
          return true;
        },
      },
    };

    // Valid age
    expect(() => validator(schema, { age: 25 })).not.toThrow();

    // Invalid age (negative)
    expect(() => validator(schema, { age: -5 })).toThrow(
      'Age cannot be negative'
    );

    // Invalid age (too high)
    expect(() => validator(schema, { age: 200 })).toThrow(
      'Age seems unrealistic'
    );
  });
});
