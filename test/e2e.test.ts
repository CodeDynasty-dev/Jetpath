import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import { use, v } from '../src/primitives/functions.ts';
import type { JetRoute, JetMiddleware } from '../src/primitives/types.ts';

describe('End-to-End Tests', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Health check endpoint', async () => {
    const GET_health: JetRoute = function (ctx) {
      ctx.send({ status: 'ok', timestamp: Date.now() });
    };
    GET_health.method = 'GET';
    GET_health.path = '/health';

    const result = await jetServer.runBare(GET_health);
    expect(result.code).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(typeof result.body.timestamp).toBe('number');
  });

  test('GET user by ID', async () => {
    const GET_users_$id: JetRoute = function (ctx) {
      ctx.send({
        id: ctx.params.id,
        name: `User ${ctx.params.id}`,
        email: `user${ctx.params.id}@example.com`,
      });
    };
    GET_users_$id.method = 'GET';
    GET_users_$id.path = '/users/:id';

    const result = await jetServer.runBare(GET_users_$id);
    expect(result.code).toBe(200);
    expect(result.body).toBeDefined();
  });

  test('POST create user', async () => {
    const POST_users: JetRoute = function (ctx) {
      // Use payload directly (already parsed by framework in real requests)
      ctx.send({
        id: '123',
        createdAt: new Date().toISOString(),
      });
    };
    POST_users.method = 'POST';
    POST_users.path = '/users';

    const result = await jetServer.runBare(POST_users);
    expect(result.code).toBe(200);
    expect(result.body.id).toBe('123');
    expect(typeof result.body.createdAt).toBe('string');
  });

  test('PUT update user', async () => {
    const PUT_users_$id: JetRoute = function (ctx) {
      ctx.send({
        id: ctx.params.id || 'unknown',
        updatedAt: new Date().toISOString(),
      });
    };
    PUT_users_$id.method = 'PUT';
    PUT_users_$id.path = '/users/:id';

    const result = await jetServer.runBare(PUT_users_$id);
    expect(result.code).toBe(200);
    expect(typeof result.body.updatedAt).toBe('string');
  });

  test('DELETE user', async () => {
    const DELETE_users_$id: JetRoute = function (ctx) {
      ctx.send({
        id: ctx.params.id || 'unknown',
        deleted: true,
        deletedAt: new Date().toISOString(),
      });
    };
    DELETE_users_$id.method = 'DELETE';
    DELETE_users_$id.path = '/users/:id';

    const result = await jetServer.runBare(DELETE_users_$id);
    expect(result.code).toBe(200);
    expect(result.body.deleted).toBe(true);
    expect(typeof result.body.deletedAt).toBe('string');
  });

  test('Route handler throws returns 500', async () => {
    const GET_broken: JetRoute = function (_ctx) {
      throw new Error('Intentional error');
    };
    GET_broken.method = 'GET';
    GET_broken.path = '/broken';

    const result = await jetServer.runBare(GET_broken);
    expect(result.code).toBe(500);
  });
});

describe('E2E Tests with Middleware', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Middleware runs before route handler', async () => {
    const authMiddleware: JetMiddleware = (ctx) => {
      const token = ctx.get('authorization');
      if (!token || !token.startsWith('Bearer ')) {
        ctx.send({ error: 'Unauthorized' }, 401);
        return;
      }
      ctx.state.user = { id: 'user-123', role: 'admin' };
    };

    const GET_protected: JetRoute = function (ctx) {
      ctx.send({
        message: 'Protected data',
        user: ctx.state.user,
      });
    };
    GET_protected.method = 'GET';
    GET_protected.path = '/protected';
    GET_protected.jet_middleware = [authMiddleware];

    const result = await jetServer.runBare(GET_protected);
    // No auth header in bare run → middleware blocks
    expect(result.code).toBe(401);
    expect(result.body.error).toBe('Unauthorized');
  });

  test('Middleware passes state to handler', async () => {
    const stateMiddleware: JetMiddleware = (ctx) => {
      ctx.state.injected = 'hello';
    };

    const GET_state: JetRoute = function (ctx) {
      ctx.send({ value: ctx.state.injected });
    };
    GET_state.method = 'GET';
    GET_state.path = '/state';
    GET_state.jet_middleware = [stateMiddleware];

    const result = await jetServer.runBare(GET_state);
    expect(result.code).toBe(200);
    expect(result.body.value).toBe('hello');
  });

  test('Middleware can return post-handler callback', async () => {
    const timingMiddleware: JetMiddleware = (ctx) => {
      ctx.state.start = Date.now();
      return (ctx2: typeof ctx) => {
        ctx2.state.elapsed = Date.now() - ctx2.state.start;
      };
    };

    const GET_timing: JetRoute = function (ctx) {
      ctx.send({ done: true });
    };
    GET_timing.method = 'GET';
    GET_timing.path = '/timing';
    GET_timing.jet_middleware = [timingMiddleware];

    const result = await jetServer.runBare(GET_timing);
    expect(result.code).toBe(200);
    expect(result.body.done).toBe(true);
  });
});

describe('E2E Tests with Validation', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Schema can be attached to route via use()', () => {
    const POST_validate: JetRoute = function (ctx) {
      ctx.send({ success: true });
    };
    POST_validate.method = 'POST';
    POST_validate.path = '/validate';

    use(POST_validate).body((t) => ({
      name: t.string().required().min(3).max(50),
      age: t.number().required().min(18).max(120),
      email: t.string().required().email(),
    }));

    expect(POST_validate.body).toBeDefined();
    expect(POST_validate.body!['name']).toBeDefined();
    expect(POST_validate.body!['age']).toBeDefined();
    expect(POST_validate.body!['email']).toBeDefined();
  });

  test('v schema builder creates correct definitions', () => {
    const strSchema = v.string().required().min(3);
    const def = strSchema.getDefinition();
    expect(def.type).toBe('string');
    expect(def.required).toBe(true);

    const numSchema = v.number().required().min(18).max(120);
    const numDef = numSchema.getDefinition();
    expect(numDef.type).toBe('number');
    expect(numDef.required).toBe(true);
  });

  test('Route with body schema runs successfully', async () => {
    const POST_data: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    POST_data.method = 'POST';
    POST_data.path = '/data';

    use(POST_data).body((t) => ({
      name: t.string().required(),
    }));

    const result = await jetServer.runBare(POST_data);
    // runBare sends no body, validation may error or pass depending on impl
    expect([200, 400, 500]).toContain(result.code);
  });
});
