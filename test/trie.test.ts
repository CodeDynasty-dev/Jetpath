import { describe, test, expect } from 'bun:test';
import type { JetRoute } from '../src/primitives/types.ts';
import { Trie } from '../src/primitives/trie-router.ts';

describe('Trie Data Structure', () => {
  test('Trie inserts and retrieves exact paths', () => {
    const trie = new Trie('GET');
    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'Test' });
    };

    // Insert exact path
    trie.insert('/api/users', route);

    // Should find exact match
    const mockReq = { url: 'http://localhost/api/users' } as any;
    const result = trie.get_responder(mockReq, {});
    expect(result?.handler).toBe(route);
  });

  test('Trie handles path parameters', () => {
    const trie = new Trie('GET');
    const route: JetRoute = function (ctx) {
      ctx.send({ userId: ctx.params.id });
    };

    // Insert path with parameter
    trie.insert('/api/users/:id', route);

    // Should match with parameter extraction
    const mockReq = { url: 'http://localhost/api/users/123' } as any;
    const result = trie.get_responder(mockReq, {});
    expect(result?.handler).toBe(route);
    expect(result?.params?.id).toBe('123');
  });

  test('Trie handles wildcard paths', () => {
    const trie = new Trie('GET');
    const route: JetRoute = function (ctx) {
      ctx.send({ path: ctx.params['*'] });
    };

    // Insert wildcard path
    trie.insert('/api/files/*', route);

    // Should match wildcard
    const mockReq = {
      url: 'http://localhost/api/files/images/photo.jpg',
    } as any;
    const result = trie.get_responder(mockReq, {});
    expect(result?.handler).toBe(route);
    expect(result?.params?.['*']).toBe('images/photo.jpg');
  });

  test('Trie returns undefined for non-existent paths', () => {
    const trie = new Trie('GET');
    const route: JetRoute = function (ctx) {
      ctx.send({ message: 'Test' });
    };

    trie.insert('/api/users', route);

    // Should not find non-existent path
    const mockReq = { url: 'http://localhost/api/nonexistent' } as any;
    const result = trie.get_responder(mockReq, {});
    expect(result).toBeUndefined();
  });

  test('Trie handles multiple routes', () => {
    const trie = new Trie('GET');
    const userRoute: JetRoute = function (ctx) {
      ctx.send({ type: 'users' });
    };
    const postRoute: JetRoute = function (ctx) {
      ctx.send({ type: 'posts' });
    };

    trie.insert('/api/users', userRoute);
    trie.insert('/api/posts', postRoute);

    const mockReq1 = { url: 'http://localhost/api/users' } as any;
    const mockReq2 = { url: 'http://localhost/api/posts' } as any;
    expect(trie.get_responder(mockReq1, {})?.handler).toBe(userRoute);
    expect(trie.get_responder(mockReq2, {})?.handler).toBe(postRoute);
  });

  test('Trie prioritizes exact matches over parameterized', () => {
    const trie = new Trie('GET');
    const exactRoute: JetRoute = function (ctx) {
      ctx.send({ type: 'exact' });
    };
    const paramRoute: JetRoute = function (ctx) {
      ctx.send({ type: 'param' });
    };

    // Both should be insertable
    trie.insert('/api/users/me', exactRoute);
    trie.insert('/api/users/:id', paramRoute);

    // Exact match should be returned for exact path
    const mockReq1 = { url: 'http://localhost/api/users/me' } as any;
    const exactResult = trie.get_responder(mockReq1, {});
    expect(exactResult?.handler).toBe(exactRoute);

    // Parameterized match should be returned for parameter path
    const mockReq2 = { url: 'http://localhost/api/users/123' } as any;
    const paramResult = trie.get_responder(mockReq2, {});
    expect(paramResult?.handler).toBe(paramRoute);
    expect(paramResult?.params?.id).toBe('123');
  });
});
