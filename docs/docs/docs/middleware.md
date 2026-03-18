<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Middleware

Middleware functions are a fundamental part of building applications with Jetpath. They allow you to implement cross-cutting concerns like logging, authentication, and error handling in a clean, reusable way.

## What is Middleware?

Middleware are functions that sit in the middle of the request-response cycle. They can:

- Execute code before and after route handlers
- Modify the request context (`ctx`)
- End the request-response cycle early (e.g., reject unauthenticated requests)
- Handle errors thrown by route handlers
- Add response headers, log requests, etc.

## Defining Middleware

In Jetpath, middleware is defined by exporting a function named `MIDDLEWARE_` from a `.jet.ts` file. The naming convention determines scope.

### Global Middleware

A bare `MIDDLEWARE_` export applies to all routes:

```typescript
import { type JetMiddleware } from "jetpath";

export const MIDDLEWARE_: JetMiddleware = (ctx) => {
  // Pre-handler: runs before the route handler
  const startTime = Date.now();
  console.log(`→ ${ctx.request.method} ${ctx.path}`);

  // Return a post-handler function
  return (ctx, err) => {
    const duration = Date.now() - startTime;

    if (err) {
      // Error handling
      ctx.code = ctx.code >= 400 ? ctx.code : 500;
      ctx.send({
        error: {
          message: ctx.code < 500 ? String(err) : "Internal Server Error",
          code: ctx.code,
        },
      });
      return;
    }

    console.log(`← ${ctx.code} (${duration}ms)`);
  };
};
```

### Scoped Middleware

Middleware can be scoped to specific path prefixes by adding the path after `MIDDLEWARE_`:

```typescript
// Applies only to routes starting with /admin
export const MIDDLEWARE_admin: JetMiddleware = (ctx) => {
  const auth = ctx.plugins.verifyAuth(ctx);
  if (!auth.authenticated || auth.user?.role !== 'admin') {
    ctx.send({ error: "Admin access required" }, 403);
    return; // Returning without a post-handler stops the chain
  }
  ctx.state.user = auth.user;

  return (ctx, err) => {
    if (err) {
      ctx.code = ctx.code >= 400 ? ctx.code : 500;
      ctx.send({ error: String(err) }, ctx.code);
    }
  };
};
```

Middleware is matched by path prefix and sorted by specificity. A `MIDDLEWARE_` (global) runs first, then `MIDDLEWARE_api`, then `MIDDLEWARE_api_admin`, etc.

## Middleware Structure

Every middleware function follows this pattern:

```typescript
const MIDDLEWARE_: JetMiddleware = (ctx) => {
  // 1. PRE-HANDLER: Runs before the route handler
  //    - Check auth, set headers, start timers, etc.
  //    - Call ctx.send() here to short-circuit (skip the route handler)

  // 2. Return a POST-HANDLER function (optional)
  return (ctx, err) => {
    // 3. POST-HANDLER: Runs after the route handler
    //    - err is defined if the handler threw
    //    - Handle errors, log responses, add headers, etc.
  };
};
```

If the pre-handler calls `ctx.send()`, the route handler is skipped and the response is sent immediately.

If the pre-handler returns `undefined` (no post-handler), the route handler runs but there's no post-processing for that middleware.

## Execution Order

When multiple middleware apply to a route:

```
Request
  → Global MIDDLEWARE_ pre-handler
    → Scoped MIDDLEWARE_api pre-handler
      → Route Handler
    ← Scoped MIDDLEWARE_api post-handler
  ← Global MIDDLEWARE_ post-handler
Response
```

Post-handlers run in reverse order (innermost first). If an error occurs, all post-handlers still run with the `err` parameter.

## Common Patterns

### Authentication

```typescript
export const MIDDLEWARE_: JetMiddleware = (ctx) => {
  const publicPaths = ['/auth/login', '/api-doc', '/health'];
  const isPublic = publicPaths.some(p => ctx.path.startsWith(p));

  if (!isPublic) {
    const auth = ctx.plugins.verifyAuth(ctx);
    if (!auth.authenticated) {
      ctx.set("WWW-Authenticate", "Bearer");
      ctx.send({ error: "Unauthorized" }, 401);
      return;
    }
    ctx.state.user = auth.user;
  }

  return (ctx, err) => {
    if (err) {
      ctx.code = ctx.code >= 400 ? ctx.code : 500;
      ctx.send({ error: String(err) }, ctx.code);
    }
  };
};
```

### Request Logging

```typescript
export const MIDDLEWARE_: JetMiddleware = (ctx) => {
  const start = Date.now();
  const id = crypto.randomUUID();
  ctx.set("X-Request-ID", id);

  return (ctx, err) => {
    const ms = Date.now() - start;
    console.log(JSON.stringify({
      id, method: ctx.request.method, path: ctx.path,
      status: ctx.code, duration: ms,
      error: err ? String(err) : undefined,
    }));
  };
};
```

## Best Practices

- Keep middleware focused on a single concern
- Use scoped middleware to avoid running unnecessary checks on every route
- Always handle the `err` parameter in post-handlers
- Avoid heavy computation in global middleware — it runs on every request
- Use `ctx.state` to pass data from middleware to route handlers (e.g., authenticated user)

## Next Steps

- Learn about the [Context (`ctx`) Object](./context.html)
- Understand the complete [Request Lifecycle](./request-lifecycle.html)
- Review [Error Handling](./error-handling.html) strategies

</docmach>
