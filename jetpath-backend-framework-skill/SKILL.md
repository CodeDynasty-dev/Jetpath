---
name: jetpath-backend-framework
description: Complete reference for building APIs with the Jetpath framework — a performance-first, cross-runtime (Node.js, Bun, Deno) API framework using convention-based file-system routing with `.jet.ts` files. Covers routing, context, middleware, validation, plugins, testing, SSE, WebSockets, and real production patterns.
---

# Jetpath Backend Framework Skill

## Overview

Jetpath (v1.13.x) is a **performance-first, cross-runtime API framework** for Node.js, Bun, and Deno. It uses **convention-over-configuration**: you export named functions from `.jet.ts` files, and Jetpath automatically maps them to HTTP routes.

**Key principles:**
- **Zero-router boilerplate**: Function export names ARE the routes — no decorators, no config files, no router registration.
- **TypeScript-first**: Built-in generics for full type safety on body, params, query, and plugins.
- **Cross-runtime**: Node.js (v18+), Bun (v1.0+), Deno, AWS Lambda, Cloudflare Workers.
- **Performance**: Trie-based routing with hashmap fast-path for static paths, context pooling (cap: 1024), pre-baked CORS headers.
- **Built-in validation**: Declarative schemas that auto-enforce AND auto-generate API documentation.

---

## 1. Installation & Project Setup

```bash
npm install jetpath
```

### Production Project Structure

This is the proven structure from a live production SMS gateway platform:

```
my-api/
├── src/
│   ├── app/                  # Route handler files (*.jet.ts ONLY)
│   │   ├── auth.jet.ts       # → /auth/*
│   │   ├── users.jet.ts      # → /user/*, /account/*, /admin/users/*
│   │   ├── sms.jet.ts        # → /sms/*, /campaigns/*
│   │   ├── payments.jet.ts   # → /deposits/*, /orders/*
│   │   ├── admin.jet.ts      # → /admin/*
│   │   ├── support.jet.ts    # → /support/*
│   │   ├── analytics.jet.ts  # → /analytics/*
│   │   ├── notification.jet.ts
│   │   ├── monitoring.jet.ts # → /monitoring/*, /health
│   │   ├── hlr.jet.ts        # → /hlr/*
│   │   └── telegram.jet.ts   # → /telegram/*
│   ├── middleware/            # Reusable middleware modules (regular .ts files)
│   │   ├── auth.ts
│   │   └── rate-limit.ts
│   ├── services/             # Business logic
│   ├── db/                   # Database layer (Prisma, etc.)
│   ├── telegram/             # External service integrations
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   ├── constants.ts          # App-wide constants & config
│   └── main.jet.ts           # Server entry point + global middleware
├── plugins.ts                # Plugin definitions
├── package.json
└── tsconfig.json
```

**Critical file naming rules:**
- **`.jet.ts` files** (or `.jet.js`): Scanned for route exports. ONLY these files are scanned.
- **Regular `.ts`/`.js` files**: NOT scanned. Use for middleware modules, services, utilities. Import them from `.jet.ts` files.
- The `source` option in the constructor specifies the root directory for scanning.

---

## 2. Server Entry Point

The main entry file **MUST** be a `.jet.ts` file. It creates the Jetpath instance, registers plugins, defines the global middleware, and calls `listen()`.

```typescript
import { Jetpath, type JetContext, type JetMiddleware } from "jetpath";
import { throwingPlugin } from "../plugins.ts";
import { connectDB } from "./db/index.ts";
import { config } from "dotenv";

config();
await connectDB();

const app = new Jetpath({
  source: ".",          // Scan current directory and subdirectories for .jet.ts files
  port: Number(process.env.PORT) || 3000,
  cors: true,
  strictMode: "OFF",    // "ON" | "OFF" | "WARN"
  apiDoc: {
    name: "My API",
    info: "Production API Platform",
    color: "#2563eb",
    display: "HTTP",    // "UI" | "HTTP" | false
  },
  globalHeaders: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  },
  // upgrade: true,     // Required for WebSocket support
});

// Register plugins BEFORE listen()
app.derivePlugins(throwingPlugin);

app.listen();
```

### Running the Server

```bash
# Bun (recommended — fastest startup):
bun src/main.jet.ts

# Node.js (v22+):
node --experimental-strip-types src/main.jet.ts

# Deno:
deno run --allow-all src/main.jet.ts
```

---

## 3. Routing — The Core Convention

### 3.1 Export Naming Convention

Export named functions from `.jet.ts` files. The export name determines method and path:

**Format:** `METHOD_segment1_segment2`

- **`METHOD`** prefix (UPPERCASE): `GET_`, `POST_`, `PUT_`, `DELETE_`, `PATCH_`, `HEAD_`
- **Underscores become `/`** separators: `GET_api_v1_users` → `GET /api/v1/users`
- **Double underscores `__` become hyphens `-`**: `POST_deposits__2` → `POST /deposits-2`

