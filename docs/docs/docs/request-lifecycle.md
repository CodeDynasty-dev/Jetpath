<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Request Lifecycle

Understanding Jetpath's request lifecycle is essential for building efficient and maintainable applications. This document outlines the complete journey of a request from arrival to response.

<img src="/Request-Lifecycle.svg" alt="Request Lifecycle" style="max-width: 550px; margin: 2rem auto;" />

## 1. Route Matching

When a request arrives:

- The request path is normalized (leading/trailing slashes stripped, query string separated)
- An O(1) hashmap lookup is attempted for exact static paths (fast path)
- If no exact match, the trie is walked for parameterized and wildcard routes
- Route parameters (`:id`, `*`) are extracted during the trie walk

## 2. Context Creation

A `Context` object is created or reused from the context pool:

- The pool avoids allocating a new object per request, reducing GC pressure
- CORS headers are pre-populated from a cached template
- Request metadata (method, path, params) is attached
- State, cookies, and body caches are reset

## 3. Pre-Handler Middleware

Before reaching the route handler, the request passes through middleware pre-handlers:

- Middleware is matched by path prefix (global `MIDDLEWARE_` first, then scoped)
- Pre-handlers run in order of specificity (broadest to most specific)
- Any pre-handler can short-circuit by calling `ctx.send()` (e.g., auth rejection)
- Post-handler callbacks are collected for later execution

## 4. Route Handler Execution

The matched route handler runs:

- `ctx.parse()` parses and validates the request body against the schema
- `ctx.parseQuery()` parses and validates query parameters
- `ctx.send()` validates the response against the response schema (if defined)
- The handler can be sync or async

## 5. Post-Handler Middleware

After the handler completes (or throws), post-handlers run in reverse order:

- Each post-handler receives `(ctx, err)` where `err` is defined if the handler threw
- Error handling, response logging, and header additions happen here
- The first post-handler to call `ctx.send()` determines the error response

## 6. Response

The response is sent to the client:

- For JSON responses, a pre-baked headers clone avoids per-request object creation
- Set-Cookie headers are sent as separate headers (RFC 6265 compliant)
- The context is returned to the pool for reuse

## Error Flow

If an error occurs at any stage:

1. The error is caught by Jetpath's internal handler
2. All collected post-handler middleware functions are called with the error
3. If no middleware handles it, a generic 500 response is sent
4. The context is still returned to the pool

## Performance Notes

- Static routes use O(1) hashmap lookup — the most common case
- Dynamic routes use trie traversal — O(n) where n = path segments
- Context pooling eliminates per-request allocation overhead
- CORS headers are cloned from a frozen template via a pre-built closure
- The pool is capped at 1024 contexts to bound memory usage

</docmach>
