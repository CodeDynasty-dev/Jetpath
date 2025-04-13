<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">
  
# Core Concepts: Middleware

Middleware functions are a fundamental part of building applications with JetPath. They allow you to execute code **before** your route handler runs and **after** it completes, enabling you to implement cross-cutting concerns like logging, authentication, data validation, error handling, and response formatting in a clean, reusable way.

---

## What is Middleware?

Think of middleware as functions that sit in the middle of the request-response cycle. They can:

* Execute any code.
* Make changes to the request and response objects (`ctx`).
* End the request-response cycle (e.g., by sending a response early for authentication failures).
* Call the next middleware or route handler in the stack.
* Execute code after the route handler has finished (e.g., for logging or final response modification).

---

## Defining Middleware

In JetPath, middleware is typically defined by exporting a special function named `MIDDLEWARE_` from a `.jet.ts` file.

* **Structure:** A JetPath middleware function takes the `ctx` (Context) object as its argument and **must return another function**. This inner function represents the post-handler logic and receives `ctx` and an optional `err` object.

```typescript
import { type JetMiddleware, type JetContext } from "jetpath";

// Define expected types for plugins if used in middleware
// Example: Assuming AuthPlugin and LoggerPlugin types exist
type AppPlugins = [typeof AuthPluginInstance, typeof LoggerPluginInstance];
// Define expected type for application state attached to ctx.app
type AppState = { user?: { id: string; role: string } };

export const MIDDLEWARE_: JetMiddleware<AppState, AppPlugins> = (ctx: JetContext<AppState, AppPlugins>) => {
  // ========================
  // === PRE-HANDLER CODE ===
  // ========================
  // This code runs BEFORE the route handler executes.
  console.log(`--> Request Start: ${ctx.request.method} ${ctx.request.url}`);
  const startTime = Date.now();
  ctx.set("X-Request-ID", crypto.randomUUID()); // Example: Add request ID header

  // Example: Authentication Check (can call plugins)
  // const isPublic = ctx.request.url.startsWith('/public');
  // if (!isPublic) {
  //   const authResult = ctx.plugins.verifyAuth(ctx); // Assuming verifyAuth plugin exists
  //   if (!authResult.authenticated) {
  //     ctx.code = 401;
  //     ctx.throw("Authentication Required"); // Throwing ends cycle here, goes to post-handler error part
  //   }
  //   ctx.app.user = authResult.user; // Attach user to context app state
  // }


  // === RETURN POST-HANDLER FUNCTION ===
  return (ctx: JetContext<AppState, AppPlugins>, err?: Error) => {
    // =========================
    // === POST-HANDLER CODE ===
    // =========================
    // This code runs AFTER the route handler finishes OR if an error occurs.

    const duration = Date.now() - startTime;
    ctx.set("X-Response-Time", `${duration}ms`); // Example: Add response time header

    // --- Error Handling ---
    if (err) {
      console.error(`!!! Request Error: ${err.message}`, err.stack);
      // Set status code if not already set by ctx.throw or validation
      ctx.code = ctx.code >= 400 ? ctx.code : 500;

      // Log the error (e.g., using a logger plugin)
      // ctx.plugins.logger?.error({ error: err.message, stack: err.stack, code: ctx.code });

      // Send a standardized error response
      ctx.send({
        error: {
          message: ctx.code < 500 ? err.message : "Internal Server Error",
          requestId: ctx.get("X-Request-ID"),
          code: ctx.code,
        },
      });
      return; // Stop further processing after sending error response
    }

    // --- 404 Handling ---
    // Check if a response was already sent by the handler
    // (Note: Exact check might depend on underlying response object state)
    const responseSent = ctx.response.status !== 404 || ctx.response.body != null;
    if (!responseSent) {
      ctx.code = 404;
      ctx.send({
        error: {
          message: "Not Found",
          requestId: ctx.get("X-Request-ID"),
          code: 404,
        }
      });
      return; // Stop further processing
    }

    // --- Successful Response Logging ---
    console.log(`<-- Request End: ${ctx.request.method} ${ctx.request.url} ${ctx.code} ${duration}ms`);
    // Log success (e.g., using a logger plugin)
    // ctx.plugins.logger?.info({ status: ctx.code, duration });
  };
};
````

*[Based on middleware structure in `tests/app.jet.ts`]*

### Key Points about the Structure:

  * **Pre-Handler Logic:** Code written directly inside the exported `MIDDLEWARE_` function runs *before* the specific route handler is invoked.
  * **Post-Handler Logic:** Code written inside the *returned function* runs *after* the route handler completes (either successfully or by throwing an error).
  * **`err` Parameter:** The `err` parameter in the returned function will contain an `Error` object if the route handler (or preceding middleware/validation) threw an error. Otherwise, it will be `undefined`.
  * **Ending the Cycle:** You can send a response (`ctx.send()`) or throw an error (`ctx.throw()`) in the pre-handler logic to prevent the route handler from running. You *must* handle sending a response in the post-handler logic if an error occurred or if the route handler didn't send one itself (e.g., for 404s).

-----

## Execution Flow & Order

1.  JetPath matches the incoming request to a route handler.
2.  The **pre-handler** section of the most relevant `MIDDLEWARE_` function executes. *(See Scoping below)*.
3.  **(If not ended early)** The route handler function executes.
4.  The **post-handler** section (the returned function) of the `MIDDLEWARE_` function executes, receiving the context and any error that occurred.

If multiple middleware functions apply (e.g., global and folder-level - see Scoping), the pre-handler sections execute from general to specific, and the post-handler sections execute in the reverse order (specific to general).

-----

## Scoping Middleware

*(Note: The provided example `tests/app.jet.ts` only explicitly shows a global middleware defined in the main app file. The following describes common patterns for scoping in file-based frameworks, which JetPath might implement or could adopt.)*

Middleware can potentially be scoped to apply globally or only to specific parts of your API:

  * **Global Middleware:** Defining `MIDDLEWARE_` in your main application entry file (`app.jet.ts` in the example) or the root `src/index.jet.ts` likely applies it to *all* incoming requests.
  * **Directory/Layout Middleware (Potential Pattern):** Frameworks often allow defining middleware in special files within subdirectories (e.g., `src/admin/_middleware.jet.ts` or `src/admin/_layout.jet.ts`). Such middleware would apply only to routes defined within that directory and its subdirectories, executing after global middleware but before the specific route handler. This allows applying specific logic (like admin authentication checks) only where needed. *[Confirmation needed from JetPath specifics if this pattern is supported].*

-----

## Common Use Cases

Middleware is ideal for handling:

  * **Logging:** Recording request start/end times, methods, URLs, status codes.
  * **Authentication:** Verifying tokens or session cookies before granting access to protected routes.
  * **Authorization:** Checking user roles or permissions after authentication.
  * **Data Validation/Sanitization:** Performing preliminary checks or sanitizing input (though route-specific schema validation is often preferred for core validation).
  * **Response Formatting:** Adding common headers (like `X-Request-ID`, `X-Response-Time`, CORS headers) or standardizing the JSON response structure.
  * **Error Handling:** Catching all errors from handlers/validation and sending standardized error responses.
  * **Rate Limiting:** Implementing request limits based on IP or user.

-----

## Error Handling in Middleware

The post-handler function (`return (ctx, err) => { ... }`) is the primary place to centralize error handling.

  * Check if the `err` argument exists.
  * If `err` exists:
      * Log the error details (message, stack).
      * Set an appropriate HTTP status code (`ctx.code`), often using a code already set (e.g., by `ctx.throw`) or defaulting to 500 for unexpected errors.
      * Send a user-friendly, standardized error response body.
      * **Crucially, `return`** after sending the error response to prevent further processing (like trying to send a 404 response).

-----

## Best Practices

  * **Keep Middleware Focused:** Each middleware function should ideally handle a single, specific concern (e.g., one for logging, one for auth).
  * **Order Matters:** Be mindful of the execution order, especially if one middleware depends on data prepared by another (e.g., auth middleware should run before authorization middleware).
  * **Handle Errors:** Ensure your middleware correctly handles errors passed via the `err` parameter in the post-handler function.
  * **Performance:** Middleware runs on every applicable request. Avoid slow, synchronous operations or heavy computations, especially in global middleware. Offload intensive tasks if necessary.
  * **Use `ctx.throw()`:** Use `ctx.throw(message, statusCode)` in your pre-handler logic or route handlers to signal specific HTTP errors clearly, which can then be handled uniformly by your error-handling middleware.

-----

## Next Steps

  * See how the [**Context (`ctx`) Object**](https://www.google.com/search?q=./context.md) is used within middleware and handlers.
  * Understand the complete [**Request Lifecycle**](https://www.google.com/search?q=./request-lifecycle.md).
  * Review [**Error Handling**](https://www.google.com/search?q=./error-handling.md) strategies.
 

</docmach>



