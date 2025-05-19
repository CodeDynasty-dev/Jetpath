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
// Basic route handler
export const GET_user = async (ctx) => {
  // Access query parameters
  const page = ctx.query.page || '1';
  
  // Get request headers
  const authHeader = ctx.get('Authorization');
  
  // Send JSON response
  ctx.send({
    message: 'Success',
    page: parseInt(page)
  });
}
```

### Error Handling with Plugins

```typescript
// Using ctx.throw() with plugins
export const GET_user = async (ctx) => {
  const userId = ctx.params.id;
  const user = await getUser(userId);
  
  if (!user) {
    ctx.plugins?.logger?.error(`User ${userId} not found`);
    ctx.throw(404, `User ${userId} not found`);
  }
  ctx.send(user);

}
```

### File Upload with Validation

```typescript
// Using ctx.parse() for file uploads with validation
export const POST_upload = async (ctx) => {
  const data = await ctx.parse({
    maxBodySize: 10 * 1024 * 1024, // 10MB limit
    contentType: 'multipart/form-data'
  });
  
  // Validate file data
  if (!data.files || !data.files.file) {
    ctx.throw(400, 'No file uploaded');
  }
   
  ctx.send({ message: 'Files uploaded successfully' });

}
```

### WebSocket Connection

```typescript
// WebSocket route handler
export const GET_live = async (ctx) => {
  // Upgrade to WebSocket
  ctx.upgrade();
  
  // Access WebSocket connection
  const conn = ctx.connection!;
  
  // Handle WebSocket events
  conn.addEventListener('message', (data) => {
    // Handle incoming messages
  });
  
  conn.addEventListener('close', () => {
    // Handle connection close
  });

}
```

## Best Practices

1. **Type Safety:** Use generics to define expected data shapes
2. **Error Handling:** Use `ctx.throw()` for HTTP errors and `ctx.plugins.logger` for logging
3. **State Management:** Use `ctx.state` for request-scoped data and attach user info if authenticated
4. **Security:** Always validate input data and implement proper authentication
5. **Response Handling:** Use appropriate methods for different response types and include request ID in headers
6. **Logging:** Use `ctx.plugins.logger` for detailed request logging with request ID and duration
7. **Headers:** Add standard response headers including X-Request-ID and X-Response-Time

## Key Features

### Request Data Access

- `body`: Parsed request body data
- `query`: URL query parameters
- `params`: Route parameters
- All type-safe based on `JetData` generic

### Response Handling

- `send()`: Send response data
- `sendStream()`: Stream files
- `download()`: Force file download
- `sendResponse()`: Send raw Response object

### Error Handling

- `throw()`: Throw HTTP errors
- `plugins.logger`: Log errors
- Sets status code and message
- Ends request cycle

### Navigation

- `redirect()`: Redirect requests
- Sets appropriate headers
- Ends request cycle

### Headers & Cookies

- `get()`: Get request headers
- `set()`: Set response headers
- Cookie methods: `getCookie()`, `setCookie()`, `clearCookie()`

### WebSocket

- `upgrade()`: Upgrade to WebSocket
- `connection`: WebSocket interface
- Handles WebSocket lifecycle

### Additional Properties

- `request`: Request object
- `connection`: jet_socket object
- `code`: HTTP status code
- `path`: Request path
- `payload`: Request payload

</docmach>
    }
    
    ctx.send(user);
}
```

### File Upload

```typescript
// Using ctx.parse() for file uploads
export const POST_upload = async (ctx) => {
    const data = await ctx.parse({
      maxBodySize: 10 * 1024 * 1024, // 10MB limit
      contentType: 'multipart/form-data'
    });
    
    // Handle uploaded files
    // data.files contains uploaded files
    ctx.send({ message: 'Files uploaded successfully' });
}
```

## Best Practices

1. **Type Safety:** Use generics to define expected data shapes
2. **Error Handling:** Prefer `ctx.throw()` for HTTP errors
3. **State Management:** Use `ctx.state` for request-scoped data
4. **Security:** Always validate input data
5. **Response Handling:** Use appropriate methods for different response types

