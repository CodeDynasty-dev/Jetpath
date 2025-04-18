<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">
  
# Error Handling

Robust error handling is essential for creating reliable and user-friendly APIs. Jetpath encourages centralizing error handling logic within your **middleware**, providing a consistent way to catch errors, log them, and send standardized responses to the client.

---

## Philosophy

Instead of scattering `try...catch` blocks throughout your route handlers for common errors, Jetpath's approach relies on:

1.  **Signaling Errors:** Using `ctx.throw()` or standard `throw new Error()` within route handlers or preceding middleware logic when something goes wrong.
2.  **Centralized Catching:** Intercepting these thrown errors within the **post-handler function returned by your middleware**.
3.  **Standardized Responses:** Formatting and sending consistent error responses from the middleware's error handling block.

---

## Throwing Errors

When you encounter a situation in your route handler (or pre-handler middleware logic) where processing cannot continue normally, you should signal an error. The preferred way is using `ctx.throw()`.

### Using `ctx.throw()`

The `ctx.throw(codeOrData, message?)` method is designed specifically for signaling HTTP-related errors. It sets the `ctx.code` (status code) and attaches an error message, then throws an error that interrupts the current execution flow.

* **Common Status Codes:**
    * `400 Bad Request`: Validation errors, malformed requests.
    * `401 Unauthorized`: Missing or invalid authentication credentials.
    * `403 Forbidden`: Authenticated user lacks permission for the action.
    * `404 Not Found`: Resource doesn't exist.
    * `500 Internal Server Error`: Unexpected server-side issues.

* **Examples:**
    ```typescript
    // 1. Resource Not Found
    if (!pet) {
      ctx.throw(404, `Pet with ID ${ctx.params.id} not found`);
    }

    // 2. Unauthorized Access
    const authResult = ctx.plugins.verifyAuth(ctx);
    if (!authResult.authenticated) {
      ctx.set("WWW-Authenticate", "Bearer realm=\"protected\""); // Set relevant header
      ctx.throw(401, authResult.message || "Authentication required");
    }

    // 3. Forbidden Action
    if (ctx.app.user?.role !== 'admin') {
      ctx.throw(403, "Admin privileges required");
    }

    // 4. Validation Error (Bad Request)
    try {
      const validatedData = ctx.validate(RequestSchema);
    } catch (validationError) {
      // Pass validation message, set code to 400
      ctx.throw(400, validationError.message);
    }

    // 5. Simple Not Found (message optional)
    ctx.throw(404);
    ```
    *[cite: examples inspired by logic in tests/app.jet.ts]*

### Using `throw new Error()`

You can also use standard JavaScript `throw new Error("Something broke")`. This is suitable for unexpected internal errors. When caught by the middleware, `ctx.code` might not be set, so your middleware should typically default to a `500 Internal Server Error` status code in these cases.