```typescript
import { type JetRoute, use } from "jetpath";

// GET /health
export const GET_health: JetRoute = async function (ctx) {
  ctx.send({ status: "healthy", timestamp: new Date().toISOString() });
};

// GET /monitoring/gateways
export const GET_monitoring_gateways = async (ctx: any) => {
  const gateways = await prisma.smppGateway.findMany({ where: { status: "ACTIVE" } });
  ctx.send({ gateways, totalGateways: gateways.length });
};

// GET /account/balance
export const GET_account_balance: JetRoute = async function (ctx) {
  const user = ctx.state.user;
  ctx.send({
    data: { balance: Number(user.balance), currency: "USD" },
    ok: true,
  });
};
```

### 3.2 Path Parameters (`$paramName`)

Dynamic segments use a `$` prefix in the export name. The `$` becomes `:` in the actual route.

```typescript
// GET /admin/users/:id → e.g., GET /admin/users/abc123
export const GET_admin_users$id: JetRoute<{ params: { id: string } }> = async function (ctx) {
  const { id } = ctx.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    ctx.send({ message: "User not found", ok: false }, 404);
    return;
  }
  ctx.send({ data: user, ok: true });
};

// PUT /admin/users/:id/status → nested param route
export const PUT_admin_users$id_status: JetRoute<{
  params: { id: string };
  body: { is_active: boolean };
}> = async function (ctx) {
  const { id } = ctx.params;
  const { is_active } = await ctx.parse();
  const updated = await prisma.user.update({
    where: { id },
    data: { is_active },
  });
  ctx.send({ data: updated, ok: true });
};

use(PUT_admin_users$id_status).body((t) => ({
  is_active: t.boolean().required().default(true),
}));

// GET /admin/users/:id/analytics/orders → deep nesting
export const GET_admin_users$id_analytics_orders: JetRoute<{
  params: { id: string };
  query: { days?: string };
}> = async function (ctx) {
  const { id } = ctx.params;
  const { days = "30" } = ctx.parseQuery() || {};
  // ...
};

// PUT /user/notifications/read/:id
export const PUT_user_notifications_read$id: JetRoute<{
  params: { id: string };
}> = async (ctx) => {
  await prisma.notification.update({
    where: { id: ctx.params.id, user_id: ctx.state.user.id },
    data: { is_read: true },
  });
  ctx.send({ ok: true, message: "Notification marked as read" });
};

// POST /admin/send/notification/user/:userId
export const POST_admin_send_notification_user$userId: JetRoute<{
  params: { userId: string };
  body: { title: string; content: string };
}> = async (ctx) => {
  const { userId } = ctx.params;
  const { title, content } = await ctx.parse();
  // ...
};
```

### 3.3 Catch-All / Wildcard Routes (`$0`)

Match all remaining path segments. The wildcard value is accessed as `ctx.params["*"]`.

```typescript
// GET /files/* → Catches /files/images/photo.jpg, /files/docs/api/v1, etc.
export const GET_files_$0: JetRoute = (ctx) => {
  const filePath = ctx.params["*"];  // e.g., "images/photo.jpg"
  ctx.sendStream(filePath, { folder: "./uploads" });
};
```

### 3.4 Route Precedence

Jetpath uses a **trie with hashmap fast-path**:
1. **Exact/static routes** → O(1) hashmap lookup (fastest)
2. **Parameterized routes** (`:id`) → Trie traversal
3. **Wildcard routes** (`*`) → Match last

`/users/search` always takes priority over `/users/:id` when path is `/users/search`.

---

## 4. Context Object (`ctx`)

The `ctx` object is the central interface for every request. It is pooled and reused.

### 4.1 Properties

| Property | Type | Description |
|----------|------|-------------|
| `ctx.request` | `Request` | The underlying Request object (Web API on Bun/Deno, IncomingMessage on Node) |
| `ctx.params` | `Record<string, string>` | Route parameters from dynamic segments |
| `ctx.code` | `number` | HTTP status code. Read/write. Default: 200 |
| `ctx.path` | `string` | Request pathname (no query string) |
| `ctx.state` | `Record<string, any>` | Request-scoped data bag. Pass data between middleware and handlers |
| `ctx.plugins` | `Record<string, any>` | Methods from registered plugins |
| `ctx.connection` | `jet_socket` | WebSocket connection (only after `ctx.upgrade()`) |

### 4.2 Methods

#### `ctx.send(data, statusCode?, contentType?)`
Primary response method. Objects auto-serialize to JSON.

```typescript
// JSON response (most common — objects auto-serialize)
ctx.send({ data: result, ok: true });

// With explicit status code
ctx.send({ error: "Not found" }, 404);

// Set code first, then send
ctx.code = 201;
ctx.send({ id: newId, message: "Created" });

// Plain text / CSV with custom content type
ctx.set("Content-Type", "text/csv");
ctx.set("Content-Disposition", `attachment; filename="export.csv"`);
ctx.send(csvContent);
```

#### `ctx.parse(options?): Promise<Record<string, any>>`
Parses request body. Supports JSON, multipart/form-data, URL-encoded. Auto-validates against `use(route).body()` schema if defined. Results are cached — calling twice returns cached result.

```typescript
const body = await ctx.parse();

// With size limit:
const body = await ctx.parse({ maxBodySize: 26 * 1024 * 1024 }); // 26MB
```

**CRITICAL: `ctx.parse()` is async — you MUST `await` it.**

