<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 

# Installation

Installing Jetpath is straightforward and adapts to your preferred runtime environment.

---

## Prerequisites

Before you begin, ensure you have one of the following installed:

1. **Node.js:** Version 18.x or later. ([Download Node.js](https://nodejs.org/))
2. **Bun:** Version 1.0 or later. ([Install Bun](https://bun.sh/docs/installation))
3. **Deno:** Version 1.30 or later. ([Install Deno](https://deno.land/manual/getting_started/installation))

Jetpath also supports edge runtimes (AWS Lambda, Cloudflare Workers) via the `edgeGrabber` option.

TypeScript is highly recommended for the best experience, though JavaScript works too.

---

## Quick Start with Template

The fastest way to get started:

```bash
npx jetpath my-new-api
cd my-new-api
npm install
npm run dev
```

This scaffolds a project with routes, middleware, and a ready-to-run server.

---

## Manual Setup

### 1. Create your project

```bash
mkdir my-api
cd my-api
npm init -y
npm install jetpath
```

### 2. Project Structure

A recommended structure:

```
my-api/
├── src/
│   ├── users.jet.ts      # Route handlers for /users
│   ├── products.jet.ts   # Route handlers for /products
│   └── auth.jet.ts       # Route handlers for /auth
├── server.jet.ts          # Main entry point
├── package.json
└── tsconfig.json
```

Key conventions:
- `.jet.ts` files are scanned for route exports
- Regular `.ts` files can be imported but aren't scanned for routes
- The `source` option in `Jetpath` config points to your route directory

### 3. Create your server

```typescript
// server.jet.ts
import { Jetpath } from "jetpath";

const app = new Jetpath({
  source: "./src",
  port: 3000,
});

app.listen();
```

### 4. Create a route

```typescript
// src/users.jet.ts
import { type JetRoute } from "jetpath";

export const GET_users: JetRoute = (ctx) => {
  ctx.send({ users: [] });
};
```

### 5. Run

```bash
bun server.jet.ts
# or
node --experimental-strip-types server.jet.ts
# or
deno run server.jet.ts
```

---

## Runtime-Specific Configuration

You can pass runtime-specific options via the `runtimes` key in the constructor:

```typescript
const app = new Jetpath({
  source: "./src",
  port: 3000,
  runtimes: {
    bun: {
      reusePort: true, // enable SO_REUSEPORT for multi-process clustering
    },
    // deno, node, aws_lambda, cloudflare_worker keys are also available
  },
});
```

### Runtime Notes

- **Bun:** Fastest startup and best WebSocket support. Recommended for development. Set `runtimes.bun.reusePort` to `true` to allow multiple Bun processes to bind to the same port for horizontal scaling.
- **Node.js:** Use `--experimental-strip-types` flag (Node 22+) or compile with `tsc` first.
- **Deno:** Works out of the box with TypeScript. WebSocket support included.
- **Edge (Lambda/Workers):** Use the `edgeGrabber` option to pass route functions directly instead of filesystem scanning.

## Next Steps

- Quick Start: Build your first API following the [Quick Start](./quickstart.html) guide.
- Core Concepts: Dive deeper into [Routing](./routing.html).
 
 

</docmach>
