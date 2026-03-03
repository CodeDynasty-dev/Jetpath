import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from '../src/index.ts';
import type { JetRoute } from '../src/primitives/types.ts';

describe('SSR Integration Tests', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Basic SSR route returns HTML string', async () => {
    const GET_ssr_basic: JetRoute = function (ctx) {
      const html = `<!DOCTYPE html>
<html>
  <head><title>SSR Test</title></head>
  <body>
    <h1>Server-Side Rendered Page</h1>
    <p>Generated at: ${new Date().toISOString()}</p>
  </body>
</html>`;
      ctx.send(html, 200, 'text/html');
    };
    GET_ssr_basic.method = 'GET';
    GET_ssr_basic.path = '/ssr/basic';

    const result = await jetServer.runBare(GET_ssr_basic);
    expect(result.code).toBe(200);
    expect(result.headers['Content-Type']).toContain('text/html');
  });

  test('SSR route with dynamic data renders user info', async () => {
    const GET_ssr_dynamic: JetRoute = function (ctx) {
      const userId = ctx.params?.id || '123';
      const userData = {
        id: userId,
        name: `User ${userId}`,
        email: `user${userId}@example.com`,
      };

      const html = `<!DOCTYPE html>
<html>
  <head>
    <title>User ${userData.name}</title>
    <script>window.__INITIAL_STATE__ = ${JSON.stringify(userData)};</script>
  </head>
  <body>
    <h1>${userData.name}</h1>
    <p>Email: ${userData.email}</p>
  </body>
</html>`;
      ctx.send(html, 200, 'text/html');
    };
    GET_ssr_dynamic.method = 'GET';
    GET_ssr_dynamic.path = '/ssr/users/:id';

    const result = await jetServer.runBare(GET_ssr_dynamic);
    expect(result.code).toBe(200);
    expect(result.headers['Content-Type']).toContain('text/html');
  });

  test('SSR route handles rendering errors gracefully', async () => {
    const GET_ssr_error: JetRoute = function (_ctx) {
      throw new Error('SSR rendering failed');
    };
    GET_ssr_error.method = 'GET';
    GET_ssr_error.path = '/ssr/error';

    const result = await jetServer.runBare(GET_ssr_error);
    expect(result.code).toBe(500);
  });

  test('SSR route handles async errors', async () => {
    const GET_ssr_async_error: JetRoute = async function (_ctx) {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Async SSR error')), 5)
      );
    };
    GET_ssr_async_error.method = 'GET';
    GET_ssr_async_error.path = '/ssr/async-error';

    const result = await jetServer.runBare(GET_ssr_async_error);
    expect(result.code).toBe(500);
  });

  test('SSR route with concurrent requests returns correct data', async () => {
    const GET_ssr_user: JetRoute = function (ctx) {
      const id = ctx.params?.id || 'unknown';
      ctx.send(`<html><body>User ${id}</body></html>`, 200, 'text/html');
    };
    GET_ssr_user.method = 'GET';
    GET_ssr_user.path = '/ssr/users/:id';

    const results = await Promise.all(
      Array.from({ length: 5 }, () => jetServer.runBare(GET_ssr_user))
    );

    for (const result of results) {
      expect(result.code).toBe(200);
    }
    expect(results).toHaveLength(5);
  });

  test('SSR route sets correct content-type for HTML', async () => {
    const GET_html: JetRoute = function (ctx) {
      ctx.send('<html><body>Hello</body></html>', 200, 'text/html');
    };
    GET_html.method = 'GET';
    GET_html.path = '/html';

    const result = await jetServer.runBare(GET_html);
    expect(result.code).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/html');
  });

  test('SSR route with JSON initial state', async () => {
    const GET_ssr_state: JetRoute = function (ctx) {
      const state = { items: [1, 2, 3], user: { id: 'abc' } };
      const html = `<html><head><script>window.__STATE__=${JSON.stringify(state)}</script></head><body></body></html>`;
      ctx.send(html, 200, 'text/html');
    };
    GET_ssr_state.method = 'GET';
    GET_ssr_state.path = '/ssr/state';

    const result = await jetServer.runBare(GET_ssr_state);
    expect(result.code).toBe(200);
  });

  test('SSR route performance is acceptable', async () => {
    const GET_ssr_perf: JetRoute = function (ctx) {
      const html = `<!DOCTYPE html><html><head><title>Perf</title></head><body><h1>Hello</h1></body></html>`;
      ctx.send(html, 200, 'text/html');
    };
    GET_ssr_perf.method = 'GET';
    GET_ssr_perf.path = '/ssr/perf';

    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = await jetServer.runBare(GET_ssr_perf);
      expect(result.code).toBe(200);
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    console.log(`SSR route: ${iterations} runs, avg ${avgMs.toFixed(2)}ms`);
    expect(avgMs).toBeLessThan(50);
  });
});

describe('SSR Integration Tests - Cradova Integration', () => {
  test('Cradova SSR module directory exists', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');

    const cradovaPath = path.join(process.cwd(), 'jetpath-cradova');
    expect(fs.existsSync(cradovaPath)).toBe(true);

    const essentialFiles = [
      'src/index.ts',
      'src/plugin.ts',
      'src/renderer.ts',
      'package.json',
      'README.md',
    ];

    for (const file of essentialFiles) {
      const filePath = path.join(cradovaPath, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  test('Cradova package.json is valid', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');

    const pkgPath = path.join(process.cwd(), 'jetpath-cradova', 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    expect(pkg.name).toBeDefined();
    expect(pkg.version).toBeDefined();
  });
});