**What happens internally:**
1. Reads the request body stream
2. Parses based on `Content-Type` header (JSON, form-data, URL-encoded)
3. If a `use(route).body()` schema exists, validates and strips unknown fields
4. Returns the parsed (and optionally validated) object

#### `ctx.parseQuery(): Record<string, any>`
Parses URL query parameters. Auto-validates against `use(route).query()` schema if defined. Results are cached.

```typescript
// URL: /users?status=active&limit=50&offset=0&search=john
const { status, date_from, date_to, limit = "50", offset = "0", search } = ctx.parseQuery() || {};

// Alternative: destructure into variables with defaults
const query = ctx.parseQuery();
const page = parseInt(query.page || "1");
const limit = parseInt(query.limit || "50");
```

**NOTE: `ctx.parseQuery()` is synchronous — no `await` needed.**

#### `ctx.get(field): string | undefined`
Read a request header (case-insensitive).

```typescript
const auth = ctx.get("authorization");
const origin = ctx.get("origin");
const ip = ctx.get("x-forwarded-for") || ctx.get("x-real-ip");
const userAgent = ctx.get("user-agent");
```

#### `ctx.set(field, value): void`
Set a response header.

```typescript
ctx.set("Cache-Control", "no-cache");
ctx.set("X-Request-ID", requestId);
ctx.set("X-RateLimit-Limit", "100");
ctx.set("X-RateLimit-Remaining", remaining.toString());
```

#### `ctx.redirect(url): void`
Send a 301 redirect.

```typescript
ctx.redirect("/dashboard");
ctx.redirect(`${client_link}/login?success=true&token=${token}`);
ctx.redirect(`${client_link}/login?error=oauth_failed`);
```

#### `ctx.sendStream(streamOrPath, config?): void`
Send a file or stream response. Path traversal protection is enforced when using `folder`.

```typescript
// Send file by path
ctx.sendStream("photo.jpg", { folder: "./uploads", ContentType: "image/jpeg" });

// Send stream directly
ctx.sendStream(readableStream);

// Serve static files from a folder
ctx.sendStream(ctx.params["*"], { folder: "src/site/" });
```

#### `ctx.sendResponse(response?: Response): void`
Send a raw Web Standard Response object. **Only works on Bun and Deno.** Used for SSE (Server-Sent Events) and custom streaming.

```typescript
// SSE stream (production pattern):
const stream = new ReadableStream({
  start(controller) {
    const encoder = new TextEncoder();
    function send(chunk: string) {
      controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
    }
    // ... register send function, send events ...
  },
});

ctx.sendResponse(
  new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  })
);
```

#### `ctx.upgrade(): void`
Upgrade HTTP to WebSocket. **Only Bun/Deno. Requires `upgrade: true` in server options.**

```typescript
ctx.upgrade();
const conn = ctx.connection!;

conn.addEventListener("open", async (socket) => {
  socket.send(JSON.stringify({ type: "welcome" }));
});

conn.addEventListener("message", async (socket, event) => {
  const data = JSON.parse(event.data.toString());
  if (data?.type === "ping") {
    socket.send(JSON.stringify({ type: "pong" }));
    return;
  }
  // Process message...
});

conn.addEventListener("close", () => {
  // Cleanup...
});
```

#### Cookie Methods

```typescript
ctx.setCookie("session", "abc123", {
  httpOnly: true, secure: true, maxAge: 3600,
  sameSite: "strict", path: "/", domain: "example.com",
});
const session = ctx.getCookie("session");
const cookies = ctx.getCookies();
ctx.clearCookie("session", {});
```

### 4.3 Type Safety with Generics

```typescript
import { type JetRoute } from "jetpath";

// Full type safety on body, params, query:
export const POST_sms_send: JetRoute<{
  body: {
    to: string;
    message: string;
    sender_id: string;
    callback_url?: string;
    marker?: string;
  };
}> = async function (ctx) {
  const { to, message, callback_url, sender_id, marker } = await ctx.parse();
  // All fields are typed ↑
};

// With plugin types:
import type { throwingPluginType } from "../plugins.ts";

export const GET_admin: JetRoute<{}, [throwingPluginType]> = (ctx) => {
  ctx.plugins.throw(403, "Admin only"); // typed!
};
```

---

## 5. Middleware

### 5.1 Global Middleware

A bare `MIDDLEWARE_` export (no suffix) applies to **ALL routes** in the scan tree:

```typescript
import { type JetMiddleware } from "jetpath";

// This is from a live production API:
export const MIDDLEWARE_: JetMiddleware = async function (ctx) {
  const { url, method } = ctx.request as { url: string; method: string };
  console.log(method, url);

  // Pre-parse body for non-GET/DELETE requests
  if (method !== "GET" && method !== "DELETE") {
    try {
      await ctx.parse({ maxBodySize: 26 * 1024 * 1024 });
    } catch (error: any) {
      ctx.plugins.throw(error.message);
    }
  }

  // Return post-handler for error handling
  return (ctx, err) => {
    if (!err) return;
    if (ctx.code < 400) ctx.code = 400;
    console.error(err);
    ctx.send({
      code: ctx.code,
      ok: false,
      message: String(err?.message || err),
    });
  };
};
```

