import { describe, test, expect } from 'bun:test';
import {
  getHandlersEdge,
  _JetPath_paths,
  assignMiddleware,
} from '../src/primitives/functions.ts';
import type { JetRoute } from '../src/primitives/types.ts';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRoute(): JetRoute {
  // Must have at least 1 param so function.length > 0 (assignMiddleware filters on this)
  const fn: JetRoute = function (_ctx) {
    _ctx.send({ ok: true });
  };
  return fn;
}

// ─── naming convention tests via getHandlersEdge ────────────────────────────

describe('Route Naming Conventions', () => {
  test('GET_users registers GET /users', async () => {
    const GET_users = makeRoute();
    await getHandlersEdge({ GET_users } as any);
    expect(GET_users.method).toBe('GET');
    expect(GET_users.path).toBe('/users');
  });

  test('POST_users registers POST /users', async () => {
    const POST_users = makeRoute();
    await getHandlersEdge({ POST_users } as any);
    expect(POST_users.method).toBe('POST');
    expect(POST_users.path).toBe('/users');
  });

  test('PUT_users_$id registers PUT /users/:id', async () => {
    const PUT_users_$id = makeRoute();
    await getHandlersEdge({ PUT_users_$id } as any);
    expect(PUT_users_$id.method).toBe('PUT');
    expect(PUT_users_$id.path).toBe('/users/:id');
  });

  test('DELETE_users_$id registers DELETE /users/:id', async () => {
    const DELETE_users_$id = makeRoute();
    await getHandlersEdge({ DELETE_users_$id } as any);
    expect(DELETE_users_$id.method).toBe('DELETE');
    expect(DELETE_users_$id.path).toBe('/users/:id');
  });

  test('PATCH_items_$id registers PATCH /items/:id', async () => {
    const PATCH_items_$id = makeRoute();
    await getHandlersEdge({ PATCH_items_$id } as any);
    expect(PATCH_items_$id.method).toBe('PATCH');
    expect(PATCH_items_$id.path).toBe('/items/:id');
  });

  test('GET_api_v1_users registers GET /api/v1/users', async () => {
    const GET_api_v1_users = makeRoute();
    await getHandlersEdge({ GET_api_v1_users } as any);
    expect(GET_api_v1_users.method).toBe('GET');
    expect(GET_api_v1_users.path).toBe('/api/v1/users');
  });

  test('GET_files_$0 registers GET /files/* (wildcard)', async () => {
    const GET_files_$0 = makeRoute();
    await getHandlersEdge({ GET_files_$0 } as any);
    expect(GET_files_$0.method).toBe('GET');
    expect(GET_files_$0.path).toBe('/files/*');
  });

  test('__ in name converts to - in path', async () => {
    const GET_well__known = makeRoute();
    await getHandlersEdge({ GET_well__known } as any);
    expect(GET_well__known.method).toBe('GET');
    expect(GET_well__known.path).toBe('/well-known');
  });

  test('Multiple params: GET_users_$id_posts_$postId', async () => {
    const GET_users_$id_posts_$postId = makeRoute();
    await getHandlersEdge({ GET_users_$id_posts_$postId } as any);
    expect(GET_users_$id_posts_$postId.method).toBe('GET');
    expect(GET_users_$id_posts_$postId.path).toBe('/users/:id/posts/:postId');
  });

  test('Non-matching names are ignored', async () => {
    const notARoute = makeRoute();
    await getHandlersEdge({ notARoute } as any);
    expect(notARoute.method).toBeUndefined();
    expect(notARoute.path).toBeUndefined();
  });

  test('MIDDLEWARE_ prefix registers middleware, not a route', async () => {
    const MIDDLEWARE_api: any = function (_ctx: any) {};
    await getHandlersEdge({ MIDDLEWARE_api } as any);
    expect(_JetPath_paths['GET']['/api']).toBeUndefined();
  });
});

// ─── assignMiddleware tests ──────────────────────────────────────────────────

describe('assignMiddleware path-prefix matching', () => {
  test('middleware at /api applies to /api/users and /api/posts', () => {
    const mw = function () {};

    // Do NOT pre-set jet_middleware — assignMiddleware initialises it.
    // Functions must have length > 0 (assignMiddleware filters `value.length > 0`).
    const routeUsers = Object.assign(function (_ctx: any) {}, {
      path: '/api/users',
    });
    const routePosts = Object.assign(function (_ctx: any) {}, {
      path: '/api/posts',
    });
    const routeOther = Object.assign(function (_ctx: any) {}, {
      path: '/other',
    });

    const paths: Record<string, any> = {
      GET: {
        '/api/users': routeUsers,
        '/api/posts': routePosts,
        '/other': routeOther,
      },
    };

    assignMiddleware(paths, { '/api': mw });

    expect(routeUsers.jet_middleware).toContain(mw);
    expect(routePosts.jet_middleware).toContain(mw);
    expect(routeOther.jet_middleware).not.toContain(mw);
  });

  test('more specific middleware prefix — both global and specific are applied', () => {
    const globalMw = function () {};
    const specificMw = function () {};

    const routeAdmin = Object.assign(function (_ctx: any) {}, {
      path: '/api/admin/users',
    });

    const paths: Record<string, any> = {
      GET: { '/api/admin/users': routeAdmin },
    };

    assignMiddleware(paths, {
      '/api': globalMw,
      '/api/admin': specificMw,
    });

    const mws = routeAdmin.jet_middleware;
    expect(mws).toContain(globalMw);
    expect(mws).toContain(specificMw);
    // shorter prefix (/api) is sorted first → globalMw comes before specificMw
    expect(mws.indexOf(globalMw)).toBeLessThan(mws.indexOf(specificMw));
  });

  test('route without matching prefix gets no middleware', () => {
    const mw = function () {};
    const routePublic = Object.assign(function (_ctx: any) {}, {
      path: '/public/info',
    });

    const paths: Record<string, any> = {
      GET: { '/public/info': routePublic },
    };

    assignMiddleware(paths, { '/api': mw });

    expect(routePublic.jet_middleware).toHaveLength(0);
  });
});
