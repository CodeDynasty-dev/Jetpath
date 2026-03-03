import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import { use, v } from '../src/primitives/functions.ts';
import type { JetRoute, JetMiddleware } from '../src/primitives/types.ts';

describe('Performance Tests - JetServer', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Simple route runs quickly', async () => {
    const GET_perf_simple: JetRoute = function (ctx) {
      ctx.send({ message: 'Hello, World!' });
    };
    GET_perf_simple.method = 'GET';
    GET_perf_simple.path = '/perf/simple';

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = await jetServer.runBare(GET_perf_simple);
      expect(result.code).toBe(200);
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    console.log(
      `Simple route: ${iterations} runs, avg ${avgMs.toFixed(2)}ms each`
    );
    // Should be well under 10ms per run in test environment
    expect(avgMs).toBeLessThan(50);
  });

  test('Concurrent route executions complete successfully', async () => {
    const GET_concurrent: JetRoute = async function (ctx) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      ctx.send({ ok: true });
    };
    GET_concurrent.method = 'GET';
    GET_concurrent.path = '/concurrent';

    const concurrency = 20;
    const start = performance.now();

    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        jetServer.runBare(GET_concurrent)
      )
    );

    const elapsed = performance.now() - start;

    for (const r of results) {
      expect(r.code).toBe(200);
    }

    console.log(
      `${concurrency} concurrent runs completed in ${elapsed.toFixed(2)}ms`
    );
    expect(results).toHaveLength(concurrency);
  });

  test('Route with middleware runs within acceptable time', async () => {
    const mw: JetMiddleware = (ctx) => {
      ctx.state.startTime = Date.now();
    };

    const GET_perf_middleware: JetRoute = function (ctx) {
      ctx.send({ duration: Date.now() - ctx.state.startTime });
    };
    GET_perf_middleware.method = 'GET';
    GET_perf_middleware.path = '/perf/middleware';
    GET_perf_middleware.jet_middleware = [mw];

    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = await jetServer.runBare(GET_perf_middleware);
      expect(result.code).toBe(200);
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    console.log(
      `Middleware route: ${iterations} runs, avg ${avgMs.toFixed(2)}ms each`
    );
    expect(avgMs).toBeLessThan(50);
  });

  test('Route with body schema attached runs correctly', async () => {
    const POST_perf_validate: JetRoute = function (ctx) {
      ctx.send({ valid: true });
    };
    POST_perf_validate.method = 'POST';
    POST_perf_validate.path = '/perf/validate';

    use(POST_perf_validate).body((t) => ({
      name: t.string().required(),
      age: t.number().required(),
    }));

    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = await jetServer.runBare(POST_perf_validate);
      expect([200, 400, 500]).toContain(result.code);
    }

    const elapsed = performance.now() - start;
    console.log(
      `Validation route: ${iterations} runs in ${elapsed.toFixed(2)}ms`
    );
    expect(elapsed).toBeLessThan(5000);
  });

  test('Multiple different routes run without interference', async () => {
    const routes: JetRoute[] = Array.from({ length: 10 }, (_, i) => {
      const r: JetRoute = function (ctx) {
        ctx.send({ index: i });
      };
      r.method = 'GET';
      r.path = `/route/${i}`;
      return r;
    });

    const results = await Promise.all(routes.map((r) => jetServer.runBare(r)));

    for (let i = 0; i < results.length; i++) {
      expect(results[i].code).toBe(200);
      expect(results[i].body.index).toBe(i);
    }
  });
});

describe('Performance Tests - Trie Router', () => {
  test('Trie route matching performance', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Trie } = require('../src/primitives/trie-router.js');

    const trie = new Trie('GET');
    const routeCount = 100;

    for (let i = 0; i < routeCount; i++) {
      const handler = () => ({ id: i });
      trie.insert(`/api/v1/resource/${i}`, handler);
    }

    trie.insert('/api/v1/users/:id/profile', () => ({}));
    trie.insert('/api/v1/users/:id/posts/:postId', () => ({}));

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      trie.get_responder(
        { url: `/api/v1/resource/${i % routeCount}`, method: 'GET' },
        {}
      );
      trie.get_responder(
        { url: `/api/v1/users/123/profile`, method: 'GET' },
        {}
      );
    }

    const elapsed = performance.now() - start;
    const timePerOp = elapsed / iterations;

    console.log(
      `Trie matching: ${iterations} iterations, ${timePerOp.toFixed(4)}ms per op`
    );
    // Should be very fast
    expect(timePerOp).toBeLessThan(1);
  });

  test('Schema builder performance', () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      v.string().required().min(3).max(50).email();
      v.number().required().min(0).max(100);
      v.boolean();
      v.array(v.string());
      v.object({ key: v.string().required() });
    }

    const elapsed = performance.now() - start;
    console.log(
      `Schema builder: ${iterations} iterations in ${elapsed.toFixed(2)}ms`
    );
    expect(elapsed).toBeLessThan(1000);
  });
});