### 5.2 Scoped Middleware — Assigning from External Modules

The **production pattern** is to define middleware in regular `.ts` files and assign them via exports in `.jet.ts` files:

```typescript
// src/middleware/auth.ts (regular .ts file — NOT scanned for routes)
import { type JetMiddleware } from "jetpath";
import { auth } from "../main.jet.ts";
import { prisma } from "../db/index.ts";

export const authMiddleware: JetMiddleware = async function (ctx) {
  const authHeader = ctx.get("authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) {
    ctx.plugins.throw(401, "Authentication required");
    return;
  }
  const payload = await auth.decode(token);
  if (!payload) ctx.plugins.throw(500, "");
  await auth.verify(token, "access");

  const user = await prisma.user.findUnique({
    where: { id: payload.id as string },
  });
  if (!user || !user.is_active) {
    ctx.plugins.throw(401, "Inaccessible user");
    return;
  }

  ctx.state.user = user;
};

export const adminOrModeratorMiddleware: JetMiddleware = async function (ctx) {
  if (!(ctx.state.user?.is_admin || ctx.state.user?.is_moderator)) {
    ctx.plugins.throw(403, "access required");
    return;
  }
};

export const AdminOnlyMiddleware: JetMiddleware = async function (ctx) {
  if (ctx.state.user?.is_moderator || !ctx.state.user?.is_admin) {
    ctx.plugins.throw(403, "access required");
    return;
  }
};
```

```typescript
// src/app/users.jet.ts — assign middleware by exporting
import { authMiddleware } from "../middleware/auth.ts";

// Scopes authMiddleware to /user/* routes AND /account/* routes
export const MIDDLEWARE_user = authMiddleware;
export const MIDDLEWARE_account = authMiddleware;

// Now all GET_user_*, POST_user_*, GET_account_* routes in this file
// automatically have authMiddleware applied
export const GET_user: JetRoute = async function (ctx) {
  const user = ctx.state.user;  // Set by authMiddleware
  ctx.send({ data: user, ok: true });
};
```

### 5.3 Middleware Arrays — Stacking Multiple Middleware

Assign an array for multi-step middleware chains:

```typescript
import { authMiddleware, adminOrModeratorMiddleware, AdminOnlyMiddleware } from "../middleware/auth.ts";

// Admin routes: auth + admin-or-moderator check (two middleware in sequence)
export const MIDDLEWARE_admin = [authMiddleware, adminOrModeratorMiddleware] as any;

// SMPP routes: auth + admin-only check
export const MIDDLEWARE_smpp = [authMiddleware, AdminOnlyMiddleware] as any;

// Prices routes: auth only
export const MIDDLEWARE_prices = [authMiddleware] as any;
```

### 5.4 Rate Limiting as Middleware

```typescript
// src/middleware/rate-limit.ts
export function createRateLimiter(config: { windowMs: number; maxRequests: number }) {
  return async (ctx: any) => {
    const username = ctx.state?.user?.username || "anonymous";
    // ... sliding window rate limit logic ...
    if (isRateLimited) {
      ctx.set("X-RateLimit-Limit", config.maxRequests.toString());
      ctx.set("X-RateLimit-Remaining", "0");
      ctx.set("Retry-After", retryAfter.toString());
      return ctx.send({
        ok: false,
        message: "Rate limit exceeded. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
      }, 429);
    }
    ctx.set("X-RateLimit-Remaining", remaining.toString());
  };
}

export const rateLimiters = {
  chatMessages: createRateLimiter({ windowMs: 60_000, maxRequests: 10 }),
  aiRequests: createRateLimiter({ windowMs: 60_000, maxRequests: 5 }),
  fileUploads: createRateLimiter({ windowMs: 60_000, maxRequests: 3 }),
};
```

```typescript
// src/app/support.jet.ts — assign rate limiter as scoped middleware
import { rateLimiters } from "../middleware/rate-limit.ts";

export const MIDDLEWARE_support_chat_send = [rateLimiters.chatMessages];
```

### 5.5 Middleware Execution Order & Short-Circuiting

```
Request
  → Global MIDDLEWARE_ pre-handler
    → Scoped MIDDLEWARE_prefix pre-handler
      → Route Handler
    ← Scoped post-handler (reverse order)
  ← Global post-handler (reverse order)
Response
```

**Short-circuiting:** If a pre-handler calls `ctx.send()` or `ctx.plugins.throw()`, the route handler is SKIPPED:

```typescript
export const MIDDLEWARE_: JetMiddleware = (ctx) => {
  if (!ctx.get("authorization")) {
    ctx.send({ error: "Unauthorized" }, 401);
    return;  // No post-handler → route handler never runs
  }
};
```

### 5.6 Middleware Naming Convention

Middleware scoping follows the same underscore-to-slash convention as routes:
- `MIDDLEWARE_admin` → matches routes starting with `/admin`
- `MIDDLEWARE_api_v1` → matches routes starting with `/api/v1`
- `MIDDLEWARE_sms` → matches routes starting with `/sms`
- `MIDDLEWARE_telegram_link` → matches routes starting with `/telegram/link`
- `MIDDLEWARE_support_chat_send` → matches routes starting with `/support/chat/send`

