import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Jetpath, JetServer, use } from '../src/index.ts';
import { v } from '../src/primitives/functions.ts';
import type { JetRoute } from '../src/primitives/types.ts';

// Test route definitions
const GET_test: JetRoute = function (ctx) {
  ctx.send({ message: 'Hello World' });
};

const GET_users_$id: JetRoute<{ params: { id: string } }> = function (ctx) {
  ctx.send({ userId: ctx.params.id, message: 'User found' });
};

const POST_users: JetRoute<{ body: { name: string; email: string } }> =
  async function (ctx) {
    const body = await ctx.parse();
    ctx.send({ ...body, id: '123', createdAt: new Date().toISOString() }, 201);
  };

const PUT_users_$id: JetRoute<{
  params: { id: string };
  body: { name: string; email: string };
}> = async function (ctx) {
  const body = await ctx.parse();
  ctx.send({ ...body, id: ctx.params.id, updatedAt: new Date().toISOString() });
};

const DELETE_users_$id: JetRoute<{ params: { id: string } }> = function (ctx) {
  ctx.send({ message: `User ${ctx.params.id} deleted` }, 204);
};

// Test route with validation - using the use() API properly
const POST_validate: JetRoute<{ body: { name: string; age: number } }> =
  async function (ctx) {
    const body = await ctx.parse();
    ctx.send({ ...body, validated: true });
  };

// Configure the route with use() API
use(POST_validate)
  .body((t) => ({
    name: t.string().required(),
    age: t.number().required().min(0),
  }))
  .title('Validation Test')
  .description('A test route with validation');

POST_validate.method = 'POST';
POST_validate.path = '/validate';

// Test route with response validation
const GET_validated_response: JetRoute<{
  response: { data: string; count: number };
}> = function (ctx) {
  ctx.send({ data: 'test', count: 42 });
};

use(GET_validated_response).response((t) => ({
  data: t.string().required(),
  count: t.number().required(),
}));

GET_validated_response.method = 'GET';
GET_validated_response.path = '/validated-response';

// Test middleware
const Middleware_auth = function (ctx: any) {
  ctx.state.user = { id: 'test-user', role: 'admin' };
  console.log('boohoo', ctx);
  return (ctx: any, error?: any) => {
    if (error) {
      console.log('Error in auth middleware:', error);
    }
  };
};

const GET_auth_protected: JetRoute = function (ctx) {
  ctx.send({ user: ctx.state.user, message: 'Protected route' });
};

// Test error handling
const GET_error: JetRoute = function (ctx) {
  throw new Error('Test error');
};

const GET_not_found: JetRoute = function (ctx) {
  ctx.code = 404;
  ctx.send({ error: 'Not found' });
};

// Test streaming
const GET_stream: JetRoute = function (ctx) {
  // Note: In a real test, we'd need to create a test file or mock stream
  ctx.send('Stream response would go here');
  // ctx.sendStream would be tested with actual file streaming
};

