<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">
 
# Core Concepts: Routing

Routing in JetPath is designed to be intuitive and fast, primarily relying on **convention over configuration** through a **file-based system**. This means your project's file structure and how you name your exported functions directly determine your API endpoints.

---

## Key Concepts

### 1. Source Directory

When you initialize JetPath, you specify a `source` directory. JetPath watches this directory for `.jet.ts` files containing your route handlers.

```typescript
// server.ts
import { JetPath } from "jetpath";

const app = new JetPath({
  source: "./src", // JetPath looks for routes inside the 'src' folder
  // ... other options
});

app.listen();
````

### 2\. File and Folder Mapping

The path to a `.jet.ts` file within the `source` directory directly maps to the URL path segments.

  * `src/index.jet.ts` maps to `/`
  * `src/users.jet.ts` maps to `/users`
  * `src/pets/index.jet.ts` maps to `/pets`
  * `src/pets/search.jet.ts` maps to `/pets/search`
  * `src/auth/login.jet.ts` maps to `/auth/login`

### 3\. Handler Files (`.jet.ts`)

Files ending with `.jet.ts` are scanned by JetPath for exported functions that define route handlers. Other `.ts` or `.js` files in the `source` directory are ignored for routing purposes (but can still be imported by your handlers).

### 4\. Export Naming Convention

The core convention lies in the names of the **exported functions** within your `.jet.ts` files.

  * **Format:** `METHOD_optionalPathSegment` or `WS_optionalPathSegment`
  * **`METHOD`:** Specifies the HTTP method (case-insensitive, but uppercase recommended):
      * `GET_`
      * `POST_`
      * `PUT_`
      * `DELETE_`
      * `PATCH_`
      * `OPTIONS_`
      * `HEAD_`
  * **`WS_`:** Specifies a WebSocket endpoint.
  * **`optionalPathSegment`:** An optional string that gets appended to the route path derived from the file structure. This allows multiple related endpoints within a single file.

**Examples from `tests/app.jet.ts`:**

  * In `src/index.jet.ts` (maps to `/`):
    ```typescript
    export const GET_: JetFunc = (ctx) => { ... }; // Maps to: GET /
    ```
  * In `src/auth/login.jet.ts` (maps to `/auth/login`):
    ```typescript
    // Assuming this code lives in src/auth/login.jet.ts
    export const POST_: JetFunc = async (ctx) => { ... }; // Maps to: POST /auth/login
    ```
    *Alternatively, if in `src/auth.jet.ts`:*
    ```typescript
    export const POST_login: JetFunc = async (ctx) => { ... }; // Maps to: POST /auth/login [cite: tests/app.jet.ts]
    ```
  * In `src/pets.jet.ts` (maps to `/pets`):
    ```typescript
    export const GET_: JetFunc<...> = (ctx) => { ... }; // Maps to: GET /pets [cite: tests/app.jet.ts]
    export const POST_: JetFunc<...> = async (ctx) => { ... }; // Maps to: POST /pets [cite: tests/app.jet.ts]
    ```

### 5\. Index Routes

Files named `index.jet.ts` represent the root path segment for their directory.

  * `src/index.jet.ts` -\> `/`
  * `src/pets/index.jet.ts` -\> `/pets`

### 6\. Path Parameters (`$paramName`)

To capture dynamic segments in the URL, use a `$` prefix followed by the parameter name within a filename segment or an exported function name segment.

  * **File-based:** `src/pets/by$id.jet.ts` -\> Defines routes under `/pets/by/:id`
    ```typescript
    // Inside src/pets/by$id.jet.ts
    export const GET_: JetFunc<...> = (ctx) => {
        const petId = ctx.params.id; // Access the parameter
        // ...
    }; // Maps to: GET /pets/by/:id
    ```
  * **Export-based:** Define within a parent file (e.g., `src/pets.jet.ts`).
    ```typescript
    // Inside src/pets.jet.ts
    export const GET_petBy$id: JetFunc<...> = (ctx) => {
        const petId = ctx.params.id;
        // ...
    }; // Maps to: GET /pets/petBy/:id [cite: tests/app.jet.ts]

    export const PUT_petBy$id: JetFunc<...> = async (ctx) => {
        const petId = ctx.params.id;
        // ...
    }; // Maps to: PUT /pets/petBy/:id [cite: tests/app.jet.ts]

    export const DELETE_petBy$id: JetFunc<...> = (ctx) => {
        const petId = ctx.params.id;
        // ...
    }; // Maps to: DELETE /pets/petBy/:id [cite: tests/app.jet.ts]

    // Multiple params example (hypothetical)
    // export const GET_orders$orderId_items$itemId = (ctx) => {
    //   const { orderId, itemId } = ctx.params;
    // }; // Maps to: GET /pets/orders/:orderId/items/:itemId
    ```
  * Parameters are accessed via the `ctx.params` object.

### 7\. Catch-all / Greedy Routes (`$$`)

To match multiple path segments at the end of a route, use `$$` at the end of a filename segment or export name segment.

  * **File-based:** `src/files$$.jet.ts` -\> Defines routes under `/files/*`
    ```typescript
    // Inside src/files$$.jet.ts
    export const GET_: JetFunc = (ctx) => {
        const filePath = ctx.params._; // Access the matched path segments (exact property name TBC)
        // ... handle file serving ...
    }; // Maps to GET /files/*
    ```
  * **Export-based:**
    ```typescript
    // Inside src/pets.jet.ts
    export const GET_pets_search$$: JetFunc<...> = async (ctx) => { ... }; // Maps to GET /pets/search/* [cite: tests/app.jet.ts]
    // The matched part '*' would be available in ctx.params._ (or similar TBC)
    ```
  * The matched path segments are typically available under a special parameter like `ctx.params._` or `ctx.params.slug`. *(Note: The exact property name for the catch-all parameter should be confirmed from JetPath's implementation details or core documentation).*

### 8\. WebSocket Routes (`WS_`)

Define WebSocket handlers using the `WS_` prefix in the export name.

```typescript
// Inside src/live.jet.ts (or similar)
export const WS_live: JetFunc = (ctx) => {
    const conn = ctx.connection!; // Access WebSocket connection
    conn.addEventListener("open", (socket) => { /* ... */ });
    conn.addEventListener("message", (socket, event) => { /* ... */ });
    // ...
}; // Maps WebSocket connections to ws://your-host/live [cite: tests/app.jet.ts]
```

-----

## Route Precedence

JetPath follows standard routing precedence rules:

1.  **Static routes** (e.g., `/pets/search`) are matched before dynamic routes (`/pets/:id`).
2.  **More specific dynamic routes** (e.g., `/pets/by/:id`) are matched before catch-all routes (`/pets/search/$$`).
3.  *(Need to confirm)* If multiple exports in the same file could match the same METHOD + Path, the behavior might be unpredictable or follow source code order. It's best practice to ensure unique METHOD + Path combinations.

-----

## Advanced Routing

### Explicit Overrides (Recommended Practice)

While conventions are powerful, complex scenarios might benefit from explicit definitions. Using a `defineHandler` helper (if implemented based on recommendations) allows overriding inferred paths or methods:

```typescript
// Recommended pattern for complex cases
import { defineHandler } from "jetpath";
import { PetSchema } from "./schemas"; // Assuming Zod/TypeBox schema

export const updatePetStatus = defineHandler({
  // Explicitly define the route if convention doesn't fit well
  route: { method: 'PATCH', path: '/pets/:id/status' },
  schema: {
    params: t.object({ id: t.string() }),
    body: t.object({ available: t.boolean() })
  },
  handler: async (ctx) => {
    const { id } = ctx.params; // Typed based on schema
    const { available } = ctx.body; // Typed and potentially pre-validated
    // ... logic ...
  }
});
```

### Programmatic Routing

*(This section would detail any API provided by JetPath for adding routes programmatically via `app.addRoute(...)` or similar, if available. This is useful for dynamic route generation or plugin integrations.)*

-----

## Next Steps

  * Learn how the [**Context (`ctx`) Object**](https://www.google.com/search?q=./context.md) provides access to request/response data within your handlers.
  * Understand the full [**Request Lifecycle**](https://www.google.com/search?q=./request-lifecycle.md), including middleware execution.
 
 

</docmach>