```typescript
try {
  const result = await riskyOperation();
} catch (internalError) {
  console.error("Internal operation failed:", internalError);
  // Let the middleware handle formatting, just throw
  throw new Error("Internal processing error occurred.");
}
````

-----

## Handling Errors in Middleware

The **post-handler function** returned by your `MIDDLEWARE_` definition is the primary location for catching and handling errors thrown from route handlers, validation logic (`ctx.validate`), or the pre-handler part of the middleware itself.

### The `err` Parameter

This function receives the `ctx` object and an optional second argument, typically named `err`.

  * If the route handler and pre-handler logic completed **without throwing**, `err` will be `undefined`.
  * If any error **was thrown** (using `ctx.throw()` or `throw new Error()`), `err` will be the `Error` object that was thrown.

### Middleware Error Handling Block

Here’s how to structure the error handling within your middleware's returned function, based on the example in `tests/app.jet.ts`:

```typescript
// Inside the function returned by MIDDLEWARE_
return (ctx, err?: Error) => {
  // =========================
  // === POST-HANDLER CODE ===
  // =========================
  const duration = Date.now() - startTime; // Assuming startTime from pre-handler
  ctx.set("X-Response-Time", `${duration}ms`);

  // --- Central Error Handling Logic ---
  if (err) {
    // 1. Log the error (essential for debugging)
    // Use a proper logger plugin in production
    console.error({
      message: `Request Error: ${err.message}`,
      stack: err.stack,
      requestId: ctx.get("X-Request-ID"), // Include request context
      url: ctx.request.url,
      method: ctx.request.method,
    });
    // Example with logger plugin:
    // ctx.plugins.logger?.error({ error: err.message, stack: err.stack, code: ctx.code, requestId: ctx.get("X-Request-ID") });

    // 2. Determine the Status Code
    // Use ctx.code if it was set by ctx.throw() or before throwing.
    // Default to 500 for unexpected errors (where ctx.code might still be 200 or unset).
    ctx.code = ctx.code >= 400 ? ctx.code : 500;

    // 3. Format the Error Response Body
    // Avoid leaking sensitive stack traces in production for 5xx errors!
    const errorMessage = (ctx.code >= 500 && process.env.NODE_ENV === 'production')
      ? "Internal Server Error"
      : err.message || "An unexpected error occurred";

    const errorResponse = {
      error: {
        message: errorMessage,
        code: ctx.code,
        requestId: ctx.get("X-Request-ID"), // Helpful for tracing
        // Optionally include validation details for 400 errors if safe
        // details: (ctx.code === 400 && err.details) ? err.details : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    // 4. Send the Error Response
    // Ensure correct Content-Type (usually application/json)
    ctx.set("Content-Type", "application/json");
    ctx.send(errorResponse);

    // 5. IMPORTANT: Stop further processing
    // Prevent subsequent logic (like 404 checks) from running
    return;
  } // --- End of Error Handling ---

  // ... Handle successful responses or 404s if no error occurred ...
  // (As shown in the Middleware documentation page)
};
```

*[cite: Based on error handling logic in `MIDDLEWARE_` in tests/app.jet.ts]*

-----

## Specific Error Examples

  * **404 Not Found:** If `err` is `undefined` (no error thrown) *and* the route handler didn't send a response, your post-handler middleware logic should detect this (e.g., by checking `ctx.response.status === 404` or if `ctx.response.body` is null/undefined) and send a standard 404 response.
  * **400 Bad Request (Validation):** When `ctx.validate()` fails, it throws an error. Your middleware catches this. `ctx.throw(400, validationError.message)` is a good way to trigger this from the handler, ensuring the middleware sets code 400 and uses the validation message.
  * **401 Unauthorized / 403 Forbidden:** Throw these using `ctx.throw(401, "...")` or `ctx.throw(403, "...")`. The middleware catches them and sends the response using the specified code and message. Consider adding appropriate headers like `WWW-Authenticate` via `ctx.set()` before throwing 401.
  * **500 Internal Server Error:** Catch unexpected errors (e.g., from `throw new Error()` or database issues). Set `ctx.code = 500` and send a generic error message in production to avoid leaking implementation details. Log the full error server-side.

-----

## Best Practices

  * **Centralize:** Implement your primary error handling in global middleware for consistency.
  * **Standardize Responses:** Use a consistent JSON structure for error responses (e.g., `{ error: { message: string, code: number, requestId?: string } }` or follow RFC 7807 Problem Details).
  * **Log Effectively:** Log errors with sufficient context (request ID, URL, user ID if available, full stack trace) on the server.
  * **Don't Leak Sensitive Information:** Avoid sending stack traces or detailed internal error messages to the client, especially for 5xx errors in production environments.
  * **Use `ctx.throw()`:** Prefer `ctx.throw()` for signaling HTTP-specific errors with appropriate status codes.

-----

## Next Steps

  * Review the [**Middleware**](https://www.google.com/search?q=./middleware.md) documentation for the full middleware structure.
  * See how the [**Context (`ctx`) Object**](https://www.google.com/search?q=./context.md) methods (`throw`, `send`, `code`, `set`) are used.
 
</docmach>



