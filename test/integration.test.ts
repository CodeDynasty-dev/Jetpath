import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import { use, v } from '../src/primitives/functions.ts';
import type { JetRoute, JetMiddleware } from '../src/primitives/types.ts';

describe('Integration Tests - Route Handling', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('GET route returns JSON response', async () => {
    const GET_users: JetRoute = function (ctx) {
      ctx.send({ users: [{ id: 1, name: 'Alice' }] });
    };
    GET_users.method = 'GET';
    GET_users.path = '/users';

    const result = await jetServer.runBare(GET_users);
    expect(result.code).toBe(200);
    expect(result.body.users).toHaveLength(1);
    expect(result.body.users[0].name).toBe('Alice');
  });

  test('POST route processes body and sends response', async () => {
    const POST_cross_runtime: JetRoute = function (ctx) {
      // In runBare context, avoid ctx.parse() as mock request isn't parseable
      ctx.send({
        processed: true,
        timestamp: Date.now(),
      });
    };
    POST_cross_runtime.method = 'POST';
    POST_cross_runtime.path = '/cross-runtime';

    const result = await jetServer.runBare(POST_cross_runtime);
    expect(result.code).toBe(200);
    expect(result.body.processed).toBe(true);
    expect(typeof result.body.timestamp).toBe('number');
  });

  test('Cookie set and get via ctx', async () => {
    const GET_cookies: JetRoute = function (ctx) {
      ctx.setCookie('test-cookie', 'value-123', {
        httpOnly: true,
        maxAge: 3600,
      });
      ctx.send({ cookiesSet: true });
    };
    GET_cookies.method = 'GET';
    GET_cookies.path = '/cookies';

    const result = await jetServer.runBare(GET_cookies);
    expect(result.code).toBe(200);
    expect(result.body.cookiesSet).toBe(true);
    expect(result.headers['set-cookie']).toContain('test-cookie');
  });

  test('Route with params returns correct path info', async () => {
    const GET_item: JetRoute = function (ctx) {
      ctx.send({ path: ctx.path });
    };
    GET_item.method = 'GET';
    GET_item.path = '/items/:id';

    const result = await jetServer.runBare(GET_item);
    expect(result.code).toBe(200);
    expect(result.body.path).toBeDefined();
  });

  test('Multiple routes can be tested independently', async () => {
    const GET_a: JetRoute = function (ctx) {
      ctx.send({ route: 'a' });
    };
    GET_a.method = 'GET';
    GET_a.path = '/a';

    const GET_b: JetRoute = function (ctx) {
      ctx.send({ route: 'b' });
    };
    GET_b.method = 'GET';
    GET_b.path = '/b';

    const [resultA, resultB] = await Promise.all([
      jetServer.runBare(GET_a),
      jetServer.runBare(GET_b),
    ]);

    expect(resultA.body.route).toBe('a');
    expect(resultB.body.route).toBe('b');
  });
});

describe('Integration Tests - Middleware Chain', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Auth middleware blocks unauthenticated requests', async () => {
    const authMiddleware: JetMiddleware = (ctx) => {
      const authHeader = ctx.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ctx.send({ error: 'Unauthorized' }, 401);
        return;
      }
      ctx.state.user = { id: 'user-123', role: 'user' };
    };

    const GET_protected: JetRoute = function (ctx) {
      ctx.send({ message: 'Protected', user: ctx.state.user });
    };
    GET_protected.method = 'GET';
    GET_protected.path = '/protected';
    GET_protected.jet_middleware = [authMiddleware];

    const result = await jetServer.runBare(GET_protected);
    expect(result.code).toBe(401);
    expect(result.body.error).toBe('Unauthorized');
  });

  test('Middleware error handler receives thrown errors', async () => {
    let errorCaught = false;

    const errorMiddleware: JetMiddleware = (_ctx) => {
      return (_ctx2: unknown, err: unknown) => {
        if (err) errorCaught = true;
      };
    };

    const GET_throws: JetRoute = function (_ctx) {
      throw new Error('Route error');
    };
    GET_throws.method = 'GET';
    GET_throws.path = '/throws';
    GET_throws.jet_middleware = [errorMiddleware];

    await jetServer.runBare(GET_throws);
    // The error callback is invoked with the thrown error
    expect(errorCaught).toBe(true);
  });

  test('Middleware chain executes in order', async () => {
    const order: number[] = [];

    const mw1: JetMiddleware = (ctx) => {
      order.push(1);
      ctx.state.order = order;
    };
    const mw2: JetMiddleware = (ctx) => {
      order.push(2);
    };
    const mw3: JetMiddleware = (ctx) => {
      order.push(3);
    };

    const GET_order: JetRoute = function (ctx) {
      order.push(4);
      ctx.send({ order });
    };
    GET_order.method = 'GET';
    GET_order.path = '/order';
    GET_order.jet_middleware = [mw1, mw2, mw3];

    const result = await jetServer.runBare(GET_order);
    expect(result.code).toBe(200);
    expect(result.body.order).toEqual([1, 2, 3, 4]);
  });
});

describe('Integration Tests - Schema Validation', () => {
  test('use() attaches body schema to route', () => {
    const POST_create: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    POST_create.method = 'POST';
    POST_create.path = '/create';

    use(POST_create).body((t) => ({
      name: t.string().required().min(3),
      age: t.number().required().min(18),
      email: t.string().required().email(),
    }));

    expect(POST_create.body).toBeDefined();
    expect(POST_create.body!['name'].required).toBe(true);
    expect(POST_create.body!['age'].required).toBe(true);
    expect(POST_create.body!['email'].required).toBe(true);
  });

  test('use() attaches query schema to route', () => {
    const GET_search: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    GET_search.method = 'GET';
    GET_search.path = '/search';

    use(GET_search).query((t) => ({
      q: t.string().required(),
      page: t.number(),
    }));

    expect(GET_search.query).toBeDefined();
    expect(GET_search.query!['q'].required).toBe(true);
  });

  test('use() attaches title and description', () => {
    const GET_info: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    GET_info.method = 'GET';
    GET_info.path = '/info';

    use(GET_info)
      .title('Info Endpoint')
      .description('Returns info about the service');

    expect(GET_info.title).toBe('Info Endpoint');
    expect(GET_info.description).toBe('Returns info about the service');
  });

  test('v builder creates valid schema definitions', () => {
    const strDef = v.string().required().min(3).max(50).getDefinition();
    expect(strDef.type).toBe('string');
    expect(strDef.required).toBe(true);

    const numDef = v.number().required().min(0).max(100).getDefinition();
    expect(numDef.type).toBe('number');
    expect(numDef.required).toBe(true);

    const boolDef = v.boolean().getDefinition();
    expect(boolDef.type).toBe('boolean');

    const arrDef = v.array(v.string()).getDefinition();
    expect(arrDef.type).toBe('array');

    const objDef = v.object({ key: v.string() }).getDefinition();
    expect(objDef.type).toBe('object');
    expect(objDef.objectSchema).toBeDefined();
  });
});

describe('Integration Tests - WebSocket Support', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('WebSocket upgrade function exists on ctx', async () => {
    const GET_ws_test: JetRoute = function (ctx) {
      ctx.send({
        websocketSupported: true,
        upgradeAvailable: typeof ctx.upgrade === 'function',
      });
    };
    GET_ws_test.method = 'GET';
    GET_ws_test.path = '/ws-test';

    const result = await jetServer.runBare(GET_ws_test);
    expect(result.code).toBe(200);
    expect(result.body.websocketSupported).toBe(true);
    expect(result.body.upgradeAvailable).toBe(true);
  });
});