describe('Jetpath Framework', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  describe('Basic Routing', () => {
    test('GET request returns correct response', async () => {
      GET_test.method = 'GET';
      GET_test.path = '/test';

      const result = await jetServer.runBare(GET_test);

      expect(result.code).toBe(200);
      expect(result.body).toEqual({ message: 'Hello World' });
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    test('GET with path parameters', async () => {
      GET_users_$id.method = 'GET';
      GET_users_$id.path = '/users/:id';

      const mockCtx = jetServer.createCTX(
        new Request('http://localhost/users/123'),
        new Response(),
        '/users/123',
        GET_users_$id,
        { id: '123' }
      );

      const result = await jetServer.runWithCTX(GET_users_$id, mockCtx);

      expect(result.code).toBe(200);
      expect(result.body).toEqual({ userId: '123', message: 'User found' });
    });

    test('POST request with body parsing', async () => {
      POST_users.method = 'POST';
      POST_users.path = '/users';

      const mockRequest = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
      });

      const mockCtx = jetServer.createCTX(
        mockRequest,
        new Response(),
        '/users',
        POST_users,
        {}
      );

      const result = await jetServer.runWithCTX(POST_users, mockCtx);

      expect(result.code).toBe(201);
      expect(result.body).toHaveProperty('id');
      expect(result.body.name).toBe('John Doe');
      expect(result.body.email).toBe('john@example.com');
    });

    test('PUT request updates resource', async () => {
      PUT_users_$id.method = 'PUT';
      PUT_users_$id.path = '/users/:id';

      const mockRequest = new Request('http://localhost/users/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }),
      });

      const mockCtx = jetServer.createCTX(
        mockRequest,
        new Response(),
        '/users/456',
        PUT_users_$id,
        { id: '456' }
      );

      const result = await jetServer.runWithCTX(PUT_users_$id, mockCtx);

      expect(result.code).toBe(200);
      expect(result.body.id).toBe('456');
      expect(result.body.name).toBe('Jane Doe');
      expect(result.body.updatedAt).toBeDefined();
    });

    test('DELETE request removes resource', async () => {
      DELETE_users_$id.method = 'DELETE';
      DELETE_users_$id.path = '/users/:id';

      const mockCtx = jetServer.createCTX(
        new Request('http://localhost/users/789', { method: 'DELETE' }),
        new Response(),
        '/users/789',
        DELETE_users_$id,
        { id: '789' }
      );

      const result = await jetServer.runWithCTX(DELETE_users_$id, mockCtx);

      expect(result.code).toBe(204);
      expect(result.body).toEqual({ message: 'User 789 deleted' });
    });
  });

  describe('Validation', () => {
    test('Request validation passes with valid data', async () => {
      const mockRequest = new Request('http://localhost/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 25 }),
      });

      const mockCtx = jetServer.createCTX(
        mockRequest,
        new Response(),
        '/validate',
        POST_validate,
        {}
      );

      const result = await jetServer.runWithCTX(POST_validate, mockCtx);

      expect(result.code).toBe(200);
      expect(result.body.validated).toBe(true);
      expect(result.body.name).toBe('John');
      expect(result.body.age).toBe(25);
    });

    test('Request validation fails with invalid data', async () => {
      const mockRequest = new Request('http://localhost/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: -5 }), // Invalid: negative age
      });

      const mockCtx = jetServer.createCTX(
        mockRequest,
        new Response(),
        '/validate',
        POST_validate,
        {}
      );

      // The validator should throw an error for invalid data
      // This test expects the error to be caught and handled
      const result = await jetServer.runWithCTX(POST_validate, mockCtx);

      // The error should result in a 400 or 500 status code
      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    test('Response validation works correctly', async () => {
      GET_validated_response.method = 'GET';
      GET_validated_response.path = '/validated-response';

      const result = await jetServer.runBare(GET_validated_response);

      expect(result.code).toBe(200);
      expect(result.body.data).toBe('test');
      expect(result.body.count).toBe(42);
    });
  });

  describe('Middleware', () => {
    test('Middleware adds state to context', async () => {
      GET_auth_protected.method = 'GET';
      GET_auth_protected.path = '/auth/protected';
      GET_auth_protected.jet_middleware = [Middleware_auth];

      const result = await jetServer.runBare(GET_auth_protected);

      expect(result.code).toBe(200);
      expect(result.body.user).toEqual({ id: 'test-user', role: 'admin' });
      expect(result.body.message).toBe('Protected route');
    });
  });

  describe('Error Handling', () => {
    test('Route throwing error returns 500', async () => {
      GET_error.method = 'GET';
      GET_error.path = '/error';

      const result = await jetServer.runBare(GET_error);

      expect(result.code).toBe(500);
    });

    test('Custom 404 response', async () => {
      GET_not_found.method = 'GET';
      GET_not_found.path = '/not-found';

      const result = await jetServer.runBare(GET_not_found);

      expect(result.code).toBe(404);
      expect(result.body.error).toBe('Not found');
    });
  });

  describe('Context Methods', () => {
    test('Context.parse() returns parsed body', async () => {
      const testRoute: JetRoute<{ body: { test: string } }> = async function (
        ctx
      ) {
        const body = await ctx.parse();
        expect(body.test).toBe('parsed');
        ctx.send({ success: true });
      };

      testRoute.method = 'POST';
      testRoute.path = '/parse-test';

      const mockRequest = new Request('http://localhost/parse-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'parsed' }),
      });

      const mockCtx = jetServer.createCTX(
        mockRequest,
        new Response(),
        '/parse-test',
        testRoute,
        {}
      );

      const result = await jetServer.runWithCTX(testRoute, mockCtx);
      expect(result.code).toBe(200);
      expect(result.body.success).toBe(true);
    });

    test('Context.send() with custom status code', async () => {
      const testRoute: JetRoute = function (ctx) {
        ctx.send({ custom: 'response' }, 418); // I'm a teapot
      };

      testRoute.method = 'GET';
      testRoute.path = '/custom-status';

      const result = await jetServer.runBare(testRoute);

      expect(result.code).toBe(418);
      expect(result.body.custom).toBe('response');
    });

    test('Context.redirect() sets location header', async () => {
      const testRoute: JetRoute = function (ctx) {
        ctx.redirect('/new-location');
      };

      testRoute.method = 'GET';
      testRoute.path = '/redirect';

      const result = await jetServer.runBare(testRoute);

      expect(result.code).toBe(301);
      expect(result.headers['Location']).toBe('/new-location');
    });
  });

  describe('Schema Validation Helpers', () => {
    test('v.string() creates string schema', () => {
      const schema = v.string().required().min(3).max(100);
      expect(schema).toBeDefined();
      // The schema is a StringSchema instance
      expect(schema).toBeInstanceOf(Object);
      expect(typeof schema.required).toBe('function');
    });

    test('v.number() creates number schema', () => {
      const schema = v.number().required().min(0).max(100);
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Object);
    });

    test('v.object() creates object schema', () => {
      const schema = v.object({
        name: v.string().required(),
        age: v.number().required(),
      });
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Object);
    });

    test('v.array() creates array schema', () => {
      const schema = v.array(v.string());
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Object);
    });
  });

  describe('use() API', () => {
    test('use() chains validation methods', () => {
      const route: JetRoute<{ body: { name: string; age: number } }> =
        function (ctx) {
          ctx.send({ ok: true });
        };

      const configuredRoute = use(route)
        .body((t) => ({
          name: t.string().required().min(3),
          age: t.number().required().min(0),
        }))
        .title('Test Route')
        .description('A test route with validation');

      expect(configuredRoute).toBeDefined();
      expect(route.body).toBeDefined();
      expect(route.title).toBe('Test Route');
      expect(route.description).toBe('A test route with validation');
    });
  });
});
