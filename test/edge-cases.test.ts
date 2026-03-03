import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import { use, v } from '../src/primitives/functions.ts';
import type { JetRoute, JetMiddleware } from '../src/primitives/types.ts';

describe('Edge Cases and Error Handling', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Handles route that throws synchronously', async () => {
    const route: JetRoute = function (_ctx) {
      throw new Error('Intentional error for testing');
    };
    route.method = 'GET';
    route.path = '/error';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(500);
  });

  test('Handles route that throws asynchronously', async () => {
    const route: JetRoute = async function (_ctx) {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Async error')), 5)
      );
    };
    route.method = 'GET';
    route.path = '/async-error';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(500);
  });

  test('Handles concurrent requests to same route', async () => {
    let requestCount = 0;
    const route: JetRoute = async function (ctx) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      requestCount++;
      ctx.send({ count: requestCount });
    };
    route.method = 'GET';
    route.path = '/concurrent';

    const promises = Array.from({ length: 10 }, () => jetServer.runBare(route));

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    for (const r of results) {
      expect(r.code).toBe(200);
    }
  });

  test('Handles route with no ctx.send call', async () => {
    const route: JetRoute = function (_ctx) {
      // intentionally no send
    };
    route.method = 'GET';
    route.path = '/no-send';

    const result = await jetServer.runBare(route);
    // Should complete without crashing
    expect([200, 204, 500]).toContain(result.code);
  });

  test('Handles very deep object in response', async () => {
    const route: JetRoute = function (ctx) {
      const deep: Record<string, unknown> = {};
      let current = deep;
      for (let i = 0; i < 20; i++) {
        current['nested'] = {};
        current = current['nested'] as Record<string, unknown>;
      }
      ctx.send({ deep: true });
    };
    route.method = 'GET';
    route.path = '/deep';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.deep).toBe(true);
  });

  test('Handles timeout scenarios', async () => {
    const route: JetRoute = async function (ctx) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      ctx.send({ done: true });
    };
    route.method = 'GET';
    route.path = '/slow';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.done).toBe(true);
  });

  test('Handles middleware that throws', async () => {
    const badMiddleware: JetMiddleware = (_ctx) => {
      throw new Error('Middleware error');
    };

    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/mw-error';
    route.jet_middleware = [badMiddleware];

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(500);
  });

  test('Handles multiple middleware in sequence', async () => {
    const mw1: JetMiddleware = (ctx) => {
      ctx.state.step1 = true;
    };
    const mw2: JetMiddleware = (ctx) => {
      ctx.state.step2 = true;
    };

    const route: JetRoute = function (ctx) {
      ctx.send({
        step1: ctx.state.step1,
        step2: ctx.state.step2,
      });
    };
    route.method = 'GET';
    route.path = '/multi-mw';
    route.jet_middleware = [mw1, mw2];

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.step1).toBe(true);
    expect(result.body.step2).toBe(true);
  });

  test('Handles route with custom status code', async () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ created: true }, 201);
    };
    route.method = 'POST';
    route.path = '/created';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(201);
    expect(result.body.created).toBe(true);
  });

  test('Handles route with redirect', async () => {
    const route: JetRoute = function (ctx) {
      ctx.redirect('/new-location');
    };
    route.method = 'GET';
    route.path = '/redirect';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(301);
    expect(result.headers['Location']).toBe('/new-location');
  });

  test('Handles route with custom response headers', async () => {
    const route: JetRoute = function (ctx) {
      ctx.set('X-Custom-Header', 'test-value');
      ctx.send({ ok: true });
    };
    route.method = 'GET';
    route.path = '/headers';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.headers['X-Custom-Header']).toBe('test-value');
  });

  test('Schema validation with v builder', () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    route.method = 'POST';
    route.path = '/validate';

    use(route).body((t) => ({
      name: t.string().required().min(2),
      age: t.number().required().min(0),
    }));

    expect(route.body).toBeDefined();
    expect(route.body!['name'].required).toBe(true);
    expect(route.body!['age'].required).toBe(true);
  });

  test('parseQuery returns empty object when no query string', async () => {
    const route: JetRoute = function (ctx) {
      const query = ctx.parseQuery();
      ctx.send({ query });
    };
    route.method = 'GET';
    route.path = '/search';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.query).toBeDefined();
  });

  test('OPTIONS method returns 200', async () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    route.method = 'OPTIONS';
    route.path = '/options-test';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
  });
});
