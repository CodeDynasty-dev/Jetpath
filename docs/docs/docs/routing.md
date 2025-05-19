<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 

# Core Concepts 1: Routing

Routing in Jetpath is designed to be intuitive, relying on **convention over configuration** through a **function naming convention**. Your exported function names directly determine your API endpoints.

## Key Concepts

### 1. Source Directory

When you initialize Jetpath, specify a `source` directory for your `.jet.ts` route handler files:

```typescript
// index.jet.ts
import { Jetpath } from "jetpath";

const app = new Jetpath({
  source: "./src"
});

app.listen();
```

### 2. Handler Files (`.jet.ts`)

Files ending with `.jet.ts` are scanned for exported functions that define route handlers. Other `.ts` or `.js` files are ignored for routing but can be imported by your handlers.

### 3. Export Naming Convention

The core convention lies in the names of the exported functions:

- **Format:** `METHOD_optionalPathSegment`
- **`METHOD`:** HTTP method prefix (uppercase only):
  - `GET_`
  - `POST_`
  - `PUT_`
  - `DELETE_`
  - `PATCH_` 
  - `HEAD_` 

**Examples: In `src/pets.jet.ts`:**

```typescript
// GET /pets
export const GET_: JetRoute = (ctx) => { ... }

// POST /pets
export const POST_: JetRoute = async (ctx) => { ... }

// GET /pets/search

export const GET_search: JetRoute = (ctx) => { ... }
```

### 4. Path Parameters (`$paramName`)

Capture dynamic segments using a `$` prefix in filenames or export names:

```typescript 
// Maps to: GET /pets/by/:id
export const GET_by$id: JetRoute = (ctx) => {
  const petId = ctx.params.id;
  // ...
}; 


 // Maps to: GET /pets/petBy/:id/:slug
export const GET_petBy$id$slug: JetRoute = (ctx) => {
  const petId = ctx.params.id;
  const slug = ctx.params.slug;
  // ...
}; 
```

### 5. Catch-all Routes (`$0`)

Match multiple path segments using `$0
`:

```typescript 
// Maps to GET /*
export const GET_$0: JetRoute = (ctx) => {
  const filePath = ctx.params.$0; // e.g., "file.txt" from
  ctx.sendStream(filePath, {
      folder: "./files", 
    });
}; 

 
```

### 6. WebSocket Routes (`WS`) via `ctx.upgrade()`

```typescript 
// Maps to ws://your-host/live
export const GET_live: JetRoute = (ctx) => {
  ctx.upgrade();
  const conn = ctx.connection!;
  conn.addEventListener("open", (socket) => { /* ... */ });
  conn.addEventListener("message", (socket, event) => { /* ... */ });
  // ...
};
```

## Route Precedence

Jetpath follows standard routing precedence:
Static routes (e.g., `/pets/search`) are matched before dynamic routes (`/pets/:id`)  

## Next Steps

- Learn how the [Context (`ctx`) Object](./context.html) provides access to request/response data
- Understand the full [Request Lifecycle](./request-lifecycle.html), including middleware execution



</docmach>