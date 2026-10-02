/**
 * HARD STRESS TESTS — request-context isolation under hostile conditions.
 *
 * Complements test/context-isolation.test.ts with volume + chaos:
 *   - a seeded chaos fuzzer mixing every entry point (node adapter, JetServer,
 *     preflights, 404s, middleware routes) with continuous invariant checks
 *   - sequential churn through the recycled pool
 *   - pool-at-capacity behavior
 *   - an OPTIONS storm through JetServer
 *   - a real-HTTP bombardment (bodies, params, preflights, 404s, keep-alive)
 *
 * Invariants enforced on EVERY check:
 *   1. pool contains only real Context instances (never the global optionsCtx)
 *   2. no duplicate references inside the pool
 *   3. pool never exceeds MAX_POOL_SIZE
 *   4. no context is ever shared between in-flight requests
 *   5. a request never observes another request's header/state/token/body
 *   6. no stale state survives pool recycling
 */
import {
  describe,
  test,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from 'bun:test';
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

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ? deterministic PRNG — failures are reproducible from the seed
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function assertPoolInvariants() {
  expect(ctxPool.length).toBeLessThanOrEqual(MAX_POOL_SIZE);
  const seen = new Set<unknown>();
  for (const entry of ctxPool) {
    expect(entry instanceof Context).toBe(true);
    expect(seen.has(entry)).toBe(false);
    seen.add(entry);
  }
  expect(ctxPool.includes(optionsCtx as any)).toBe(false);
}

/**
 * Hostile middleware: asserts NOTHING about the context may change across the
 * await boundary, that no context is shared between concurrent requests, and
 * that no stale state from a previous request survived recycling.
 */
const makeStressMiddleware = (inFlight: Map<unknown, string>): JetMiddleware =>
  (async function (ctx: any) {
    // ? stale state from a previous request must never survive recycling
    if (ctx.state.__token !== undefined) {
      throw new Error('STALE STATE survived pool recycling');
    }
    const authHeaderBefore = ctx.get('authorization');
    const token = authHeaderBefore?.split(' ')[1];
    const debugId = crypto.randomUUID();
    ctx.state.__debugRequestId = debugId;
    ctx.state.__token = token;
    if (!token) throw new Error('Authentication required');

    // ? forced async gap (randomized)
    await new Promise((r) => setTimeout(r, Math.random() * 6));

    const owner = inFlight.get(ctx);
    if (owner && owner !== debugId) {
      throw new Error('CONTEXT CLOBBERED: shared between concurrent requests');
    }
    if (ctx.get('authorization') !== authHeaderBefore) {
      throw new Error('CONTEXT CLOBBERED: header changed mid-request');
    }
    if (ctx.state.__debugRequestId !== debugId) {
      throw new Error('CONTEXT CLOBBERED: state wiped mid-request');
    }
    inFlight.set(ctx, debugId);
    return (c: any) => {
      inFlight.delete(c);
    };
  }) as unknown as JetMiddleware;

const makeEchoRoute = (
  path: string,
  inFlight: Map<unknown, string>,
): JetRoute => {
  const route = (async function (ctx: any) {
    ctx.send({
      token: ctx.state.__token,
      headerToken: ctx.get('authorization')?.split(' ')[1],
      debugId: ctx.state.__debugRequestId,
      method: ctx.method,
      params: ctx.params,
    });
  }) as unknown as JetRoute;
  route.method = 'GET';
  route.path = path;
  route.jet_middleware = [makeStressMiddleware(inFlight)];
  return route;
};

describe('Stress: pool isolation under hostile load', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
    ctxPool.length = 0;
  });

  test('chaos fuzzer: 1500 mixed ops @ concurrency 120 preserve isolation', async () => {
    const rand = lcg(0x5eed);
    const inFlight = new Map<unknown, string>();
    const route = makeEchoRoute('/zk/chaos', inFlight);

    // ? stateless fast-path routes (no middleware) recycle through the pool
    const plainGet = (function (ctx: any) {
      ctx.send({ ok: true });
    }) as JetRoute;
    plainGet.method = 'GET';
    plainGet.path = '/zk/plain';

    const OPS = 1500;
    const CONCURRENCY = 120;
    let started = 0;
    let completed = 0;

    const worker = async () => {
      while (started < OPS) {
        const i = started++;
        const roll = rand();
        if (roll < 0.08) {
          // ? CORS preflight through the node adapter
          await JetpathNodeAdapter(
            new Request('http://localhost/zk/chaos', {
              method: 'OPTIONS',
            }) as any,
            {} as any,
          );
        } else if (roll < 0.14) {
          // ? 404 through the node adapter
          await JetpathNodeAdapter(
            new Request(`http://localhost/missing-${i}`) as any,
            {} as any,
          );
        } else if (roll < 0.2) {
          // ? stateless runBare (fresh pool allocation + recycle)
          const res = await jetServer.runBare(plainGet);
          if (res.code !== 200) throw new Error(`plain route ${res.code}`);
        } else {
          // ? authenticated middleware route via createCTX + runWithCTX
          const token = `zk_chaos_${i}`;
          const req = new Request(`http://localhost/zk/chaos?i=${i}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const ctx = jetServer.createCTX(
            req,
            {} as any,
            '/zk/chaos',
            route,
            {},
          );
          const res = await jetServer.runWithCTX(route, ctx as any);
          if (res.code !== 200) {
            throw new Error(`request ${i}: status ${res.code}`);
          }
          if (res.body.token !== token || res.body.headerToken !== token) {
            throw new Error(
              `request ${i}: token mismatch ${res.body.token} vs ${token}`,
            );
          }
        }
        completed++;
        if (rand() < 0.02) assertPoolInvariants();
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    await flush();
    assertPoolInvariants();
    expect(completed).toBe(OPS);
    expect(inFlight.size).toBe(0);
  });

  test(
    'sequential churn: 1200 recycled requests never leak state or tokens',
    async () => {
      const inFlight = new Map<unknown, string>();
      const route = makeEchoRoute('/zk/seq', inFlight);

      for (let i = 0; i < 1200; i++) {
        const token = `tok_${i}`;
        const req = new Request('http://localhost/zk/seq', {
          headers: { authorization: `Bearer ${token}` },
        });
        const ctx = jetServer.createCTX(req, {} as any, '/zk/seq', route, {});
        const res = await jetServer.runWithCTX(route, ctx as any);
        if (res.code !== 200) throw new Error(`iter ${i}: status ${res.code}`);
        if (res.body.token !== token || res.body.headerToken !== token) {
          throw new Error(`iter ${i}: leaked token ${res.body.token}`);
        }
        if (i % 97 === 0) {
          await flush();
          assertPoolInvariants();
        }
      }
      await flush();
      assertPoolInvariants();
    },
    20000,
  );

  test('pool at capacity: isolation holds, pool never exceeds cap', async () => {
    // ? saturate the pool completely
    while (ctxPool.length < MAX_POOL_SIZE) {
      ctxPool.push(new Context());
    }
    const inFlight = new Map<unknown, string>();
    const route = makeEchoRoute('/zk/cap', inFlight);

    const results = await Promise.all(
      Array.from({ length: 80 }, (_, i) => {
        const token = `cap_${i}`;
        const req = new Request(`http://localhost/zk/cap?i=${i}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const ctx = jetServer.createCTX(req, {} as any, '/zk/cap', route, {});
        return jetServer.runWithCTX(route, ctx as any).then((res) => {
          if (res.code !== 200) throw new Error(`status ${res.code}`);
          if (res.body.token !== token) throw new Error('token mismatch');
          return res.code;
        });
      }),
    );
    await flush();
    assertPoolInvariants();
    expect(results.every((code) => code === 200)).toBe(true);
    expect(ctxPool.length).toBe(MAX_POOL_SIZE);
  });

  test('OPTIONS storm through JetServer: 300 preflights never poison the pool', async () => {
    const optionsRoute = (function () {}) as JetRoute;
    optionsRoute.method = 'OPTIONS';
    optionsRoute.path = '/zk/any';

    const results = await Promise.all(
      Array.from({ length: 300 }, () => jetServer.runBare(optionsRoute)),
    );
    await flush();
    expect(results.every((r) => r.code === 200)).toBe(true);
    // ? preflight response contexts are per-request objects — nothing pooled
    expect(ctxPool.length).toBe(0);
    assertPoolInvariants();
  });

  test('404 storm through the node adapter: pool stays pristine', async () => {
    await Promise.all(
      Array.from({ length: 300 }, (_, i) =>
        JetpathNodeAdapter(
          new Request(`http://localhost/nope-${i}`) as any,
          {} as any,
        ),
      ),
    );
    await flush();
    expect(ctxPool.length).toBe(0);
    assertPoolInvariants();
  });
});

