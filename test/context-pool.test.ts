import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import type { JetRoute } from '../src/primitives/types.ts';
import { ctxPool } from '../src/primitives/trie-router.ts';

describe('Context Pool', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
    // Clear the pool before each test
    ctxPool.length = 0;
  });

  test('Context pool reuses contexts', async () => {
    const route1: JetRoute = function (ctx) {
      ctx.send({ message: 'Route 1' });
    };
    route1.method = 'GET';
    route1.path = '/test1';

    const route2: JetRoute = function (ctx) {
      ctx.send({ message: 'Route 2' });
    };
    route2.method = 'GET';
    route2.path = '/test2';

    // First request - should create new context
    const initialPoolSize = ctxPool.length;
    const result1 = await jetServer.runBare(route1);
    expect(result1.code).toBe(200);
    expect(result1.body.message).toBe('Route 1');

    // Wait for microtask to complete (context returned to pool)
    await new Promise((resolve) => queueMicrotask(resolve));

    // Context should be returned to pool
    expect(ctxPool.length).toBe(initialPoolSize + 1);

    // Second request - should reuse context from pool
    const result2 = await jetServer.runBare(route2);
    expect(result2.code).toBe(200);
    expect(result2.body.message).toBe('Route 2');

    // Wait for microtask to complete
    await new Promise((resolve) => queueMicrotask(resolve));

    // Pool size should be the same (context reused)
    expect(ctxPool.length).toBe(initialPoolSize + 1);
  });

  test('Context state is cleared when reused', async () => {
    let firstContextId: any = null;

    const route1: JetRoute = function (ctx) {
      // Store something in state
      ctx.state.test = 'value from first request';
      // Capture context reference
      firstContextId = (ctx as any)._7;
      ctx.send({ message: 'First' });
    };
    route1.method = 'GET';
    route1.path = '/first';

    const route2: JetRoute = function (ctx) {
      // State should be cleared
      expect(ctx.state.test).toBeUndefined();
      ctx.send({ message: 'Second' });
    };
    route2.method = 'GET';
    route2.path = '/second';

    await jetServer.runBare(route1);
    // Wait for microtask to complete
    await new Promise((resolve) => queueMicrotask(resolve));

    await jetServer.runBare(route2);
    // Wait for microtask to complete
    await new Promise((resolve) => queueMicrotask(resolve));

    // Context should have been reused
    expect(ctxPool.length).toBeGreaterThan(0);
  });

  test('Streaming responses handle context pool correctly', async () => {
    // Note: This test would need actual file streaming to test properly
    // For now, we test the non-streaming path
    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'Non-streaming response' });
    };
    route.method = 'GET';
    route.path = '/non-streaming';

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.message).toBe('Non-streaming response');

    // Wait for microtask to complete
    await new Promise((resolve) => queueMicrotask(resolve));

    // Context should be returned to pool
    expect(ctxPool.length).toBe(1);
  });
});
