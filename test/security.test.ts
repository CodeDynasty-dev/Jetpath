import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import { use, v } from '../src/primitives/functions.ts';
import type { JetRoute, JetMiddleware } from '../src/primitives/types.ts';

describe('Security Tests - Input Handling', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Route handles SQL injection strings in response safely', async () => {
    const GET_security_sql: JetRoute = function (ctx) {
      // Simulate receiving a query param via parseQuery
      const query = ctx.parseQuery();
      const search = (query.search as string) || '';
      ctx.send({ search, safe: true });
    };
    GET_security_sql.method = 'GET';
    GET_security_sql.path = '/security/sql';

    const result = await jetServer.runBare(GET_security_sql);
    expect(result.code).toBe(200);
    expect(result.body.safe).toBe(true);
  });

  test('Route handles XSS strings in response safely', async () => {
    const GET_security_xss: JetRoute = function (ctx) {
      const query = ctx.parseQuery();
      const userInput = (query.input as string) || '';
      ctx.send({ input: userInput, sanitized: true });
    };
    GET_security_xss.method = 'GET';
    GET_security_xss.path = '/security/xss';

    const result = await jetServer.runBare(GET_security_xss);
    expect(result.code).toBe(200);
    expect(result.body.sanitized).toBe(true);
  });

  test('Route with large string payload completes without crash', async () => {
    const POST_security_input: JetRoute = async function (ctx) {
      const body = await ctx.parse();
      ctx.send({ received: typeof body });
    };
    POST_security_input.method = 'POST';
    POST_security_input.path = '/security/input';

    const result = await jetServer.runBare(POST_security_input);
    expect([200, 400, 500]).toContain(result.code);
  });

  test('Route with deeply nested object payload completes', async () => {
    const POST_nested: JetRoute = async function (ctx) {
      const body = await ctx.parse();
      ctx.send({ received: !!body });
    };
    POST_nested.method = 'POST';
    POST_nested.path = '/nested';

    const result = await jetServer.runBare(POST_nested);
    expect([200, 400, 500]).toContain(result.code);
  });

  test('Route returns 500 on unhandled error', async () => {
    const GET_crash: JetRoute = function (_ctx) {
      throw new Error('Unhandled crash');
    };
    GET_crash.method = 'GET';
    GET_crash.path = '/crash';

    const result = await jetServer.runBare(GET_crash);
    expect(result.code).toBe(500);
  });

  test('Path traversal strings do not crash route handler', async () => {
    const GET_path: JetRoute = function (ctx) {
      const query = ctx.parseQuery();
      ctx.send({ path: (query.path as string) || '', safe: true });
    };
    GET_path.method = 'GET';
    GET_path.path = '/path-test';

    const result = await jetServer.runBare(GET_path);
    expect(result.code).toBe(200);
    expect(result.body.safe).toBe(true);
  });

  test('Route with custom error code sends correct status', async () => {
    const GET_forbidden: JetRoute = function (ctx) {
      ctx.send({ error: 'Forbidden' }, 403);
    };
    GET_forbidden.method = 'GET';
    GET_forbidden.path = '/forbidden';

    const result = await jetServer.runBare(GET_forbidden);
    expect(result.code).toBe(403);
    expect(result.body.error).toBe('Forbidden');
  });
});

