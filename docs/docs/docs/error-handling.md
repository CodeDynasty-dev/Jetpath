<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Error Handling

Robust error handling is essential for creating reliable APIs. Jetpath centralizes error handling in middleware for consistent error management.

## Philosophy

Instead of scattered `try...catch` blocks, Jetpath's approach relies on:

1. **Signaling Errors:** Using `ctx.send(message, statusCode)` or `throw new Error()`
2. **Centralized Catching:** Intercepting errors in middleware post-handlers
3. **Standardized Responses:** Sending consistent error responses from one place

## Signaling Errors

### Using `ctx.send()` with a Status Code

The `ctx.send()` method accepts `(data, statusCode?, contentType?)`. Use it to send error responses directly:

```typescript
// Resource Not Found
if (!pet) {
  ctx.send({ error: `Pet ${ctx.params.id} not found` }, 404);
  return;
}

// Unauthorized Access
const auth = ctx.plugins.verifyAuth(ctx);
if (!auth.authenticated) {
  ctx.set("WWW-Authenticate", "Bearer");
  ctx.send({ error: "Authentication required" }, 401);
  return;
}

// Forbidden Action
if (ctx.state.user?.role !== 'admin') {
  ctx.send({ error: "Admin privileges required" }, 403);
  return;
}
```

### Using `throw new Error()`

For unexpected internal errors, throw and let middleware handle it:

```typescript
try {
  const result = await riskyOperation();
} catch (error) {
  console.error("Internal error:", error);
  throw new Error("Internal processing error");
}
```

When a route handler throws, Jetpath catches the error and passes it to the middleware post-handler's `err` parameter.

## Middleware Error Handling

The post-handler function returned by middleware receives both `ctx` and an optional `err` parameter. This is where you centralize all error handling.

### Complete Example

```typescript
import { type JetMiddleware } from "jetpath";

export const MIDDLEWARE_: JetMiddleware = (ctx) => {
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  ctx.set("X-Request-ID", requestId);

  // Post-handler: runs after route handler (or on error)
  return (ctx, err) => {
    const duration = Date.now() - startTime;
    ctx.set("X-Response-Time", `${duration}ms`);

    if (err) {
      // 1. Determine status code
      ctx.code = ctx.code >= 400 ? ctx.code : 500;

      // 2. Log the error
      console.error({
        requestId,
        error: String(err),
        code: ctx.code,
        url: ctx.request.url,
        duration,
      });

      // 3. Send standardized error response
      const message = ctx.code >= 500 && process.env.NODE_ENV === 'production'
        ? "Internal Server Error"
        : String(err) || "An unexpected error occurred";

      ctx.send({
        status: "error",
        message,
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Successful response logging
    console.log(`${ctx.request.method} ${ctx.path} → ${ctx.code} (${duration}ms)`);
  };
};
```

## How Errors Flow

1. Route handler throws an error (or validation fails)
2. Jetpath catches the error internally
3. All post-handler middleware functions are called with `(ctx, err)`
4. The first middleware that calls `ctx.send()` sends the response
5. If no middleware handles the error, a generic 500 is returned

## Validation Errors

When `ctx.parse()` or `ctx.parseQuery()` encounters data that doesn't match the schema defined via `use(route).body()` or `use(route).query()`, a validation error is thrown automatically. Your error middleware catches it like any other error:

```typescript
// The error message will contain details like "name is required, email is incorrect"
// Your middleware's err parameter receives this as an Error object
```

## Best Practices

- Centralize error handling in a global `MIDDLEWARE_` export
- Use consistent JSON structure for all error responses
- Include a request ID in error responses for debugging
- Never leak stack traces or internal details in production
- Use `ctx.send(data, statusCode)` for expected errors (404, 401, 403)
- Let unexpected errors throw and be caught by middleware
- Log errors with enough context (request ID, URL, duration) to debug later

## Next Steps

- Review the [Middleware](./middleware.html) documentation
- Learn about the [Context (`ctx`) Object](./context.html) methods

</docmach>
