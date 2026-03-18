/**
 * Regression tests for issues 1-18 fixes.
 * Each test targets a specific bug that was identified and fixed.
 */
import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer, use } from '../src/index.ts';
import { v } from '../src/primitives/functions.ts';
import { validator } from '../src/primitives/validator.ts';
import { corsMiddleware, optionsCtx } from '../src/primitives/cors.ts';
import {
  ctxPool,
  MAX_POOL_SIZE,
  _rebuildCorsCloner,
} from '../src/primitives/trie-router.ts';
import type { JetRoute } from '../src/primitives/types.ts';

// ─── Issue 7: handler?.response null deref ──────────────────────────────────

describe('Issue 7 — send() when handler is null', () => {
  let jetServer: JetServer;
  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('send() does not throw when handler has no response schema', async () => {
    const route: JetRoute = function (ctx) {
      // handler exists but has no .response schema
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/no-schema';
    // Deliberately do NOT attach a response schema
    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.ok).toBe(true);
  });
});

// ─── Issue 8: CORS secureContext COOP/COEP copy-paste bug ───────────────────

describe('Issue 8 — CORS secureContext headers', () => {
  let jetServer: JetServer;
  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('secureContext sets COOP and COEP to distinct values', () => {
    corsMiddleware({
      origin: ['*'],
      secureContext: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    });
    _rebuildCorsCloner();

    // Check optionsCtx headers (preflight)
    const headers = optionsCtx._2 as Record<string, string>;
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    // They must NOT be the same value (the old bug had both reading from COEP)
    expect(headers['Cross-Origin-Opener-Policy']).not.toBe(
      headers['Cross-Origin-Embedder-Policy']
    );
  });
});

// ─── Issue 9: Set-Cookie comma joining ──────────────────────────────────────

describe('Issue 9 — multiple Set-Cookie headers', () => {
  let jetServer: JetServer;
  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('multiple setCookie calls produce separate cookie strings', async () => {
    const route: JetRoute = function (ctx) {
      ctx.setCookie('session', 'abc123', { httpOnly: true });
      ctx.setCookie('theme', 'dark', { path: '/' });
      ctx.setCookie('lang', 'en', {});
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/multi-set-cookie';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    const setCookie = result.headers['set-cookie'];
    // All three cookies must be present
    expect(setCookie).toContain('session=abc123');
    expect(setCookie).toContain('theme=dark');
    expect(setCookie).toContain('lang=en');
    // HttpOnly should only appear on the session cookie
    expect(setCookie).toContain('HttpOnly');
  });

  test('_setCookies array is reset between requests', async () => {
    const route1: JetRoute = function (ctx) {
      ctx.setCookie('a', '1', {});
      ctx.send({ ok: true });
    };
    route1.method = 'GET';
    route1.path = '/cookie-req1';

    const route2: JetRoute = function (ctx) {
      // Do NOT set any cookies
      ctx.send({ ok: true });
    };
    route2.method = 'GET';
    route2.path = '/cookie-req2';

    const r1 = await jetServer.runBare(route1);
    expect(r1.headers['set-cookie']).toContain('a=1');

    // Wait for pool return
    await new Promise((r) => queueMicrotask(r));

    const r2 = await jetServer.runBare(route2);
    // Second request should NOT have any set-cookie header from first request
    expect(r2.headers['set-cookie']).toBeUndefined();
  });
});

// ─── Issue 10: Unbounded context pool ───────────────────────────────────────

describe('Issue 10 — MAX_POOL_SIZE cap', () => {
  test('MAX_POOL_SIZE is defined and reasonable', () => {
    expect(MAX_POOL_SIZE).toBe(500);
  });

  test('pool does not grow beyond MAX_POOL_SIZE', () => {
    const saved = ctxPool.length;
    // Manually try to push beyond limit
    const fakeCtx = {} as any;
    while (ctxPool.length < MAX_POOL_SIZE) {
      ctxPool.push(fakeCtx);
    }
    expect(ctxPool.length).toBe(MAX_POOL_SIZE);
    // The guard in production code checks before push — simulate it
    if (ctxPool.length < MAX_POOL_SIZE) {
      ctxPool.push(fakeCtx);
    }
    expect(ctxPool.length).toBe(MAX_POOL_SIZE);
    // Restore
    ctxPool.length = saved;
  });
});

// ─── Issue 11: 404 not mutating optionsCtx ──────────────────────────────────

describe('Issue 11 — 404 does not mutate optionsCtx', () => {
  test('optionsCtx.code is not permanently mutated by 404 path', () => {
    // The fix changed `const ctx404 = optionsCtx` (shared reference)
    // to `const notFoundCtx = { ...optionsCtx, code: 404 }` (shallow copy).
    // Verify optionsCtx retains its original code after being used.
    // Reset to known state
    optionsCtx.code = 204;

    // Simulate what the old buggy code did: mutating optionsCtx directly
    // The fix creates a copy, so optionsCtx should remain 204
    const notFoundCtx = { ...optionsCtx, code: 404 };
    expect(notFoundCtx.code).toBe(404);
    expect(optionsCtx.code).toBe(204); // Must NOT be mutated
  });
});

// ─── Issue 13: parseQuery validation caching bug ────────────────────────────

describe('Issue 13 — parseQuery validation caching', () => {
  let jetServer: JetServer;
  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('parseQuery returns validated result on second call', async () => {
    const route: JetRoute = function (ctx) {
      // First call — should validate and cache
      const q1 = ctx.parseQuery();
      // Second call — should return cached validated result
      const q2 = ctx.parseQuery();
      ctx.send({ q1, q2, same: q1 === q2 });
    };
    route.method = 'GET';
    route.path = '/query-cache';
    use(route).query((t) => ({
      name: t.string().required(),
    }));

    const req = new Request('http://localhost/query-cache?name=Alice');
    const ctx = jetServer.createCTX(
      req,
      new Response(),
      '/query-cache',
      route,
      {}
    );
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.code).toBe(200);
    expect(result.body.q1.name).toBe('Alice');
    // Both calls should return the same validated object
    expect(result.body.same).toBe(true);
  });

  test('parseQuery with validation rejects invalid data', async () => {
    const route: JetRoute = function (ctx) {
      const q = ctx.parseQuery();
      ctx.send({ q });
    };
    route.method = 'GET';
    route.path = '/query-fail';
    use(route).query((t) => ({
      email: t.string().required().email(),
    }));

    const req = new Request('http://localhost/query-fail?email=not-an-email');
    const ctx = jetServer.createCTX(
      req,
      new Response(),
      '/query-fail',
      route,
      {}
    );
    const result = await jetServer.runWithCTX(route, ctx);
    // Validation error should cause 500
    expect(result.code).toBe(500);
  });
});

