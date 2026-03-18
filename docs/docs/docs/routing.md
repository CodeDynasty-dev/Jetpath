<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 

# Core Concepts 1: Routing

Routing in Jetpath is designed to be intuitive, relying on **convention over configuration** through a **function naming convention**. Your exported function names directly determine your API endpoints.

## Key Concepts

### 1. Source Directory

When you initialize Jetpath, specify a `source` directory for your `.jet.ts` route handler files:

```typescript
// server.jet.ts
import { Jetpath } from "jetpath";

const app = new Jetpath({
  source: "./src"
});

app.listen();
```

### 2. Handler Files (`.jet.ts`)

Files ending with `.jet.ts` (or `.jet.js`) are scanned for exported functions that define route handlers. Other `.ts` or `.js` files are ignored for routing but can be imported by your handlers.

### 3. Export Naming Convention

The core convention lies in the names of the exported functions:

- **Format:** `METHOD_optionalPathSegments`
- **`METHOD`:** HTTP method prefix (uppercase):
  - `GET_`, `POST_`, `PUT_`, `DELETE_`, `PATCH_`, `HEAD_`

**Examples: In `src/pets.jet.ts`:**

```typescript
import { type JetRoute } from "jetpath";

// GET /pets
export const GET_pets: JetRoute = (ctx) => {
  ctx.send({ pets: [] });
};

// POST /pets
export const POST_pets: JetRoute = async (ctx) => {
  const body = await ctx.parse();
  ctx.send({ created: true }, 201);
};

// GET /pets/search
export const GET_pets_search: JetRoute = (ctx) => {
  const query = ctx.parseQuery();
  ctx.send({ results: [], query });
};
```

### 4. Path Parameters (`$paramName`)

Capture dynamic segments using a `$` prefix in export names:

```typescript
import { type JetRoute } from "jetpath";

// Maps to: GET /pets/:id
export const GET_pets_$id: JetRoute = (ctx) => {
  const petId = ctx.params.id;
  ctx.send({ petId });
};

// Maps to: GET /pets/:id/:slug
export const GET_pets_$id_$slug: JetRoute = (ctx) => {
  const petId = ctx.params.id;
  const slug = ctx.params.slug;
  ctx.send({ petId, slug });
};
```

### 5. Catch-all Routes (`$0`)

Match multiple path segments using `$0`:

```typescript
import { type JetRoute } from "jetpath";

// Maps to: GET /*
export const GET_$0: JetRoute = (ctx) => {
  const filePath = ctx.params['*']; // e.g., "images/photo.jpg"
  ctx.sendStream(filePath, {
    folder: "./public",
  });
};
```

### 6. WebSocket Routes via `ctx.upgrade()`

WebSocket connections use a regular `GET_` route with `ctx.upgrade()`. There is no special `WS_` prefix — the upgrade happens at runtime.

```typescript
import { type JetRoute } from "jetpath";

// Maps to: ws://your-host/live (via GET /live + upgrade)
export const GET_live: JetRoute = (ctx) => {
  ctx.upgrade();
  const conn = ctx.connection!;

  conn.addEventListener("open", (socket) => {
    socket.send("Welcome!");
  });

  conn.addEventListener("message", (socket, event) => {
    socket.send(`Echo: ${event.data}`);
  });

  conn.addEventListener("close", () => {
    console.log("Client disconnected");
  });
};
```

Note: WebSocket support requires Bun or Deno. Node.js does not currently support WebSocket upgrades in Jetpath.

## Route Precedence

Jetpath uses a trie data structure with a hashmap fast-path for exact matches:

1. Exact/static routes (e.g., `/pets/search`) are matched first via O(1) hashmap lookup
2. Parameterized routes (`/pets/:id`) are matched via trie traversal
3. Wildcard routes (`/files/*`) match last

This means `/pets/search` will always take priority over `/pets/:id` when the request path is `/pets/search`.

## Tips

- Underscores in export names become `/` path separators: `GET_api_v1_users` → `GET /api/v1/users`
- Keep route files focused — one resource per `.jet.ts` file (e.g., `users.jet.ts`, `products.jet.ts`)
- Use `use(route).title()` and `use(route).description()` to document routes for the auto-generated API docs

## Next Steps

- Learn how the [Context (`ctx`) Object](./context.html) provides access to request/response data
- Understand the full [Request Lifecycle](./request-lifecycle.html), including middleware execution



</docmach>
