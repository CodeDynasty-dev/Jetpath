import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import type { JetRoute, JetMiddleware } from '../src/primitives/types.ts';

describe('Middleware System', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Global middleware applies to all routes', async () => {
    const logMiddleware: JetMiddleware = function (ctx) {
      ctx.state.requestTime = Date.now();
      return (ctx, error) => {
        if (error) {
          console.error('Request failed:', error);
        }
      };
    };

    const route1: JetRoute = function (ctx) {
      expect(ctx.state.requestTime).toBeDefined();
      expect(typeof ctx.state.requestTime).toBe('number');
      ctx.send({ message: 'Route 1' });
    };
    route1.method = 'GET';
    route1.path = '/route1';
    route1.jet_middleware = [logMiddleware];

    const route2: JetRoute = function (ctx) {
      expect(ctx.state.requestTime).toBeDefined();
      expect(typeof ctx.state.requestTime).toBe('number');
      ctx.send({ message: 'Route 2' });
    };
    route2.method = 'GET';
    route2.path = '/route2';
    route2.jet_middleware = [logMiddleware];

    const result1 = await jetServer.runBare(route1);
    expect(result1.code).toBe(200);
    expect(result1.body.message).toBe('Route 1');

    const result2 = await jetServer.runBare(route2);
    expect(result2.code).toBe(200);
    expect(result2.body.message).toBe('Route 2');
  });

  test('Middleware can modify request/response', async () => {
    const authMiddleware: JetMiddleware = function (ctx) {
      const authHeader = ctx.get('Authorization');
      if (authHeader === 'Bearer valid-token') {
        ctx.state.user = { id: 'user-123', role: 'admin' };
      } else {
        ctx.code = 401;
        ctx.send({ error: 'Unauthorized' });
      }
      return (ctx, error) => {
        if (error) {
          console.error('Auth error:', error);
        }
      };
    };

    const protectedRoute: JetRoute = function (ctx) {
      ctx.send({
        user: ctx.state.user,
        message: 'Access granted',
      });
    };
    protectedRoute.method = 'GET';
    protectedRoute.path = '/protected';
    protectedRoute.jet_middleware = [authMiddleware];

    // Test unauthorized request
    const mockRequestUnauth = new Request('http://localhost/protected', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const mockCtxUnauth = jetServer.createCTX(
      mockRequestUnauth,
      new Response(),
      '/protected',
      protectedRoute,
      {}
    );

    const resultUnauth = await jetServer.runWithCTX(
      protectedRoute,
      mockCtxUnauth
    );
    expect(resultUnauth.code).toBe(401);
    expect(resultUnauth.body.error).toBe('Unauthorized');

    // Test authorized request
    const mockRequestAuth = new Request('http://localhost/protected', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const mockCtxAuth = jetServer.createCTX(
      mockRequestAuth,
      new Response(),
      '/protected',
      protectedRoute,
      {}
    );

    const resultAuth = await jetServer.runWithCTX(protectedRoute, mockCtxAuth);
    expect(resultAuth.code).toBe(200);
    expect(resultAuth.body.user.id).toBe('user-123');
    expect(resultAuth.body.user.role).toBe('admin');
  });

  test('Multiple middleware execute in order', async () => {
    const executionOrder: string[] = [];

    const middleware1: JetMiddleware = function (ctx) {
      executionOrder.push('middleware1-start');
      ctx.state.fromMiddleware1 = 'value1';
      return (ctx, error) => {
        executionOrder.push('middleware1-end');
        if (error) {
          console.error('Middleware1 error:', error);
        }
      };
    };

    const middleware2: JetMiddleware = function (ctx) {
      executionOrder.push('middleware2-start');
      ctx.state.fromMiddleware2 = 'value2';
      return (ctx, error) => {
        executionOrder.push('middleware2-end');
        if (error) {
          console.error('Middleware2 error:', error);
        }
      };
    };

    const route: JetRoute = function (ctx) {
      executionOrder.push('route-handler');
      expect(ctx.state.fromMiddleware1).toBe('value1');
      expect(ctx.state.fromMiddleware2).toBe('value2');
      ctx.send({ order: executionOrder });
    };
    route.method = 'GET';
    route.path = '/ordered';
    route.jet_middleware = [middleware1, middleware2];

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);

    // Check execution order
    expect(executionOrder).toEqual([
      'middleware1-start',
      'middleware2-start',
      'route-handler',
      'middleware2-end',
      'middleware1-end',
    ]);
  });

  test('Error middleware handles route errors', async () => {
    const errorMiddleware: JetMiddleware = function (ctx) {
      return (ctx, error) => {
        if (error) {
          ctx.code = 500;
          ctx.send({
            error: 'Internal Server Error',
            message: error.message,
          });
        }
      };
    };

    const errorRoute: JetRoute = function (ctx) {
      throw new Error('Something went wrong!');
    };
    errorRoute.method = 'GET';
    errorRoute.path = '/error';
    errorRoute.jet_middleware = [errorMiddleware];

    const result = await jetServer.runBare(errorRoute);
    expect(result.code).toBe(500);
    expect(result.body.error).toBe('Internal Server Error');
    expect(result.body.message).toBe('Something went wrong!');
  });

  test('Middleware can short-circuit request', async () => {
    const rateLimitMiddleware: JetMiddleware = function (ctx) {
      // Simulate rate limit check
      const isRateLimited = false; // In real implementation, check against rate limit store

      if (isRateLimited) {
        ctx.code = 429;
        ctx.send({ error: 'Too Many Requests' });
        // Return a function that does nothing since we already sent response
        return () => {};
      }

      return (ctx, error) => {
        if (error) {
          console.error('Rate limit error:', error);
        }
      };
    };

    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'Not rate limited' });
    };
    route.method = 'GET';
    route.path = '/rate-test';
    route.jet_middleware = [rateLimitMiddleware];

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.message).toBe('Not rate limited');
  });
});