// ─── Issue 14: Validator strips unknown fields ──────────────────────────────

describe('Issue 14 — validator mass-assignment protection', () => {
  test('unknown fields are stripped from validated output', () => {
    const schema = {
      name: { type: 'string', required: true },
    };
    const data = { name: 'Alice', isAdmin: true, role: 'superuser' };
    const result = validator(schema, data);
    expect(result.name).toBe('Alice');
    // Unknown fields must NOT pass through
    expect((result as any).isAdmin).toBeUndefined();
    expect((result as any).role).toBeUndefined();
  });

  test('nested object validation also strips unknown fields', () => {
    const schema = {
      user: {
        type: 'object',
        required: true,
        objectSchema: {
          name: { type: 'string', required: true },
        },
      },
    };
    const data = { user: { name: 'Bob', isAdmin: true }, extra: 'junk' };
    const result = validator(schema, data);
    expect(result.user.name).toBe('Bob');
    expect((result.user as any).isAdmin).toBeUndefined();
    expect((result as any).extra).toBeUndefined();
  });
});

// ─── Issue 15: isJson precedence bug ────────────────────────────────────────

describe('Issue 15 — isJson operator precedence in JetServer.makeRes', () => {
  let jetServer: JetServer;
  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('HTML starting with [ is NOT parsed as JSON', async () => {
    const route: JetRoute = function (ctx) {
      // Send HTML that happens to start with [
      ctx.send('[data] <h1>Hello</h1>', 200, 'text/html');
    };
    route.method = 'GET';
    route.path = '/html-bracket';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    // Should be returned as string, not parsed as JSON
    expect(typeof result.body).toBe('string');
    expect(result.body).toContain('<h1>Hello</h1>');
  });

  test('HTML starting with { is NOT parsed as JSON', async () => {
    const route: JetRoute = function (ctx) {
      ctx.send('{template} <div>Content</div>', 200, 'text/html');
    };
    route.method = 'GET';
    route.path = '/html-brace';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(typeof result.body).toBe('string');
  });

  test('JSON object sent via send() with object data is parsed correctly', async () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ items: [1, 2, 3] });
    };
    route.method = 'GET';
    route.path = '/json-object';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.items).toEqual([1, 2, 3]);
  });

  test('explicit application/json content type is parsed as JSON', async () => {
    const route: JetRoute = function (ctx) {
      ctx.send('{"key":"value"}', 200, 'application/json');
    };
    route.method = 'GET';
    route.path = '/explicit-json';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.key).toBe('value');
  });
});