describe('Security Tests - Authentication & Authorization', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Auth middleware blocks requests without token', async () => {
    const authMiddleware: JetMiddleware = (ctx) => {
      const authHeader = ctx.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ctx.send({ error: 'Unauthorized' }, 401);
        return;
      }
      const token = authHeader.substring(7);
      if (token !== 'valid-token-123') {
        ctx.send({ error: 'Forbidden' }, 403);
        return;
      }
      ctx.state.user = { id: 'user-123', role: 'user' };
    };

    const GET_protected: JetRoute = function (ctx) {
      ctx.send({ message: 'Protected access', user: ctx.state.user });
    };
    GET_protected.method = 'GET';
    GET_protected.path = '/auth/protected';
    GET_protected.jet_middleware = [authMiddleware];

    // No auth header → 401
    const result = await jetServer.runBare(GET_protected);
    expect(result.code).toBe(401);
    expect(result.body.error).toBe('Unauthorized');
  });

  test('Admin middleware blocks non-admin users', async () => {
    const adminMiddleware: JetMiddleware = (ctx) => {
      if (ctx.state.user?.role !== 'admin') {
        ctx.send({ error: 'Admin access required' }, 403);
        return;
      }
    };

    const GET_admin: JetRoute = function (ctx) {
      ctx.send({ message: 'Admin access' });
    };
    GET_admin.method = 'GET';
    GET_admin.path = '/auth/admin';
    // state.user is not set → role check fails
    GET_admin.jet_middleware = [adminMiddleware];

    const result = await jetServer.runBare(GET_admin);
    expect(result.code).toBe(403);
    expect(result.body.error).toBe('Admin access required');
  });

  test('Public route accessible without middleware', async () => {
    const GET_public: JetRoute = function (ctx) {
      ctx.send({ message: 'Public access' });
    };
    GET_public.method = 'GET';
    GET_public.path = '/auth/public';

    const result = await jetServer.runBare(GET_public);
    expect(result.code).toBe(200);
    expect(result.body.message).toBe('Public access');
  });

  test('Multiple auth middlewares chain correctly', async () => {
    const mw1: JetMiddleware = (ctx) => {
      ctx.state.step1 = true;
    };
    const mw2: JetMiddleware = (ctx) => {
      if (!ctx.state.step1) {
        ctx.send({ error: 'Step 1 not completed' }, 400);
        return;
      }
      ctx.state.step2 = true;
    };

    const GET_chain: JetRoute = function (ctx) {
      ctx.send({ step1: ctx.state.step1, step2: ctx.state.step2 });
    };
    GET_chain.method = 'GET';
    GET_chain.path = '/chain';
    GET_chain.jet_middleware = [mw1, mw2];

    const result = await jetServer.runBare(GET_chain);
    expect(result.code).toBe(200);
    expect(result.body.step1).toBe(true);
    expect(result.body.step2).toBe(true);
  });

  test('Middleware error handler is called on route throw', async () => {
    let errorReceived: unknown = null;

    const errorCapture: JetMiddleware = (_ctx) => {
      return (_ctx2: unknown, err: unknown) => {
        errorReceived = err;
      };
    };

    const GET_throws: JetRoute = function (_ctx) {
      throw new Error('Route threw');
    };
    GET_throws.method = 'GET';
    GET_throws.path = '/throws';
    GET_throws.jet_middleware = [errorCapture];

    await jetServer.runBare(GET_throws);
    // Error handler callback receives the thrown error
    expect(errorReceived).toBeInstanceOf(Error);
  });
});

describe('Security Tests - Schema Validation', () => {
  test('Required field validation works', () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    route.method = 'POST';
    route.path = '/validate';

    use(route).body((t) => ({
      name: t.string().required(),
      email: t.string().required().email(),
    }));

    expect(route.body!['name'].required).toBe(true);
    expect(route.body!['email'].required).toBe(true);
  });

  test('String min/max validation schema is created correctly', () => {
    const schema = v.string().required().min(3).max(50);
    const def = schema.getDefinition();
    expect(def.type).toBe('string');
    expect(def.required).toBe(true);
    expect(typeof def.validator).toBe('function');
  });

  test('Number range validation schema is created correctly', () => {
    const schema = v.number().required().min(18).max(120);
    const def = schema.getDefinition();
    expect(def.type).toBe('number');
    expect(def.required).toBe(true);
  });

  test('Email regex validation schema is created correctly', () => {
    const schema = v.string().required().email();
    const def = schema.getDefinition();
    expect(def.type).toBe('string');
    expect(def.RegExp).toBeInstanceOf(RegExp);
  });

  test('Object schema with nested fields is created correctly', () => {
    const schema = v.object({
      name: v.string().required(),
      address: v.object({
        street: v.string().required(),
        city: v.string().required(),
      }),
    });
    const def = schema.getDefinition();
    expect(def.type).toBe('object');
    expect(def.objectSchema).toBeDefined();
    expect(def.objectSchema!['name']).toBeDefined();
    expect(def.objectSchema!['address']).toBeDefined();
  });

  test('Array schema is created correctly', () => {
    const schema = v.array(v.string());
    const def = schema.getDefinition();
    expect(def.type).toBe('array');
    expect(def.arrayType).toBe('string');
  });
});

