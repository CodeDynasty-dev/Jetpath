<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Error Handling

Robust error handling is essential for creating reliable APIs. Jetpath centralizes error handling in middleware for consistent error management.

## Philosophy

Instead of scattered `try...catch` blocks, Jetpath's approach relies on:

1. **Signaling Errors:** Using `ctx.throw()` or `throw new Error()`
2. **Centralized Catching:** Intercepting errors in middleware
3. **Standardized Responses:** Sending consistent error responses

## Throwing Errors

When processing cannot continue normally, signal an error using `ctx.throw()`.

### Using `ctx.throw()`

The `ctx.throw(codeOrData, message?)` method signals HTTP errors:

- **Common Status Codes:**
  - `400 Bad Request`: Validation errors
  - `401 Unauthorized`: Authentication issues
  - `403 Forbidden`: Permission denied
  - `404 Not Found`: Resource not found
  - `500 Internal Server Error`: Unexpected issues

- **Examples:**
  ```typescript
  // Resource Not Found
  if (!pet) {
    ctx.throw(404, `Pet ${ctx.params.id} not found`);
  }

  // Unauthorized Access
  if (!ctx.plugins.verifyAuth(ctx).authenticated) {
    ctx.set("WWW-Authenticate", "Bearer realm=\"protected\"");
    ctx.throw(401, "Authentication required");
  }

  // Forbidden Action
  if (ctx.app.user?.role !== 'admin') {
    ctx.throw(403, "Admin privileges required");
  }

  // Validation Error
  try {
    const data = ctx.validate(RequestSchema);
  } catch (err) {
    ctx.throw(400, err.message);
  }

  // Simple Not Found
  ctx.throw(404);
  ```

### Using `throw new Error()`

For unexpected internal errors:

```typescript
try {
  const result = await riskyOperation();
} catch (error) {
  console.error("Internal error:", error);
  throw new Error("Internal processing error");
}
```

## Middleware Error Handling

The post-handler function in middleware handles errors from route handlers and validation.

### Error Handling Structure

```typescript
return (ctx, err?: Error) => {
  if (err) {
    // 1. Log error
    console.error({
      message: `Request Error: ${err.message}`,
      stack: err.stack,
      requestId: ctx.get("X-Request-ID"),
      url: ctx.request.url,
      method: ctx.request.method,
    });
    // 2. Set status code
    ctx.code = ctx.code >= 400 ? ctx.code : 500;
    // 3. Format response
    const errorMessage = (ctx.code >= 500 && process.env.NODE_ENV === 'production')
      ? "Internal Server Error"
      : err.message || "An unexpected error occurred";
    const errorResponse = {
      error: {
        message: errorMessage,
        code: ctx.code,
        requestId: ctx.get("X-Request-ID"),
      },
      timestamp: new Date().toISOString(),
    };
    // 4. Send response
    ctx.set("Content-Type", "application/json");
    ctx.send(errorResponse);
    // 5. Stop processing
    return;
  }
  // Handle successful responses
};
```

## Error Cases

- **404 Not Found:** Send 404 response if no error and no response was sent
- **400 Bad Request:** Use `ctx.throw(400)` for validation errors
- **401 Unauthorized:** Use `ctx.throw(401)` with `WWW-Authenticate` header
- **403 Forbidden:** Use `ctx.throw(403)` for permission issues
- **500 Internal Error:** Handle unexpected errors with generic messages

## Best Practices

- **Centralize:** Implement error handling in global middleware
- **Standardize:** Use consistent JSON structure for error responses
- **Log Effectively:** Include request context in error logs
- **Secure:** Never leak sensitive information in production
- **Use `ctx.throw()`:** Prefer it for HTTP-specific errors

## Next Steps

- Review the [Middleware](./middleware.html) documentation
- Learn about the [Context (`ctx`) Object](./context.html) methods

</docmach>
