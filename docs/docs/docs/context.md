<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Context (`ctx`)

The `Context` object (`ctx`) is the central interface for handling HTTP requests in Jetpath. It provides:

- Access to request data (body, query, params)
- Tools for crafting responses
- Integration with plugins and validation
- State management for the request lifecycle


## Usage Examples

### Basic Request

```typescript
import { type JetRoute } from "jetpath";

export const GET_user: JetRoute = (ctx) => {
  // Access query parameters
  const page = ctx.parseQuery().page || '1';
  
  // Get request headers
  const authHeader = ctx.get('Authorization');
  
  // Send JSON response
  ctx.send({
    message: 'Success',
    page: parseInt(page)
  });
};
```

### File Upload with Validation

```typescript
import { type JetRoute, use } from "jetpath";

export const POST_upload: JetRoute = async (ctx) => {
  const data = await ctx.parse({
    maxBodySize: 10 * 1024 * 1024, // 10MB limit
  });
  
  if (!data.image) {
    ctx.send({ error: 'No file uploaded' }, 400);
    return;
  }
   
  ctx.send({ message: 'File uploaded successfully' });
};

use(POST_upload).body((t) => ({
  image: t.file({ inputAccept: "image/*" }).required(),
}));
```

### WebSocket Connection

```typescript
import { type JetRoute } from "jetpath";

// WebSocket route — uses GET_ prefix with ctx.upgrade()
export const GET_live: JetRoute = (ctx) => {
  ctx.upgrade();
  
  const conn = ctx.connection!;
  
  conn.addEventListener('open', (socket) => {
    socket.send('Welcome!');
  });

  conn.addEventListener('message', (socket, event) => {
    socket.send(`Echo: ${event.data}`);
  });
  
  conn.addEventListener('close', () => {
    console.log('Client disconnected');
  });
};
```

## Best Practices

1. **Type Safety:** Use generics to define expected data shapes: `JetRoute<{ body: { name: string } }>`
2. **Error Handling:** Use `ctx.send(error, statusCode)` for HTTP errors — e.g. `ctx.send("Not found", 404)`
3. **State Management:** Use `ctx.state` for request-scoped data (user info, request IDs, etc.)
4. **Security:** Always validate input data using `use(route).body()` and `use(route).query()`
5. **Response Handling:** Use `ctx.send()` for JSON/text, `ctx.sendStream()` for files, `ctx.sendResponse()` for raw Response objects

## Properties

### `state: Record<string, any>`

An object for storing request-scoped data. Commonly used to pass user info from middleware to route handlers.

```typescript
// In middleware:
ctx.state.user = { id: '123', role: 'admin' };

// In route handler:
const user = ctx.state.user;
```

### `plugins: Record<string, any>`

Access to functionality added by plugins registered via `app.derivePlugins()`. The available methods depend on which plugins are registered.

```typescript
// Using an auth plugin method:
const auth = ctx.plugins.verifyAuth(ctx);
if (!auth.authenticated) {
  ctx.send("Unauthorized", 401);
}
```

### `params: Record<string, string>`

Route parameters captured from dynamic path segments (defined using `$paramName` in export names).

```typescript
// Route: GET_users_$id → GET /users/:id
// Request: GET /users/42
const userId = ctx.params.id; // "42"
```

### `request: Request`

The underlying standard `Request` object. Useful for lower-level access to headers, method, URL, etc.

```typescript
const method = ctx.request.method; // "GET", "POST", etc.
const url = ctx.request.url;
```

### `code: number`

Gets or sets the HTTP status code. Defaults to `200`.

```typescript
ctx.code = 201;
ctx.send({ id: newId, message: "Created" });
```

### `path: string`

The pathname of the request URL, excluding the query string.

### `connection: jet_socket`

WebSocket connection object. Only available after calling `ctx.upgrade()` in a WebSocket route.

## Methods

### `send(data: unknown, statusCode?: number, contentType?: string): void`

The primary method for sending responses. Automatically serializes objects to JSON.

```typescript
// Send JSON (default for objects)
ctx.send({ status: "success", data: { userId: 123 } });

// Send with status code
ctx.send({ error: "Not found" }, 404);

// Send HTML with explicit content type
ctx.send("<h1>Hello</h1>", 200, "text/html");

// Send plain text
ctx.send("OK");
```

### `redirect(url: string): void`

Sends a 301 redirect response.

```typescript
ctx.redirect("/dashboard");
```

### `get(field: string): string | undefined`

Reads a request header value.

```typescript
const userAgent = ctx.get("User-Agent");
const auth = ctx.get("Authorization");
```

### `set(field: string, value: string): void`

Sets a response header value.

```typescript
ctx.set("Cache-Control", "public, max-age=3600");
ctx.set("X-Request-ID", requestId);
```

### `parse(options?): Promise<Record<string, any>>`

Asynchronously parses the request body. Supports JSON, form-data, and URL-encoded bodies. Automatically validates against the schema defined via `use(route).body()`.

```typescript
const body = await ctx.parse();
// With options:
const body = await ctx.parse({ maxBodySize: 5 * 1024 * 1024 });
```

### `parseQuery(): Record<string, any>`

Parses URL query parameters. Supports nested bracket notation (`filter[name]=Bob`). Automatically validates against the schema defined via `use(route).query()`.

```typescript
// URL: /search?term=cats&limit=20
const query = ctx.parseQuery();
// query.term === "cats", query.limit === "20"
```

### `sendStream(stream, config?): void`

Sends a file or stream as the response. When passing a string path with a `folder` option, path traversal protection is enforced.

```typescript
// Send a file by path (requires folder for security)
ctx.sendStream("photo.jpg", {
  folder: "./uploads",
  ContentType: "image/jpeg"
});
```

### `download(stream, config?): void`

Like `sendStream()` but sets `Content-Disposition: attachment` to trigger a file download.

### `sendResponse(response?: Response): void`

Sends a raw Web Standard `Response` object directly. Only works on Bun and Deno.

### `upgrade(): void`

Upgrades the connection to WebSocket. Only works on Bun and Deno.

### Cookie Methods

```typescript
// Set a cookie
ctx.setCookie('session', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 3600,
  sameSite: 'strict'
});

// Read a cookie
const session = ctx.getCookie('session');

// Read all cookies
const cookies = ctx.getCookies();

// Clear a cookie
ctx.clearCookie('session', {});
```

## Next Steps

- Learn about [Middleware](./middleware.html)
- Explore [Error Handling](./error-handling.html)
- Review [Request Lifecycle](./request-lifecycle.html)

</docmach>
