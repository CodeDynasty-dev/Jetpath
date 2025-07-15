<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Middleware

Middleware functions are a fundamental part of building applications with Jetpath. They allow you to implement cross-cutting concerns like logging, authentication, and error handling in a clean, reusable way.

## What is Middleware?

Middleware are functions that sit in the middle of the request-response cycle. They can:

- Execute any code
- Modify request and response objects (`ctx`)
- End the request-response cycle early
- Handle errors
- Process responses after route handlers

## Defining Middleware

In Jetpath, middleware is defined by exporting a special function named `MIDDLEWARE_` from a `.jet.ts` file.

```typescript

import { type JetMiddleware } from "jetpath";

export const MIDDLEWARE_: JetMiddleware = (ctx) => {
  // Pre-handler: Initial request processing
  console.log("Start: ", ctx.request.url);
  const startTime = Date.now();
  // Post-handler: Response processing
  return (ctx, err) => {
    const duration = Date.now() - startTime;
    // Error handling
    if (err) {
      ctx.code = ctx.code >= 400 ? ctx.code : 500;
      ctx.send({
        error: {
          message: ctx.code < 500 ? err.message : "Internal Server Error",
          code: ctx.code,
        },
      });
      return;
    }
    console.log("End: ", ctx.request.url, duration + "ms");
  };
};

```

### Key Concepts

1. **Middleware Structure**
   - Pre-handler: Runs before route handler
   - Post-handler: Runs after route handler
   - Error handling: Built into post-handler
   - Response handling: Required for all cases

2. **Execution Flow**
   - Request → Pre-handler → Route Handler → Post-handler
   - Multiple middleware: Pre-handler → Pre-handler → ... → Route Handler → ... → Post-handler → Post-handler

3. **Response Handling**
   - Handle errors and 404s appropriately

4. **Error Handling**
   - Use `error` parameter in post-handler
   - Set appropriate status codes
   - Send standardized error responses
   - Return after sending response

## Scoping Middleware

Middleware can be scoped to apply globally or to specific parts of your API:

## Common Use Cases

- **Logging:** Request/response logging
- **Authentication:** Token verification
- **Authorization:** Role-based access control
- **Response Formatting:** Standard headers and response structure
- **Error Handling:** Centralized error management
- **Rate Limiting:** Request rate control

## Error Handling

Best practices for error handling in middleware:

1. Check for errors in the `err` parameter
2. Log error details
3. Set appropriate HTTP status code
4. Send standardized error response
5. Return after sending response

## Best Practices

- Keep middleware focused on single concerns
- Be mindful of execution order
- Handle errors properly
- Avoid heavy computations in global middleware 

## Next Steps

- Learn about the [Context (`ctx`) Object](./context.html)
- Understand the complete [Request Lifecycle](./request-lifecycle.html)
- Review [Error Handling](./error-handling.html) strategies

</docmach>
