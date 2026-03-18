<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 
 
# Testing

Jetpath ships with a built-in `JetServer` class designed for testing your routes, middleware, and validation without starting a real HTTP server. Tests run with [Bun's test runner](https://bun.sh/docs/cli/test) (`bun:test`).

## Setup

Install Bun if you haven't already, then run tests from your project root:

```bash
bun test              # run all tests
bun test test/        # run tests in a specific directory
bun test --watch      # re-run on file changes
```

Test files follow the naming convention `*.test.ts` and live in a `test/` directory.

## JetServer — The Test Harness

`JetServer` lets you execute route handlers in isolation. No port binding, no network — just your handler logic and a result object.

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { JetServer } from 'jetpath';
import type { JetRoute } from 'jetpath';

describe('My API', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('GET /health returns 200', async () => {
    const GET_health: JetRoute = function (ctx) {
      ctx.send({ status: 'ok' });
    };
    GET_health.method = 'GET';
    GET_health.path = '/health';

    const result = await jetServer.runBare(GET_health);

    expect(result.code).toBe(200);
    expect(result.body.status).toBe('ok');
  });
});
```

Every `result` returned by `JetServer` has this shape:

```typescript
{
  code: number; // HTTP status code
  body: any; // parsed response body (JSON auto-parsed)
  headers: Record<string, string>; // response headers
}
```

## Two Ways to Run Routes

### `runBare(route)` — Quick and Simple

Creates a minimal mock context internally. Use this when your handler doesn't need a real `Request` object (no body parsing, no custom headers).

```typescript
const GET_users: JetRoute = function (ctx) {
  ctx.send({ users: [{ id: 1, name: 'Alice' }] });
};
GET_users.method = 'GET';
GET_users.path = '/users';

const result = await jetServer.runBare(GET_users);
expect(result.code).toBe(200);
expect(result.body.users).toHaveLength(1);
```

### `runWithCTX(route, ctx)` — Full Control

Use `createCTX()` to build a context with a real `Request`, path params, and headers. Required when testing body parsing, query strings, cookies, or auth headers.

```typescript
const POST_users: JetRoute = async function (ctx) {
  const body = await ctx.parse();
  ctx.send({ name: body.name, created: true }, 201);
};
POST_users.method = 'POST';
POST_users.path = '/users';

const req = new Request('http://localhost/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
});

const ctx = jetServer.createCTX(req, new Response(), '/users', POST_users, {});
const result = await jetServer.runWithCTX(POST_users, ctx);

expect(result.code).toBe(201);
expect(result.body.name).toBe('Alice');
```

### `createCTX()` Signature

```typescript
jetServer.createCTX(
  req: Request,        // the incoming request
  res: Response,       // pass `new Response()` (placeholder for non-Node runtimes)
  path: string,        // the matched route path
  handler: JetRoute,   // the route handler
  params: Record<string, any>  // path parameters (e.g. { id: "123" })
): JetContext
```

## Testing Path Parameters

```typescript
const GET_users_$id: JetRoute = function (ctx) {
  ctx.send({ userId: ctx.params.id });
};
GET_users_$id.method = 'GET';
GET_users_$id.path = '/users/:id';

const req = new Request('http://localhost/users/42');
const ctx = jetServer.createCTX(
  req,
  new Response(),
  '/users/42',
  GET_users_$id,
  { id: '42' }
);

const result = await jetServer.runWithCTX(GET_users_$id, ctx);
expect(result.body.userId).toBe('42');
```

## Testing Status Codes and Content Types

```typescript
test('custom status code', async () => {
  const route: JetRoute = function (ctx) {
    ctx.send({ brewed: true }, 418); // I'm a teapot
  };
  route.method = 'GET';
  route.path = '/teapot';

  const result = await jetServer.runBare(route);
  expect(result.code).toBe(418);
});