---

## 6. Validation with `use()`

### 6.1 Body Validation

```typescript
import { type JetRoute, use } from "jetpath";

export const POST_sms_send: JetRoute<{
  body: { to: string; message: string; sender_id: string; callback_url?: string };
}> = async function (ctx) {
  const { to, message, callback_url, sender_id } = await ctx.parse();
  // Validated ↑ — unknown fields stripped, types enforced
  ctx.send({ status: "queued", to });
};

use(POST_sms_send).body((t) => ({
  to: t.string().regex(/^\+?[0-9]{7,15}$/).required(),
  from: t.string().optional().default("vortex"),
  message: t.string().min(1).max(1600).required().default("Hello from SMS Route!"),
  callback_url: t.string().url().optional(),
  marker: t.string().optional(),
}));
```

### 6.2 Query Validation

```typescript
export const GET_admin_users: JetRoute<{
  query: { status?: string; limit?: string; offset?: string; search?: string };
}> = async function (ctx) {
  const { status, limit = "50", offset = "0", search } = ctx.parseQuery() || {};
  // ...
};

use(GET_admin_users).query((t) => ({
  status: t.string().optional(),
  date_from: t.string().optional(),
  date_to: t.string().optional(),
  limit: t.string().optional().default("50"),
  offset: t.string().optional().default("0"),
  search: t.string().optional(),
}));
```

### 6.3 Array Validation

```typescript
use(POST_sms_validate).body((t) => ({
  message: t.string().min(1).max(1600).required(),
  recipients: t.array(t.string().regex(/^\+?[0-9]{7,15}$/)).min(1).required(),
}));

// Array of objects:
use(POST_hlr_export).body((t) => ({
  results: t.array(t.object()).required(),
}));
```

### 6.4 Schema Builder Reference (`t`)

| Builder | Methods |
|---------|---------|
| `t.string(opts?)` | `.required()`, `.optional()`, `.default(val)`, `.email()`, `.url()`, `.min(n)`, `.max(n)`, `.regex(pattern)`, `.validate(fn)` |
| `t.number(opts?)` | `.required()`, `.optional()`, `.default(val)`, `.min(n)`, `.max(n)`, `.integer()`, `.positive()`, `.negative()`, `.validate(fn)` |
| `t.boolean()` | `.required()`, `.optional()`, `.default(val)` |
| `t.array(itemSchema?)` | `.required()`, `.optional()`, `.min(n)`, `.max(n)`, `.nonempty()` |
| `t.object(shape?)` | `.required()`, `.optional()` |
| `t.date()` | `.required()`, `.optional()`, `.min(date)`, `.max(date)`, `.future()`, `.past()` |
| `t.file(opts?)` | `.required()`, `.maxSize(bytes)`, `.mimeType(types)` |

The `opts?` parameter for `t.string()` and `t.number()` accepts `{ err?: string }` for custom error messages:

```typescript
use(POST_auth_login).body((t) => ({
  email: t.string({ err: "Invalid email format" }).required().default("user@example.com"),
  password: t.string({ err: "Password is required" }).required().default("password123"),
  turnstileToken: t.string().optional().default(""),
}));
```

### 6.5 Title & Description (API Docs)

```typescript
use(GET_users)
  .title("List Users")
  .description("Returns a paginated list of users.");
```

All `use()` methods are chainable:

```typescript
use(POST_users)
  .title("Create User")
  .body((t) => ({ name: t.string().required(), email: t.string().email().required() }));
```

### 6.6 Mass-Assignment Protection

The validator **only passes through fields defined in the schema**. Unknown fields are silently stripped. This prevents clients from sending `isAdmin: true` or other fields you didn't define.

---

## 7. Error Handling

### 7.1 The Throwing Plugin Pattern (Production Standard)

The standard production pattern is a throwing plugin that sets the response AND throws to trigger the middleware error chain:

```typescript
// plugins.ts
import { type JetContext } from "jetpath";

export const throwingPlugin = {
  name: "throwingPlugin",
  executor() {
    return {
      throw(this: any, code: any = 400, message: any = "") {
        const self = this as JetContext;
        // Support calling throw("message") without a code
        if (typeof code !== "number") {
          message = code;
          code = 400;
        }
        const payload = {
          ok: false,
          message: String((message as any)?.message || message || ""),
        };
        self.send(payload, Number(code) || 400);
        throw new Error(payload.message);
      },
    };
  },
};

export type throwingPluginType = ReturnType<typeof throwingPlugin.executor>;
```

Register in `main.jet.ts`:

```typescript
import { throwingPlugin } from "../plugins.ts";
app.derivePlugins(throwingPlugin);
```

### 7.2 Using `ctx.plugins.throw()` in Handlers

```typescript
// With status code + message (most common):
ctx.plugins.throw(400, "Invalid recipient phone number");
ctx.plugins.throw(401, "Authentication required");
ctx.plugins.throw(403, "access required");
ctx.plugins.throw(404, "User not found");
ctx.plugins.throw(500, "Failed to process SMS request");

// With just a message (defaults to 400):
ctx.plugins.throw("Something went wrong");

// With error object:
ctx.plugins.throw(error.message);

// IMPORTANT: After ctx.plugins.throw(), execution continues
// because throw happens inside the plugin — always return after:
if (!user) {
  ctx.plugins.throw(404, "User not found");
  return;  // ← MUST return after throw
}
```