## Next Steps

- Learn about [Middleware](./middleware.html)
- Explore [Error Handling](./error-handling.html)
- Review [Request Lifecycle](./request-lifecycle.html)
 
    *[cite: tests/app.jet.ts]*

### `plugins: UnionToIntersection<JetPluginTypes[number]> & Record<string, any>`

  * **Type:** Dynamic (Based on registered plugins)
  * **Description:** Your gateway to functionality added by plugins registered via `app.use()`. The specific methods available depend entirely on the plugins you've installed and registered. Use TypeScript generics (like `JetMiddleware<AppState, [typeof PluginA, typeof PluginB]>`) to get type hints for available plugin methods.
  * **Example 1: Using an Auth Plugin**
    ```typescript
    // Assuming AuthPlugin provides 'authenticateUser'
    // In POST_auth_login handler:
    const authResult = ctx.plugins.authenticateUser(username, password);
    if (!authResult.authenticated) { /* handle failure */ }
    ```
    *[cite: tests/app.jet.ts]*
  * **Example 2: Using a File Upload Plugin**
    ```typescript
    // Assuming jetbusboy plugin provides 'formData'
    // In POST_upload handler:
    const form = await ctx.plugins.formData(ctx);
    const imageFile = form.image; // Access uploaded file data
    if (imageFile && imageFile.filename) {
        await imageFile.saveTo(`./public/uploads/${imageFile.filename}`);
    }
    ```
    *[cite: tests/app.jet.ts]*

### `body: JetData["body"]`

  * **Type:** Inferred from Schema (`JetData` generic)
  * **Description:** Represents the *parsed* request body. It's crucial to understand that `ctx.body` is typically `undefined` until you explicitly parse the request body using a method like `await ctx.json()`, `await ctx.plugins.formData(ctx)`, or implicitly via `ctx.validate()` if it handles parsing, *unless* you have enabled opt-in eager pre-processing for the route.
  * **Example:**
    ```typescript
    // For a POST request with JSON: { "name": "Fluffy", "age": 3 }
    // Define schema: const PetSchema = t.object({ name: t.string(), age: t.number() });
    export const POST_pets = async (ctx) => {
      // Assuming NO pre-processing:
      console.log(ctx.body); // undefined (initially)
      await ctx.json();      // Parse the JSON body
      console.log(ctx.body); // { name: "Fluffy", age: 3 }
      const name = ctx.body.name; // Access data
      // ... validation and logic ...
    }
    ```

### `query: JetData["query"]`

  * **Type:** Inferred from Schema (`JetData` generic), defaults to `Record<string, string | string[]>`
  * **Description:** An object containing key-value pairs from the URL's query string (the part after `?`). Values are initially strings or arrays of strings (for repeated keys). Use validation to enforce specific types (like numbers or booleans).
  * **Example 1: Basic Access**
    ```typescript
    // URL: /search?term=cats&limit=20
    // In handler:
    const searchTerm = ctx.query.term;   // "cats"
    const limitStr = ctx.query.limit; // "20"
    ```
  * **Example 2: Using with Validation**
    ```typescript
    // Schema: const SearchQuerySchema = t.object({ term: t.string(), limit: t.coerce.number().positive().optional().default(10) });
    // In handler:
    const validatedQuery = ctx.validate(SearchQuerySchema); // Validate ctx.query
    const limit = validatedQuery.limit; // 10 (number, default applied)
    ```
    *[cite: tests/app.jet.ts (GET\_pets example uses query params)]*

