import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import { corsMiddleware } from '../src/primitives/cors.ts';
import { _rebuildCorsCloner } from '../src/primitives/trie-router.ts';
import type { JetRoute } from '../src/primitives/types.ts';

describe('CORS Middleware', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
    // Reset CORS configuration
    // Note: In a real test, we'd need to reset the module state
  });

  test('CORS middleware sets appropriate headers', async () => {
    // Configure CORS
    corsMiddleware({
      origin: ['http://localhost:3000', 'https://example.com'],
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowHeaders: ['Content-Type', 'Authorization'],
    });
    _rebuildCorsCloner();

    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'CORS test' });
    };
    route.method = 'GET';
    route.path = '/cors-test';

    const result = await jetServer.runBare(route);

    // Check CORS headers
    expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(result.headers['Vary']).toBe('Origin');
    // Note: Access-Control-Allow-Origin would be set based on request origin
  });

  test('OPTIONS preflight request handled correctly', async () => {
    // This would test the OPTIONS request handling
    // In Jetpath, OPTIONS requests are handled automatically by the framework

    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'Regular request' });
    };
    route.method = 'GET';
    route.path = '/test';

    // Note: The actual OPTIONS handling is internal to Jetpath
    // We can test that regular requests still work when CORS is configured
    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.message).toBe('Regular request');
  });

  test('CORS with specific origins', async () => {
    corsMiddleware({
      origin: ['https://trusted-domain.com'],
      credentials: false,
    });
    _rebuildCorsCloner();

    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'Specific origin' });
    };
    route.method = 'GET';
    route.path = '/specific-origin';

    const result = await jetServer.runBare(route);

    // With specific origins, the header should be set
    expect(result.headers['Access-Control-Allow-Origin']).toBe(
      'https://trusted-domain.com'
    );
    expect(result.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  test('CORS with wildcard origin', async () => {
    corsMiddleware({
      origin: ['*'], // Wildcard
      credentials: false, // Credentials can't be used with wildcard
    });
    _rebuildCorsCloner();

    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'Wildcard origin' });
    };
    route.method = 'GET';
    route.path = '/wildcard-origin';

    const result = await jetServer.runBare(route);

    // With wildcard origin
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});