### 7.3 Alternative: Direct `ctx.send()` for Errors

Some production routes use `ctx.send()` directly with a status code instead of the plugin:

```typescript
if (!title || !content) {
  ctx.send({ ok: false, message: "Title and content are required." }, 400);
  return;
}

// Or set code first:
ctx.code = 503;
ctx.send({
  data: { status: "unhealthy", error: "Database connection failed" },
  ok: false,
});
```

### 7.4 Error Middleware (Post-Handler)

The global middleware post-handler catches all unhandled errors:

```typescript
return (ctx, err) => {
  if (!err) return;
  if (ctx.code < 400) ctx.code = 400;
  const { code, message } = mapErrorToCode(ctx.code, err);
  console.error(err);
  ctx.send({ code, ok: false, message });
};
```

### 7.5 Try/Catch in Handlers

For operations that can fail (DB, external APIs), wrap in try/catch:

```typescript
export const POST_sms_send: JetRoute = async function (ctx) {
  // ... validation ...

  try {
    const smsId = await prisma.$transaction(async (tx: any) => {
      // Atomic operations...
      return log.id;
    });

    ctx.send({ messageId: smsId, status: "queued" });
  } catch (error) {
    console.error("SMS sending error:", error);
    ctx.plugins.throw(500, "Failed to process SMS request");
  }
};
```

---

## 8. Plugins

### 8.1 Plugin Structure

```typescript
export const myPlugin = {
  name: "myPlugin",        // Required: unique string identifier
  executor() {             // Required: returns the public API
    return {
      // Methods here are available on ctx.plugins
      // `this` is bound to the current ctx at runtime
      myMethod(this: any, arg: string) {
        const ctx = this as JetContext;
        // can access ctx.send(), ctx.state, etc.
      },
    };
  },
};
```

**CRITICAL:** Plugin methods have `this` bound to the current `ctx` at runtime via `Function.prototype.bind()`.

### 8.2 Registration & Typing

```typescript
// Register:
app.derivePlugins(throwingPlugin, loggerPlugin);

// Type export for use in handlers:
export type throwingPluginType = ReturnType<typeof throwingPlugin.executor>;

// Use in route generics:
export const GET_admin: JetRoute<{}, [throwingPluginType]> = (ctx) => {
  ctx.plugins.throw(403, "Forbidden"); // typed
};
```

---

## 9. SSE (Server-Sent Events) — Production Pattern

SSE is implemented using `ctx.sendResponse()` with a `ReadableStream`:

```typescript
export const GET_support_chat_stream: JetRoute<{
  query: { sessionId: string };
}> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const sessionId = url.searchParams.get("sessionId") || "";
  if (!sessionId) {
    return ctx.plugins.throw(400, "Missing sessionId");
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(chunk: string) {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      }

      // Register this client
      if (!sseClients[sessionId]) sseClients[sessionId] = new Set();
      sseClients[sessionId].add(send);

      // Send initial data
      (async () => {
        const msgs = await prisma.chatMessage.findMany({
          where: { session_id: sessionId },
          orderBy: { timestamp: "asc" },
        });
        send(JSON.stringify({ type: "history", messages: msgs }));
        send(JSON.stringify({ type: "welcome", sessionId }));
      })();

      // Keepalive ping to prevent proxy timeouts
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {}
      }, 15000);

      // Cleanup on disconnect
      const onAbort = () => {
        sseClients[sessionId]?.delete(send);
        if (sseClients[sessionId]?.size === 0) delete sseClients[sessionId];
        clearInterval(keepalive);
        ctx.request.signal.removeEventListener("abort", onAbort);
        try { controller.close(); } catch {}
      };
      ctx.request.signal.addEventListener("abort", onAbort);
    },
  });

  return ctx.sendResponse(
    new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    })
  );
};
```

---

## 10. WebSocket Routes — Production Pattern

WebSocket uses a regular `GET_` route + `ctx.upgrade()`. **Requires `upgrade: true` in server options. Bun/Deno only.**

```typescript
export const GET_support_chat_websocket: JetRoute<{
  query: { sessionId: string; isSupport?: string };
}> = (ctx) => {
  ctx.upgrade();
  const conn = ctx.connection!;

  conn.addEventListener("open", async (socket) => {
    const sessionId = ctx.parseQuery().sessionId || "";
    if (!sessionId) { socket.close(); return; }

    if (!connections[sessionId]) connections[sessionId] = new Set();
    connections[sessionId].add(socket);

    const msgs = await prisma.chatMessage.findMany({
      where: { session_id: sessionId },
      orderBy: { timestamp: "asc" },
    });
    socket.send(JSON.stringify({ type: "history", messages: msgs }));
    socket.send(JSON.stringify({ type: "welcome" }));
  });

  conn.addEventListener("message", async (socket, event) => {
    const data = JSON.parse(event.data.toString());
    if (data?.type === "ping") {
      socket.send(JSON.stringify({ type: "pong" }));
      return;
    }
    // Process message, save to DB, broadcast to session...
  });

  conn.addEventListener("close", () => {
    // Cleanup connection from tracking sets
  });
};
```

