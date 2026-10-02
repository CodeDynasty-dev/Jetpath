/**
 * Request-context isolation regression tests.
 *
 * Bug (Zikoo report): the same valid live API key intermittently failed with
 * SafeToken "Invalid token" under load, then worked again later.
 *
 * Root cause: Jetpath's context pool allowed shared/global objects (the global
 * CORS `optionsCtx` used for every OPTIONS preflight, and 404 spread copies)
 * to be recycled as per-request contexts. Every preflight pushed the SAME
 * global object into `ctxPool` again, creating duplicate pool entries, so two
 * concurrent requests could own one mutable Context at the same time. The
 * second `getCtx` reset swaps `ctx.request` underneath the first request's
 * suspended middleware (e.g. while `await auth.decode(token)` is pending), so
 * after the await the middleware reads ANOTHER request's `authorization`
 * header — SafeToken then verifies a token that does not match the signature
 * for that request and throws "Invalid token".
 *
 * These tests pin the required invariant:
 *   "A Jetpath ctx object and all request-scoped mutable data must be
 *    exclusively owned by one request until the entire async
 *    middleware/handler chain has resolved."
 */
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { JetServer } from '../src/index.ts';
import type { JetRoute, JetMiddleware } from '../src/primitives/types.ts';
import { ctxPool, MAX_POOL_SIZE } from '../src/primitives/trie-router.ts';
import { optionsCtx } from '../src/primitives/cors.ts';
import { Context } from '../src/primitives/classes.ts';
import {
  Jetpath as JetpathNodeAdapter,
  JetpathBunDeno,
  _JetPath_paths_trie,
} from '../src/primitives/functions.ts';

// ? Flush queued queueMicrotask pool-returns (macrotask boundary).
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const preflightRequest = () =>
  new Request('http://localhost/zk/balance', { method: 'OPTIONS' });

/**
 * Zikoo-style auth middleware: reads the authorization header, stores debug
 * state, awaits (async gap — like `await auth.decode(...)` / `await
 * auth.verify(...)` / DB lookups), then re-checks that nothing about the
 * context changed across the await boundary.
 */
const makeZikooMiddleware = (inFlight: Map<unknown, string>): JetMiddleware =>
  (async function (ctx: any) {
    const authHeaderBefore = ctx.get('authorization');
    const token = authHeaderBefore?.split(' ')[1];
    const debugId = crypto.randomUUID();
    ctx.state.__debugRequestId = debugId;
    ctx.state.__token = token;
    if (!token) throw new Error('Authentication required');

    // ? forced async gap inside the middleware chain
    await new Promise((r) => setTimeout(r, 1 + Math.random() * 6));

    const owner = inFlight.get(ctx);
    if (owner && owner !== debugId) {
      throw new Error(
        'CONTEXT CLOBBERED: context shared between concurrent requests',
      );
    }
    const authHeaderAfter = ctx.get('authorization');
    if (authHeaderAfter !== authHeaderBefore) {
      throw new Error(
        'CONTEXT CLOBBERED: authorization header changed mid-request',
      );
    }
    if (ctx.state.__debugRequestId !== debugId) {
      throw new Error('CONTEXT CLOBBERED: state wiped mid-request');
    }
    if (ctx.state.__token !== token) {
      throw new Error('CONTEXT CLOBBERED: token changed mid-request');
    }
    inFlight.set(ctx, debugId);
    return (c: any) => {
      inFlight.delete(c);
    };
  }) as unknown as JetMiddleware;

/**
 * Route handler that echoes what the request observed. A request must always
 * see its OWN token — from both state (written pre-await by the middleware)
 * and the live authorization header (read post-await in the handler).
 */
const makeEchoRoute = (inFlight: Map<unknown, string>): JetRoute => {
  const route = (function (ctx: any) {
    ctx.send({
      token: ctx.state.__token,
      headerToken: ctx.get('authorization')?.split(' ')[1],
      debugId: ctx.state.__debugRequestId,
      method: ctx.method,
    });
  }) as JetRoute;
  route.method = 'GET';
  route.path = '/zk/balance';
  route.jet_middleware = [makeZikooMiddleware(inFlight)];
  return route;
};