### `params: JetData["params"]`

  * **Type:** Inferred from Schema (`JetData` generic), defaults to `Record<string, string>`
  * **Description:** An object containing values captured from dynamic segments in the route path (defined using `$paramName` in file/export names).
  * **Example:**
    ```typescript
    // Route defined for /pets/petBy/:id (e.g., GET_petBy$id)
    // Request URL: /pets/petBy/cat-567
    // In handler:
    const petIdentifier = ctx.params.id; // "cat-567"

    // Schema: const PetParamsSchema = t.object({ id: t.string().startsWith("cat-") });
    // const validatedParams = ctx.validate(PetParamsSchema); // Validate ctx.params
    // const petId = validatedParams.id;
    ```
    *[cite: tests/app.jet.ts (GET\_petBy$id, PUT\_petBy$id, etc.)]*

### `connection: jet_socket`

  * **Type:** `jet_socket`
  * **Description:** Provides access to the WebSocket connection object. This property is only relevant and available within WebSocket handlers (routes defined with `WS_`).
  * **Example:**
    ```typescript
    // Route: /live
    export const GET_live: JetRoute = (ctx) => {
      ctx.upgrade();
      const conn = ctx.connection!; // Assert non-null for WS routes
      console.log("Client connected via WebSocket");

      conn.addEventListener("open", (socket) => {
        socket.send("Welcome to the live feed!");
      });

      conn.addEventListener("message", (socket, event) => {
        console.log("Received message:", event.data);
        socket.send(`You sent: ${event.data}`);
      });

      conn.addEventListener("close", () => {
        console.log("Client disconnected");
      });
    };
    ```
    *[cite: tests/app.jet.ts]*

### `request: Request`

  * **Type:** `Request` (Web Standard)
  * **Description:** Access the underlying standard `Request` object. Useful for lower-level access to request details like headers map, method, URL object, or potentially reading the raw body stream.
  * **Example:**
    ```typescript
    const method = ctx.request.method; // "GET", "POST", etc.
    const url = new URL(ctx.request.url);
    const pathname = url.pathname;
    // Potentially access raw body: const reader = ctx.request.body?.getReader();
    ```

### `code: number`

  * **Type:** `number`
  * **Description:** Gets or sets the HTTP status code for the outgoing response. Modify this before calling `ctx.send` or `ctx.throw` to control the response status. Defaults to `200` if `ctx.send` is called without errors.
  * **Example 1: Setting Success Code**
    ```typescript
    // After creating a resource:
    ctx.code = 201; // Created
    ctx.send({ id: newResourceId, message: "Resource created" });
    ```
  * **Example 2: Setting Error Code Before Throwing**
    ```typescript
    if (!resource) {
      ctx.code = 404; // Set explicit 404
      ctx.throw("Resource not found"); // Middleware will use ctx.code (404)
    }
    ```
    *[cite: tests/app.jet.ts (used extensively)]*

### `path: string`

  * **Type:** `string`
  * **Description:** Contains the pathname part of the request URL, excluding the query string.
  * **Example:**
    ```typescript
    // For URL: /users/profile?edit=true
    const pathname = ctx.path; // "/users/profile"
    ```

-----

## Methods

Methods returning `never` indicate they terminate the request flow.

### `eject(): never`

  * **Description:** Disconnects Jetpath's automatic response handling. Use this advanced feature only when you need full manual control over the response stream, often for integrating with libraries that directly pipe to the underlying response (like older versions of `busboy` on Node.js). After `eject()`, Jetpath will *not* send any response automatically; your code is entirely responsible.
  * **Example:** *(Refer to specific streaming library documentation for usage after ejecting)*
 

### `sendStream(stream: ReadableStream | any, ContentType: string): never`

  * **Description:** Sends a `ReadableStream` as the response body. Ideal for large files or dynamically generated content. Requires setting the correct `Content-Type`.
  * **Example:**
    ```typescript
 ctx.sendStream(file name);
    ``` 

### `sendResponse(response?: Response): never`

  * **Description:** Sends a raw Web Standard `Response` object directly. Bypasses Jetpath's content negotiation and serialization. Useful for maximal control, especially in Deno/Bun.
  * **Example:**
    ```typescript 
    ctx.sendResponse(response);
    ```