test('redirect sets Location header', async () => {
  const route: JetRoute = function (ctx) {
    ctx.redirect('/new-location');
  };
  route.method = 'GET';
  route.path = '/old';

  const result = await jetServer.runBare(route);
  expect(result.code).toBe(301);
  expect(result.headers['Location']).toBe('/new-location');
});

test('HTML content type', async () => {
  const route: JetRoute = function (ctx) {
    ctx.send('<h1>Hello</h1>', 200, 'text/html');
  };
  route.method = 'GET';
  route.path = '/page';

  const result = await jetServer.runBare(route);
  expect(result.headers['Content-Type']).toBe('text/html');
  expect(typeof result.body).toBe('string');
});
```

## Testing Middleware

Attach middleware to a route via the `jet_middleware` array. Middleware runs before the handler and can inject state, short-circuit the request, or handle errors via a returned callback.

### Middleware That Injects State

```typescript
import type { JetMiddleware } from 'jetpath';

const authMiddleware: JetMiddleware = function (ctx) {
  ctx.state.user = { id: 'user-123', role: 'admin' };
};

const GET_profile: JetRoute = function (ctx) {
  ctx.send({ user: ctx.state.user });
};
GET_profile.method = 'GET';
GET_profile.path = '/profile';
GET_profile.jet_middleware = [authMiddleware];

const result = await jetServer.runBare(GET_profile);
expect(result.body.user.id).toBe('user-123');
```

### Middleware That Blocks Requests

```typescript
const authGuard: JetMiddleware = function (ctx) {
  const token = ctx.get('authorization');
  if (!token || !token.startsWith('Bearer ')) {
    ctx.send({ error: 'Unauthorized' }, 401);
    return; // short-circuit — handler never runs
  }
  ctx.state.user = { id: 'user-123' };
};

const route: JetRoute = function (ctx) {
  ctx.send({ message: 'Protected data' });
};
route.method = 'GET';
route.path = '/protected';
route.jet_middleware = [authGuard];

// Without auth header → blocked
const result = await jetServer.runBare(route);
expect(result.code).toBe(401);

// With auth header → allowed
const req = new Request('http://localhost/protected', {
  headers: { Authorization: 'Bearer my-token' },
});
const ctx = jetServer.createCTX(req, new Response(), '/protected', route, {});
const authed = await jetServer.runWithCTX(route, ctx);
expect(authed.code).toBe(200);
```

### Middleware Execution Order

Middleware runs in array order. Post-handler callbacks (returned functions) run in reverse order. This gives you a clean "onion" pattern:

```typescript
const order: string[] = [];

const mw1: JetMiddleware = function (ctx) {
  order.push('mw1-pre');
  return () => {
    order.push('mw1-post');
  };
};

const mw2: JetMiddleware = function (ctx) {
  order.push('mw2-pre');
  return () => {
    order.push('mw2-post');
  };
};

const route: JetRoute = function (ctx) {
  order.push('handler');
  ctx.send({ order });
};
route.method = 'GET';
route.path = '/order';
route.jet_middleware = [mw1, mw2];

await jetServer.runBare(route);
// order === ["mw1-pre", "mw2-pre", "handler", "mw2-post", "mw1-post"]
```

### Error Handling Middleware

The returned callback receives a second `error` argument when the handler throws:

```typescript
const errorHandler: JetMiddleware = function (ctx) {
  return (ctx, error) => {
    if (error) {
      ctx.code = 500;
      ctx.send({ error: 'Internal Server Error', message: error.message });
    }
  };
};

const route: JetRoute = function (ctx) {
  throw new Error('Something broke');
};
route.method = 'GET';
route.path = '/fail';
route.jet_middleware = [errorHandler];

const result = await jetServer.runBare(route);
expect(result.code).toBe(500);
expect(result.body.message).toBe('Something broke');
```

## Testing Validation

### Body Validation with `use()`

Attach schemas via `use()`, then test that `ctx.parse()` enforces them:

```typescript
import { use } from 'jetpath';