---

## 11. Exports from `"jetpath"`

```typescript
import { Jetpath } from "jetpath";                // Main class
import { type JetRoute } from "jetpath";           // Route handler type
import { type JetMiddleware } from "jetpath";       // Middleware type
import { type JetContext } from "jetpath";           // Context type
import { type JetFile } from "jetpath";              // File upload type: { fileName, content: Uint8Array, mimeType, size }
import { use } from "jetpath";                       // Validation/docs helper
import { JetServer } from "jetpath";                 // Testing harness
```

---

## 12. Production Patterns

### 12.1 Project File Organization

One resource domain per `.jet.ts` file:
- `auth.jet.ts` — login, register, OAuth
- `users.jet.ts` — user CRUD, profile, settings
- `admin.jet.ts` — admin-only operations
- `payments.jet.ts` — deposits, orders, payment callbacks
- `sms.jet.ts` — SMS sending, campaigns, bulk operations
- `monitoring.jet.ts` — gateway status, queue stats, health checks
- `support.jet.ts` — chat, SSE streaming, WebSocket
- `analytics.jet.ts` — event tracking, reporting
- `notification.jet.ts` — user notifications

### 12.2 Multi-Prefix Middleware in a Single File

A `.jet.ts` file can export middleware for multiple route prefixes. This is how a single file handles routes under different path prefixes while applying different middleware:

```typescript
// src/app/sms.jet.ts
export const MIDDLEWARE_sms = authMiddleware;
export const MIDDLEWARE_campaigns = authMiddleware;

// src/app/payments.jet.ts
export const MIDDLEWARE_deposits = authMiddleware;
export const MIDDLEWARE_orders = authMiddleware;

// src/app/admin.jet.ts — with stacked middleware arrays
export const MIDDLEWARE_admin = [authMiddleware, adminOrModeratorMiddleware] as any;
export const MIDDLEWARE_smpp = [authMiddleware, AdminOnlyMiddleware] as any;
export const MIDDLEWARE_prices = [authMiddleware] as any;
```

### 12.3 Common Response Shapes

```typescript
// Success
ctx.send({ data: result, ok: true });
ctx.send({ data: result, ok: true }, 201);

// Success with pagination
ctx.send({
  data: items,
  pagination: {
    total,
    limit: parseInt(limit),
    offset: parseInt(offset),
    has_more: total > parseInt(offset) + parseInt(limit),
  },
  ok: true,
});

// Success with message
ctx.send({ ok: true, message: "Notification marked as read" });

// Error
ctx.plugins.throw(400, "Invalid input");
ctx.plugins.throw(401, "Authentication required");
ctx.plugins.throw(404, "User not found");

// Error without plugin
ctx.send({ ok: false, message: "Title and content are required." }, 400);
```

### 12.4 Database Transaction Pattern (Prisma)

Atomic operations with balance checks — a core production pattern:

```typescript
const smsId = await prisma.$transaction(async (tx: any) => {
  // Atomic balance deduction with optimistic locking
  const updatedUser = await tx.user.updateMany({
    where: {
      id: user.id,
      balance: { gte: totalCost },  // Prevents negative balance
    },
    data: { balance: { decrement: totalCost } },
  });

  if (updatedUser.count === 0) {
    throw new Error(
      `Insufficient balance. Required: €${totalCost.toFixed(4)}, Available: €${Number(user.balance).toFixed(2)}`
    );
  }

  // Create transaction record
  await tx.transaction.create({
    data: {
      user_id: user.id,
      type: "SMS_COST",
      amount: totalCost,
      status: "FINISHED",
      order_id: `sms_${user.id}_${nanoid(10)}`,
    },
  });

  // Create the resource
  const log = await tx.smsLog.create({
    data: { user_id: user.id, recipient_number: to, message_content: message, status: "QUEUED", cost: totalCost },
  });

  return log.id;
});
```

### 12.5 Webhook Pattern (No Auth)

External webhooks (Telegram, payment callbacks) skip auth middleware:

```typescript
// No MIDDLEWARE_ export for /telegram/webhook* prefix = no auth

export const POST_telegram_webhook1: JetRoute<{ body: any }> = async function (ctx) {
  try {
    const update = await ctx.parse();

    // Process asynchronously — respond immediately
    handleTelegramWebhook(update, 1).catch((error) => {
      console.error("Telegram webhook processing error:", error);
    });

    ctx.send({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    ctx.send({ ok: false }, 500);
  }
};
```

### 12.6 Auth Route Pattern (Login)