describe('Stress: real-HTTP bombardment (live Bun server)', () => {
  const rand = lcg(0xbeef);
  const liveServer = Bun.serve({ port: 0, fetch: JetpathBunDeno });
  const base = `http://127.0.0.1:${liveServer.port}`;

  beforeAll(() => {
    const inFlight = new Map<unknown, string>();
    const bombRoute = makeEchoRoute('/zk-bomb', inFlight);
    bombRoute.path = '/zk-bomb';
    _JetPath_paths_trie['GET'].insert('/zk-bomb', bombRoute);

    const postRoute = (async function (ctx: any) {
      const body = await ctx.parse({ validate: false });
      ctx.send({ n: body.n, echoed: true });
    }) as unknown as JetRoute;
    postRoute.method = 'POST';
    postRoute.path = '/zk-post';
    _JetPath_paths_trie['POST'].insert('/zk-post', postRoute);

    const paramRoute = (function (ctx: any) {
      ctx.send({ id: ctx.params.id });
    }) as JetRoute;
    paramRoute.method = 'GET';
    paramRoute.path = '/zk-params/:id';
    _JetPath_paths_trie['GET'].insert('/zk-params/:id', paramRoute);
  });

  afterAll(() => {
    liveServer.stop(true);
  });

  test('3 rounds x 400 concurrent mixed requests (GET+mw, POST+body, params, preflights, 404s)', async () => {
    const bombUrl = `${base}/zk-bomb`;
    for (let round = 0; round < 3; round++) {
      const jobs: Promise<number>[] = [];
      for (let i = 0; i < 400; i++) {
        const roll = rand();
        if (roll < 0.1) {
          jobs.push(
            fetch(bombUrl, { method: 'OPTIONS' }).then((r) => {
              if (r.status !== 200) throw new Error(`preflight ${r.status}`);
              return r.status;
            }),
          );
        } else if (roll < 0.15) {
          jobs.push(
            fetch(`${base}/missing-${round}-${i}`).then((r) => {
              if (r.status !== 404) throw new Error(`404-path ${r.status}`);
              return r.status;
            }),
          );
        } else if (roll < 0.3) {
          jobs.push(
            fetch(`${base}/zk-post`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ n: i }),
            }).then(async (r) => {
              const body = await r.json();
              if (r.status !== 200 || body.n !== i || body.echoed !== true) {
                throw new Error(`post mismatch ${r.status} ${JSON.stringify(body)}`);
              }
              return r.status;
            }),
          );
        } else if (roll < 0.4) {
          jobs.push(
            fetch(`${base}/zk-params/id-${round}-${i}`).then(async (r) => {
              const body = await r.json();
              if (r.status !== 200 || body.id !== `id-${round}-${i}`) {
                throw new Error(`param mismatch ${r.status}`);
              }
              return r.status;
            }),
          );
        } else {
          const token = `bomb_${round}_${i}`;
          jobs.push(
            fetch(`${bombUrl}?i=${i}`, {
              headers: { authorization: `Bearer ${token}` },
            }).then(async (r) => {
              const body = await r.json();
              if (r.status !== 200) {
                throw new Error(`bomb ${r.status}`);
              }
              if (body.token !== token || body.headerToken !== token) {
                throw new Error(
                  `CROSS-REQUEST TOKEN LEAK: ${body.token} vs ${token}`,
                );
              }
              return r.status;
            }),
          );
        }
      }
      const statuses = await Promise.all(jobs);
      expect(statuses.every((s) => s === 200 || s === 404)).toBe(true);
      await flush();
      assertPoolInvariants();
    }
  });
});