const POST_signup: JetRoute = async function (ctx) {
  const body = await ctx.parse();
  ctx.send({ email: body.email, ok: true });
};
POST_signup.method = 'POST';
POST_signup.path = '/signup';

use(POST_signup).body((t) => ({
  email: t.string().required().email(),
  password: t.string().required().min(8),
}));

// Valid data → 200
const validReq = new Request('http://localhost/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'secret99' }),
});
const validCtx = jetServer.createCTX(
  validReq,
  new Response(),
  '/signup',
  POST_signup,
  {}
);
const ok = await jetServer.runWithCTX(POST_signup, validCtx);
expect(ok.code).toBe(200);

// Invalid data → error
const badReq = new Request('http://localhost/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
});
const badCtx = jetServer.createCTX(
  badReq,
  new Response(),
  '/signup',
  POST_signup,
  {}
);
const fail = await jetServer.runWithCTX(POST_signup, badCtx);
expect(fail.code).toBeGreaterThanOrEqual(400);
```

### Response Validation

Response schemas are checked when `ctx.send()` is called with an object:

```typescript
const GET_data: JetRoute = function (ctx) {
  ctx.send({ name: 'Alice', count: 42 });
};
GET_data.method = 'GET';
GET_data.path = '/data';

use(GET_data).response((t) => ({
  name: t.string().required(),
  count: t.number().required(),
}));

const result = await jetServer.runBare(GET_data);
expect(result.code).toBe(200);
expect(result.body.name).toBe('Alice');
```

If the response doesn't match the schema, the handler throws and returns a 500:

```typescript
const GET_bad: JetRoute = function (ctx) {
  ctx.send({ name: 'Alice' }); // missing required `count`
};
GET_bad.method = 'GET';
GET_bad.path = '/bad';

use(GET_bad).response((t) => ({
  name: t.string().required(),
  count: t.number().required(),
}));

const result = await jetServer.runBare(GET_bad);
expect(result.code).toBe(500);
```

### Query Validation

```typescript
const GET_search: JetRoute = function (ctx) {
  const query = ctx.parseQuery();
  ctx.send({ q: query.q });
};
GET_search.method = 'GET';
GET_search.path = '/search';

use(GET_search).query((t) => ({
  q: t.string().required(),
}));

const req = new Request('http://localhost/search?q=jetpath');
const ctx = jetServer.createCTX(req, new Response(), '/search', GET_search, {});
const result = await jetServer.runWithCTX(GET_search, ctx);
expect(result.body.q).toBe('jetpath');
```

### Testing the Validator Directly

You can also test the `validator()` function in isolation for unit-level schema checks:

```typescript
import { validator } from 'jetpath/primitives/validator';

test('strips unknown fields', () => {
  const schema = { name: { type: 'string', required: true } };
  const result = validator(schema, { name: 'Alice', isAdmin: true });
  expect(result.name).toBe('Alice');
  expect(result.isAdmin).toBeUndefined(); // mass-assignment protection
});

test('throws on missing required field', () => {
  const schema = { name: { type: 'string', required: true } };
  expect(() => validator(schema, {})).toThrow('name is required');
});
```

## Testing Cookies

```typescript
test('setCookie appears in response headers', async () => {
  const route: JetRoute = function (ctx) {
    ctx.setCookie('session', 'abc123', { httpOnly: true, maxAge: 3600 });
    ctx.setCookie('theme', 'dark', { path: '/' });
    ctx.send({ ok: true });
  };
  route.method = 'GET';
  route.path = '/login';

  const result = await jetServer.runBare(route);
  expect(result.headers['set-cookie']).toContain('session=abc123');
  expect(result.headers['set-cookie']).toContain('HttpOnly');
  expect(result.headers['set-cookie']).toContain('theme=dark');
});
```

## Testing the Trie Router

You can test route matching directly against the `Trie` data structure:

```typescript
import { Trie } from 'jetpath/primitives/trie-router';