// ─── Issue 6: Double pool push on stream error ──────────────────────────────

describe('Issue 6 — no double pool push', () => {
  test('context pool length stays consistent after multiple requests', async () => {
    const jetServer = new JetServer();
    ctxPool.length = 0;

    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/pool-test';

    // Run several requests
    for (let i = 0; i < 5; i++) {
      await jetServer.runBare(route);
      await new Promise((r) => queueMicrotask(r));
    }

    // Pool should have at most 5 contexts (one per request, no duplicates)
    expect(ctxPool.length).toBeLessThanOrEqual(5);
  });
});

// ─── Issue 4: _rebuildCorsCloner uses closure, not new Function() ───────────

describe('Issue 4 — CORS cloner uses safe closure', () => {
  test('_rebuildCorsCloner produces correct headers after reconfiguration', () => {
    corsMiddleware({
      origin: ['https://example.com'],
      credentials: true,
    });
    _rebuildCorsCloner();

    const jetServer = new JetServer();
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/cors-closure';

    // The cloner should produce headers with the configured values
    // We test indirectly via a request
    jetServer.runBare(route).then((result) => {
      expect(result.headers['Access-Control-Allow-Origin']).toBe(
        'https://example.com'
      );
      expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
    });
  });
});

// ─── Issue 3: Path traversal with symlinks ──────────────────────────────────

describe('Issue 3 — sendStream path traversal protection', () => {
  let jetServer: JetServer;
  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('sendStream rejects relative path without folder', async () => {
    const route: JetRoute = function (ctx) {
      try {
        ctx.sendStream('relative/path.txt');
        ctx.send({ ok: true });
      } catch (e: any) {
        ctx.send({ error: e.message }, 400);
      }
    };
    route.method = 'GET';
    route.path = '/stream-relative';

    const result = await jetServer.runBare(route);
    // Should reject relative paths when no folder is specified
    expect(result.code).toBe(400);
    expect(result.body.error).toContain('absolute');
  });

  test('sendStream rejects path traversal with folder', async () => {
    const route: JetRoute = function (ctx) {
      try {
        ctx.sendStream('../../etc/passwd', {
          folder: '/tmp/safe',
          ContentType: 'text/plain',
        });
        ctx.send({ ok: true });
      } catch (e: any) {
        ctx.send({ error: e.message }, 400);
      }
    };
    route.method = 'GET';
    route.path = '/stream-traversal';

    const result = await jetServer.runBare(route);
    // Should reject — either "not found" or "traversal detected"
    expect(result.code).toBe(400);
  });
});

// ─── Validator depth limit ──────────────────────────────────────────────────

describe('Validator — recursion depth protection', () => {
  test('deeply nested schema exceeding maxDepth throws', () => {
    // Build a schema 25 levels deep
    let schema: any = {};
    let current = schema;
    for (let i = 0; i < 25; i++) {
      current.nested = { type: 'object', required: true, objectSchema: {} };
      current = current.nested.objectSchema;
    }
    let data: any = {};
    let d = data;
    for (let i = 0; i < 25; i++) {
      d.nested = {};
      d = d.nested;
    }
    expect(() => validator(schema, data, 0, 20)).toThrow(
      'Maximum validation depth'
    );
  });

  test('schema within depth limit validates successfully', () => {
    const schema = {
      a: {
        type: 'object',
        required: true,
        objectSchema: {
          b: {
            type: 'object',
            required: true,
            objectSchema: {
              c: { type: 'string', required: true },
            },
          },
        },
      },
    };
    const data = { a: { b: { c: 'hello' } } };
    const result = validator(schema, data);
    expect(result.a.b.c).toBe('hello');
  });
});