```typescript
export const POST_auth_login: JetRoute<{
  body: { password: string; email: string; turnstileToken: string };
}> = async function (ctx) {
  const { email, password } = await ctx.parse();
  if (!email || !password) {
    ctx.plugins.throw(400, "Email and password are required");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) {
    ctx.plugins.throw(400, "Invalid email/username or password");
    return;
  }
  if (!user.is_active) {
    ctx.plugins.throw(400, "Account is not accessible");
    return;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    ctx.plugins.throw(400, "Invalid email/username or password");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  const token = await auth.create({ id: user.id });
  const { password_hash, ...userResponse } = user;

  ctx.send({ data: { user: userResponse, token }, ok: true });
};

use(POST_auth_login).body((t) => ({
  email: t.string({ err: "Invalid email format" }).required().default("user@example.com"),
  password: t.string({ err: "Password is required" }).required().default("password123"),
  turnstileToken: t.string().optional().default(""),
}));
```

### 12.7 OAuth Redirect Pattern

```typescript
export const GET_auth_google: JetRoute = (ctx) => {
  ctx.redirect(googleAuthUrl);
};

export const GET_auth_google_callback: JetRoute<{
  query: { code: string };
}> = async (ctx) => {
  const { code } = ctx.parseQuery();
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
    });
    if (!tokenResponse.ok) { ctx.redirect(`${client_link}/login?error=oauth_failed`); return; }

    const { access_token } = await tokenResponse.json();
    // ... find/create user, generate token ...

    ctx.redirect(`${client_link}/login?success=true&token=${token}`);
  } catch (error) {
    ctx.redirect(`${client_link}/login?error=oauth_error`);
  }
};
```

### 12.8 CSV Export Pattern

```typescript
export const POST_hlr_export: JetRoute<{ body: { results: any[] } }> = async function (ctx) {
  const { results } = await ctx.parse();
  if (!results || results.length === 0) {
    ctx.plugins.throw(400, "No results to export");
    return;
  }

  const csvLines = ["Phone Number,Number Type,Status"];
  for (const result of results) {
    const row = [result.phone_number, result.number_type, result.status];
    const escaped = row.map((f) => {
      const s = String(f);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    csvLines.push(escaped.join(","));
  }

  ctx.set("Content-Type", "text/csv");
  ctx.set("Content-Disposition", `attachment; filename="export-${new Date().toISOString().replace(/[:.]/g, "-")}.csv"`);
  ctx.send(csvLines.join("\n"));
};
```

### 12.9 Async Fire-and-Forget

Use `queueMicrotask()` for non-blocking background work after responding:

```typescript
ctx.send({ messageId: smsId, status: "queued" });

// Process SMS queue AFTER response is sent
queueMicrotask(() => {
  processSMSQueue();
});
```

### 12.10 Non-Route Exports from `.jet.ts` Files

`.jet.ts` files can export regular functions/constants that don't match the `METHOD_path` pattern. They won't become routes:

```typescript
// notification.jet.ts — this is just a helper function, not a route
export const sendNotification = async (user_id: string, message: string, title: string) => {
  const notification = await prisma.notification.create({
    data: { user_id, content: message, title },
  });
  return notification;
};

// This IS a route:
export const GET_user_notifications: JetRoute = async (ctx) => { /* ... */ };
```

### 12.11 IP Whitelisting Pattern

```typescript
const ipWhitelist: string[] = (process.env.IP_WHITELIST || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getClientIp(ctx: any): string {
  const xff = ctx.get("x-forwarded-for");
  const direct = (xff && xff.split(",")[0]) || ctx.request.socket?.remoteAddress || ctx.request.ip || "";
  return String(direct).replace(/^::ffff:/, "");
}

// In handler:
const clientIp = getClientIp(ctx);
if (ipWhitelist.length && !ipWhitelist.includes(clientIp)) {
  ctx.send({ success: true, message: "Access denied", blocked: true });
  return;
}
```

---

## 13. Critical Rules & Gotchas

1. **`ctx.parse()` is async** — always `await` it.
2. **`ctx.parseQuery()` is synchronous** — no `await`.
3. **Always `return` after `ctx.plugins.throw()` or error `ctx.send()`** — execution continues otherwise.
4. **`.jet.ts` extension is mandatory** for route files. Regular `.ts` files are NOT scanned.
5. **`use()` must be called at module scope** (top-level, not inside functions). It attaches schemas to the function object.
6. **Validation happens lazily**: body validation at `ctx.parse()` time, query validation at `ctx.parseQuery()` time.
7. **Unknown body fields are stripped** by the validator (mass-assignment protection).
8. **WebSockets require `upgrade: true`** in constructor. Only Bun/Deno.
9. **Plugin `executor()` methods get `this` bound to `ctx`** at runtime.
10. **Middleware matching is by path prefix**: `MIDDLEWARE_admin` → matches `/admin/*`.
11. **Duplicate routes throw**: Each `METHOD + path` combination must be unique.
12. **Context objects are pooled** — don't hold references after handler completes.
13. **`sendResponse()` only works on Bun/Deno** — not Node.js.
14. **Double underscores `__` become hyphens `-`** in route paths: `POST_deposits__2` → `POST /deposits-2`.
15. **`$0` is the wildcard** (catch-all) — accessed via `ctx.params["*"]`.
16. **`$paramName` becomes `:paramName`** — accessed via `ctx.params.paramName`.
17. **Middleware can be a single function or an array** — use `as any` for array casting when needed.
18. **`default()` values in validation schemas** appear as placeholder values in the auto-generated API documentation.