test('exact path match', () => {
  const trie = new Trie('GET');
  const route: JetRoute = function (ctx) {
    ctx.send({ ok: true });
  };
  trie.insert('/api/users', route);

  const req = { url: 'http://localhost/api/users' } as any;
  const result = trie.get_responder(req, {});
  expect(result?.handler).toBe(route);
});

test('parameter extraction', () => {
  const trie = new Trie('GET');
  const route: JetRoute = function (ctx) {
    ctx.send({});
  };
  trie.insert('/users/:id', route);

  const req = { url: 'http://localhost/users/42' } as any;
  const result = trie.get_responder(req, {});
  expect(result?.params?.id).toBe('42');
});

test('wildcard match', () => {
  const trie = new Trie('GET');
  const route: JetRoute = function (ctx) {
    ctx.send({});
  };
  trie.insert('/files/*', route);

  const req = { url: 'http://localhost/files/images/photo.jpg' } as any;
  const result = trie.get_responder(req, {});
  expect(result?.params?.['*']).toBe('images/photo.jpg');
});
```

## Testing CORS Configuration

```typescript
import { corsMiddleware } from 'jetpath/primitives/cors';
import { _rebuildCorsCloner } from 'jetpath/primitives/trie-router';

test('CORS headers are set on responses', async () => {
  corsMiddleware({
    origin: ['https://example.com'],
    credentials: true,
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type', 'Authorization'],
  });
  _rebuildCorsCloner();

  const route: JetRoute = function (ctx) {
    ctx.send({ ok: true });
  };
  route.method = 'GET';
  route.path = '/api';

  const result = await jetServer.runBare(route);
  expect(result.headers['Access-Control-Allow-Origin']).toBe(
    'https://example.com'
  );
  expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
});
```

## Testing Error Scenarios

```typescript
test('unhandled throw returns 500', async () => {
  const route: JetRoute = function (ctx) {
    throw new Error('Unexpected failure');
  };
  route.method = 'GET';
  route.path = '/crash';

  const result = await jetServer.runBare(route);
  expect(result.code).toBe(500);
});

test('custom error code', async () => {
  const route: JetRoute = function (ctx) {
    ctx.send({ error: 'Not found' }, 404);
  };
  route.method = 'GET';
  route.path = '/missing';

  const result = await jetServer.runBare(route);
  expect(result.code).toBe(404);
  expect(result.body.error).toBe('Not found');
});
```

## Schema Builder Reference for Tests

The `v` builder (from `use()`) supports these types:

| Builder                | Methods                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `v.string()`           | `.required()`, `.min(n)`, `.max(n)`, `.email()`, `.url()`, `.regex(pattern)`, `.default(val)` |
| `v.number()`           | `.required()`, `.min(n)`, `.max(n)`, `.integer()`, `.positive()`, `.negative()`               |
| `v.boolean()`          | `.required()`                                                                                 |
| `v.array(itemSchema?)` | `.required()`, `.min(n)`, `.max(n)`, `.nonempty()`                                            |
| `v.object(shape?)`     | `.required()`, `.shape({...})`                                                                |
| `v.date()`             | `.required()`, `.min(date)`, `.max(date)`, `.future()`, `.past()`                             |
| `v.file()`             | `.required()`, `.maxSize(bytes)`, `.mimeType(types)`                                          |

All builders also support `.optional()`, `.default(value)`, `.validate(fn)`, and `.regex(pattern)`.

## Tips

- Use `runBare()` for simple handlers that don't need request parsing — it's faster and less boilerplate.
- Use `runWithCTX()` when you need to test body parsing, headers, cookies, or query strings.
- Middleware is attached directly to the route's `jet_middleware` array in tests — no file-system scanning needed.
- The `use()` API works the same in tests as in production code. Attach schemas before running the route.
- Tests run against the real framework internals (context pooling, validation, CORS) — not mocks. What passes in tests will behave the same in production.
- Run `bun test --watch` during development for instant feedback.

</docmach>