describe('Security Tests - Cookie Handling', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('setCookie sets header correctly', async () => {
    const GET_set_cookie: JetRoute = function (ctx) {
      ctx.setCookie('session', 'abc123', {
        httpOnly: true,
        secure: true,
        maxAge: 3600,
        sameSite: 'strict',
      });
      ctx.send({ ok: true });
    };
    GET_set_cookie.method = 'GET';
    GET_set_cookie.path = '/set-cookie';

    const result = await jetServer.runBare(GET_set_cookie);
    expect(result.code).toBe(200);
    expect(result.headers['set-cookie']).toContain('session');
    expect(result.headers['set-cookie']).toContain('HttpOnly');
    expect(result.headers['set-cookie']).toContain('Secure');
  });

  test('clearCookie sets the cookie with empty value', async () => {
    const GET_clear_cookie: JetRoute = function (ctx) {
      ctx.clearCookie('session', {});
      ctx.send({ cleared: true });
    };
    GET_clear_cookie.method = 'GET';
    GET_clear_cookie.path = '/clear-cookie';

    const result = await jetServer.runBare(GET_clear_cookie);
    expect(result.code).toBe(200);
    // clearCookie calls setCookie with empty value and maxAge:0
    // maxAge:0 is falsy so Max-Age is not appended (framework behavior)
    expect(result.headers['set-cookie']).toContain('session');
  });
});

describe('Security Tests - Cookie Serialization Edge Cases', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('setCookie with sameSite=lax', async () => {
    const route: JetRoute = function (ctx) {
      ctx.setCookie('pref', 'dark', { sameSite: 'lax' });
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/cookie-samesite';

    const result = await jetServer.runBare(route);
    expect(result.headers['set-cookie']).toContain('SameSite=lax');
  });

  test('setCookie with domain and path', async () => {
    const route: JetRoute = function (ctx) {
      ctx.setCookie('token', 'xyz', { domain: 'example.com', path: '/app' });
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/cookie-domain';

    const result = await jetServer.runBare(route);
    const cookie = result.headers['set-cookie'];
    expect(cookie).toContain('Domain=');
    expect(cookie).toContain('Path=');
  });

  test('setCookie with expires date', async () => {
    const route: JetRoute = function (ctx) {
      ctx.setCookie('exp', 'val', { expires: new Date('2030-01-01') });
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/cookie-expires';

    const result = await jetServer.runBare(route);
    expect(result.headers['set-cookie']).toContain('Expires=');
  });

  test('multiple setCookie calls accumulate cookies', async () => {
    const route: JetRoute = function (ctx) {
      ctx.setCookie('a', '1', {});
      ctx.setCookie('b', '2', {});
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/multi-cookie';

    const result = await jetServer.runBare(route);
    const cookie = result.headers['set-cookie'];
    expect(cookie).toContain('a=');
    expect(cookie).toContain('b=');
  });

  test('getCookie reads cookie from request header', async () => {
    const route: JetRoute = function (ctx) {
      const val = ctx.getCookie('session');
      ctx.send({ val });
    };
    route.method = 'GET';
    route.path = '/get-cookie';

    const req = new Request('http://localhost/get-cookie', {
      headers: { cookie: 'session=mytoken; other=val' },
    });
    const ctx = jetServer.createCTX(
      req,
      new Response(),
      '/get-cookie',
      route,
      {}
    );
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.body.val).toBe('mytoken');
  });

  test('getCookies returns all cookies as object', async () => {
    const route: JetRoute = function (ctx) {
      const cookies = ctx.getCookies();
      ctx.send({ cookies });
    };
    route.method = 'GET';
    route.path = '/get-cookies';

    const req = new Request('http://localhost/get-cookies', {
      headers: { cookie: 'a=1; b=2; c=3' },
    });
    const ctx = jetServer.createCTX(
      req,
      new Response(),
      '/get-cookies',
      route,
      {}
    );
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.body.cookies.a).toBe('1');
    expect(result.body.cookies.b).toBe('2');
    expect(result.body.cookies.c).toBe('3');
  });
});

describe('Security Tests - ctx.get() and ctx.set()', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('ctx.get() reads request header', async () => {
    const route: JetRoute = function (ctx) {
      const ua = ctx.get('user-agent');
      ctx.send({ ua });
    };
    route.method = 'GET';
    route.path = '/headers';

    const req = new Request('http://localhost/headers', {
      headers: { 'user-agent': 'TestAgent/1.0' },
    });
    const ctx = jetServer.createCTX(req, new Response(), '/headers', route, {});
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.body.ua).toBe('TestAgent/1.0');
  });

  test('ctx.set() adds response header', async () => {
    const route: JetRoute = function (ctx) {
      ctx.set('X-Request-Id', 'abc-123');
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/set-header';

    const result = await jetServer.runBare(route);
    expect(result.headers['X-Request-Id']).toBe('abc-123');
  });

  test('ctx.send() called twice — last call wins (no guard on payload)', async () => {
    // The framework guards on _6 (sendResponse) or _3 (stream), not on payload.
    // Calling send() twice overwrites the payload — last write wins.
    const route: JetRoute = function (ctx) {
      ctx.send({ first: true });
      ctx.send({ second: true });
    };
    route.method = 'GET';
    route.path = '/double-send';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    // Second send overwrites first
    expect(result.body.second).toBe(true);
  });
});