describe('Request context isolation (pool ownership)', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
    ctxPool.length = 0;
  });

  test('CORS preflight must never leak the shared global optionsCtx into the pool', async () => {
    await JetpathNodeAdapter(preflightRequest() as any, {} as any);
    await flush();

    expect(ctxPool.includes(optionsCtx as any)).toBe(false);
    expect(ctxPool.length).toBe(0);
  });

  test('context pool must never contain duplicate references (repeated preflights)', async () => {
    await JetpathNodeAdapter(preflightRequest() as any, {} as any);
    await flush();
    await JetpathNodeAdapter(preflightRequest() as any, {} as any);
    await flush();

    const seen = new Set<unknown>();
    for (const entry of ctxPool) {
      expect(seen.has(entry)).toBe(false);
      seen.add(entry);
    }
  });

  test('404 responses must never leak non-Context objects into the pool', async () => {
    await JetpathNodeAdapter(
      new Request('http://localhost/definitely-missing-404') as any,
      {} as any,
    );
    await flush();

    for (const entry of ctxPool) {
      expect(entry instanceof Context).toBe(true);
    }
    expect(ctxPool.length).toBe(0);
  });

  test('request after preflights receives a fully functional per-request context', async () => {
    // ? two preflights poison the pool before the real request arrives
    await JetpathNodeAdapter(preflightRequest() as any, {} as any);
    await flush();
    await JetpathNodeAdapter(preflightRequest() as any, {} as any);
    await flush();

    const inFlight = new Map<unknown, string>();
    const route = makeEchoRoute(inFlight);
    const token = 'zk_live_after_preflight';
    const req = new Request('http://localhost/zk/balance', {
      headers: { authorization: `Bearer ${token}` },
    });
    const ctx = jetServer.createCTX(req, {} as any, '/zk/balance', route, {});
    const result = await jetServer.runWithCTX(route, ctx as any);

    expect(result.code).toBe(200);
    expect(result.body.token).toBe(token);
    expect(result.body.headerToken).toBe(token);
    expect(result.body.method).toBe('GET');
  });

  test('suspended request keeps exclusive context ownership across preflight + concurrent request', async () => {
    const inFlight = new Map<unknown, string>();
    const route = makeEchoRoute(inFlight);

    // ? browser preflight arrives and is answered
    await JetpathNodeAdapter(preflightRequest() as any, {} as any);
    await flush();

    // ? request A arrives and its middleware suspends at the async gap
    const tokenA = 'zk_live_request_A';
    const reqA = new Request('http://localhost/zk/balance', {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const ctxA = jetServer.createCTX(reqA, {} as any, '/zk/balance', route, {});
    const runA = jetServer.runWithCTX(route, ctxA as any);
    await new Promise((r) => setTimeout(r, 8)); // ? A is now suspended

    // ? while A is suspended: another preflight + request B arrive
    await JetpathNodeAdapter(preflightRequest() as any, {} as any);
    await flush();
    const tokenB = 'zk_live_request_B';
    const reqB = new Request('http://localhost/zk/balance', {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    const ctxB = jetServer.createCTX(reqB, {} as any, '/zk/balance', route, {});
    const resultB = await jetServer.runWithCTX(route, ctxB as any);
    const resultA = await runA;

    // ? A must still see A's own data; B must see B's own data
    expect(resultA.code).toBe(200);
    expect(resultA.body.token).toBe(tokenA);
    expect(resultA.body.headerToken).toBe(tokenA);
    expect(resultB.code).toBe(200);
    expect(resultB.body.token).toBe(tokenB);
    expect(resultB.body.headerToken).toBe(tokenB);
  });

  test('high-concurrency: 200 parallel authed requests each keep their own header, state and token', async () => {
    const inFlight = new Map<unknown, string>();
    const route = makeEchoRoute(inFlight);
    const N = 200;

    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => {
        const token = `zk_live_${i}`;
        const req = new Request(`http://localhost/zk/balance?i=${i}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const ctx = jetServer.createCTX(
          req,
          {} as any,
          '/zk/balance',
          route,
          {},
        );
        return jetServer
          .runWithCTX(route, ctx as any)
          .then((res) => ({ res, token }));
      }),
    );
    await flush();

    expect(results.length).toBe(N);
    for (const { res, token } of results) {
      expect(res.code).toBe(200);
      expect(res.body.token).toBe(token);
      expect(res.body.headerToken).toBe(token);
      expect(typeof res.body.debugId).toBe('string');
    }

    // ? every recycled context must be a real per-request Context instance
    for (const entry of ctxPool) {
      expect(entry instanceof Context).toBe(true);
    }
    expect(ctxPool.length).toBeLessThanOrEqual(MAX_POOL_SIZE);
  });

  test('pooled context must carry the current request method (no stale method)', async () => {
    const observed: string[] = [];
    const postRoute = (function (ctx: any) {
      observed.push(ctx.method);
      ctx.send({ ok: true });
    }) as JetRoute;
    postRoute.method = 'POST';
    postRoute.path = '/zk/method-post';

    const getRoute = (function (ctx: any) {
      observed.push(ctx.method);
      ctx.send({ ok: true });
    }) as JetRoute;
    getRoute.method = 'GET';
    getRoute.path = '/zk/method-get';

    await jetServer.runBare(postRoute);
    await flush();
    await jetServer.runBare(getRoute); // ? reuses the pooled context
    await flush();

    expect(observed[0]).toBe('POST');
    expect(observed[1]).toBe('GET');
  });

  test('re-using a released context via runWithCTX is safe (reclaimed from storage)', async () => {
    ctxPool.length = 0;
    const inFlight = new Map<unknown, string>();
    const route = makeEchoRoute(inFlight);
    const token = 'zk_live_reuse';
    const req = new Request('http://localhost/zk/balance', {
      headers: { authorization: `Bearer ${token}` },
    });
    const ctx = jetServer.createCTX(req, {} as any, '/zk/balance', route, {});

    const first = await jetServer.runWithCTX(route, ctx as any);
    await flush(); // ? context is now stored in the pool

    // ? caller re-uses the SAME context object — it must be reclaimed out of
    // ? the pool before executing, never shared with another request
    const second = jetServer.runWithCTX(route, ctx as any);
    expect(ctxPool.includes(ctx as any)).toBe(false);
    const secondResult = await second;
    await flush();

    expect(first.code).toBe(200);
    expect(first.body.token).toBe(token);
    expect(secondResult.code).toBe(200);
    expect(secondResult.body.token).toBe(token);
    // ? stored at most once — duplicate pool entries are forbidden
    const occurrences = ctxPool.filter((c) => c === (ctx as any)).length;
    expect(occurrences).toBe(1);
  });
});

describe('Live server isolation (real Bun HTTP)', () => {
  const liveServer = Bun.serve({
    port: 0,
    fetch: JetpathBunDeno,
  });

  afterAll(() => {
    liveServer.stop(true);
  });

  test('interleaved preflights + concurrent authed requests echo their own token', async () => {
    ctxPool.length = 0;
    const inFlight = new Map<unknown, string>();
    const route = makeEchoRoute(inFlight);
    route.path = '/zk-live';
    // ? register the live route (insert() normalizes the leading slash)
    _JetPath_paths_trie['GET'].insert('/zk-live', route);

    const url = `http://127.0.0.1:${liveServer.port}/zk-live`;

    // ? mix of preflights (browser dashboard) + authed API calls, all parallel
    const calls: Promise<{
      status: number;
      token: string;
      body: any;
    }>[] = [];
    for (let i = 0; i < 150; i++) {
      const token = `zk_live_http_${i}`;
      calls.push(
        fetch(url, {
          headers: { authorization: `Bearer ${token}` },
        }).then(async (res) => ({
          status: res.status,
          token,
          body: await res.json(),
        })),
      );
      if (i % 10 === 0) {
        calls.push(
          fetch(url, { method: 'OPTIONS' }).then(async (res) => ({
            status: res.status,
            token: '',
            body: undefined,
          })),
        );
      }
    }
    const settled = await Promise.all(calls);

    let checked = 0;
    for (const call of settled) {
      if (!call.token) {
        // ? preflight
        expect(call.status).toBe(200);
        continue;
      }
      expect(call.status).toBe(200);
      expect(call.body.token).toBe(call.token);
      expect(call.body.headerToken).toBe(call.token);
      checked++;
    }
    expect(checked).toBe(150);

    await flush();
    for (const entry of ctxPool) {
      expect(entry instanceof Context).toBe(true);
    }
    // ? the global optionsCtx must never be pooled
    expect(ctxPool.includes(optionsCtx as any)).toBe(false);
  });
});