### `send(data: unknown, ContentType?: string): never`

  * **Description:** The primary method for sending responses. Handles serialization and content type automatically for common types.
  * **Example 1: Sending JSON (Default)**
    ```typescript
    ctx.send({ status: "success", data: { userId: 123 } });
    // -> Content-Type: application/json
    ```
  * **Example 2: Sending HTML**
    ```typescript
    const html = "<h1>Hello from Jetpath!</h1>";
    ctx.send(html, "text/html");
    // -> Content-Type: text/html
    ```
  * **Example 3: Sending Plain Text**
    ```typescript
    ctx.send("OK");
    // -> Content-Type: text/plain
    ```
    *[cite: tests/app.jet.ts (used extensively)]*

### `throw(codeOrData?: number | string | Record<string, any> | unknown, message?: string | Record<string, any>): never`

  * **Description:** Used to signal errors and interrupt the normal request flow. The thrown error should be caught and handled by your error-handling middleware.
  * **Example 1: Not Found**
    ```typescript
    // If pet with ctx.params.id doesn't exist:
    ctx.throw(404, `Pet with ID ${ctx.params.id} not found`);
    ```
  * **Example 2: Unauthorized**
    ```typescript
    // If authentication fails:
    ctx.set("WWW-Authenticate", "Bearer realm=\"protected area\""); // Add relevant header
    ctx.throw(401, "Invalid credentials");
    ``` 
  * **Example 3: Bad Request (Validation Failure)**
    ```typescript
    try {
      ctx.validate(MySchema);
    } catch (err) {
      ctx.throw(400, err.message); // Pass validation error message
    }
    ```
  * **Example 4: Internal Server Error**
    ```typescript
    try { /* some risky operation */ }
    catch (err) {
      console.error("Unexpected error:", err);
      ctx.throw(500); // Let middleware handle generic message
    }
    ```

### `redirect(url: string, code: number = 302): never` *(Assuming optional code)*

  * **Description:** Sends a redirect response to the client. Sets the `Location` header to the provided `url` and sets the status code (defaults typically to 302 Found).
  * **Example:**
    ```typescript
    // After successful login or form submission:
    ctx.redirect("/dashboard");

    // For a permanent redirect:
    // ctx.redirect("/new-location", 301);
    ```

### `get(field: string): string | undefined`

  * **Description:** Reads a request header value (case-insensitive).
  * **Example:**
    ```typescript
    const userAgent = ctx.get("User-Agent");
    const acceptEncoding = ctx.get("Accept-Encoding");
    const customHeader = ctx.get("X-Custom-ID");
    ```

### `set(field: string, value: string): void`

  * **Description:** Sets a response header value. Can be called multiple times.
  * **Example:**
    ```typescript
    ctx.set("Content-Language", "en-US");
    ctx.set("Cache-Control", "public, max-age=3600");
    ctx.set("X-Powered-By", "Jetpath"); // Add a custom header
    ```

### `json(): Promise<Record<string, any>>`

  * **Description:** Asynchronously reads and parses the request body specifically as JSON. Populates `ctx.body` upon success. Throws if the body is not valid JSON or has already been consumed. It's often called just before `ctx.validate()` if not using eager pre-processing.
  * **Example:**
    ```typescript
    // In a POST handler expecting JSON:
    async function handler(ctx) {
        try {
            await ctx.json(); // Parse the body
            const name = ctx.body.name;
            // Now validate ctx.body or use it directly if validation not needed
            ctx.send({ received: ctx.body });
        } catch (err) {
            ctx.throw(400, `Invalid JSON payload: ${err.message}`);
        }
    }
    ```

-----

## Next Steps

  * See how `ctx` is used throughout the [**Request Lifecycle**](./request-lifecycle.md).
  * Learn how [**Middleware**](./middleware.md) leverages `ctx` for cross-cutting concerns.
  * Understand how [**Validation**](./validation.md) uses schemas to type and check `ctx.body`, `ctx.query`, and `ctx.params`.
 
 

</docmach>