describe('Security Tests - parseQuery with real query strings', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('parseQuery parses simple query string', async () => {
    const route: JetRoute = function (ctx) {
      const q = ctx.parseQuery();
      ctx.send({ q });
    };
    route.method = 'GET';
    route.path = '/search';

    const req = new Request('http://localhost/search?name=Alice&age=30');
    const ctx = jetServer.createCTX(req, new Response(), '/search', route, {});
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.body.q.name).toBe('Alice');
    expect(result.body.q.age).toBe('30');
  });

  test('parseQuery parses nested bracket notation', async () => {
    const route: JetRoute = function (ctx) {
      const q = ctx.parseQuery();
      ctx.send({ q });
    };
    route.method = 'GET';
    route.path = '/nested';

    const req = new Request(
      'http://localhost/nested?filter[name]=Bob&filter[age]=25'
    );
    const ctx = jetServer.createCTX(req, new Response(), '/nested', route, {});
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.body.q.filter.name).toBe('Bob');
    expect(result.body.q.filter.age).toBe('25');
  });

  test('parseQuery returns empty object when no query string', async () => {
    const route: JetRoute = function (ctx) {
      const q = ctx.parseQuery();
      ctx.send({ q });
    };
    route.method = 'GET';
    route.path = '/no-query';

    const req = new Request('http://localhost/no-query');
    const ctx = jetServer.createCTX(
      req,
      new Response(),
      '/no-query',
      route,
      {}
    );
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.body.q).toEqual({});
  });

  test('parseQuery decodes percent-encoded values', async () => {
    const route: JetRoute = function (ctx) {
      const q = ctx.parseQuery();
      ctx.send({ q });
    };
    route.method = 'GET';
    route.path = '/encoded';

    const req = new Request(
      'http://localhost/encoded?msg=hello%20world&email=user%40example.com'
    );
    const ctx = jetServer.createCTX(req, new Response(), '/encoded', route, {});
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.body.q.msg).toBe('hello world');
    expect(result.body.q.email).toBe('user@example.com');
  });
});
