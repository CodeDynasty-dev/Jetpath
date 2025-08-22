<p align="center">
  <img src="https://github.com/CodeDynasty-dev/Jetpath/raw/main/icon.png" alt="Jetpath" width="190" height="190">
</p>

<h1 align="center">Jetpath</h1>

<p align="center">
  A performance-first cross-runtime API framework without the boilerplate
  <br/>
  <br/>
  <a href="https://jetpath.codedynasty.dev"><strong>Documentation »</strong></a>
  <br/>
  <br/>
  <a href="https://discord.gg/faqydQASTy">Join Discord</a>
  ·
  <a href="https://github.com/codedynasty-dev/jetpath/issues">Report Bug</a>
  ·
  <a href="https://github.com/codedynasty-dev/jetpath/issues">Request Feature</a>
</p>

<div align="center">
  <a href="https://npm-stat.com/charts.html?package=jetpath">
    <img src="https://img.shields.io/npm/dm/jetpath" alt="Downloads per Month"/>
  </a>
  <a href="https://npm-stat.com/charts.html?package=jetpath">
    <img src="https://img.shields.io/npm/dy/jetpath" alt="Downloads per Year"/>
  </a>
  <a href="https://badge.fury.io/js/jetpath">
    <img src="https://badge.fury.io/js/jetpath.svg" alt="npm version">
  </a>
  <a href="https://github.com/codedynasty-dev/jetpath">
    <img src="https://img.shields.io/github/stars/codedynasty-dev/jetpath?style=social" alt="Stars"/>
  </a>
</div>

## Why Engineers Choose Jetpath

Every framework promises to be fast and easy but they are not, here is Jetpath.

```ts
// This is a complete API endpoint in Jetpath
export const GET_users_$id: JetRoute = async function (ctx) {
  const { id } = ctx.params;
  const user = await db.users.findUnique({ where: { id } });
  return ctx.send(user);
};
```

Jetpath eliminates the cognitive overhead that slows down development. No router configuration, middleware chains, or callback hell. Only pure functions that map directly to HTTP endpoints through a clean, predictable naming convention.

**The tech stack you already trust, but faster:**
- Write APIs in TypeScript/JavaScript across Node.js, Deno, or Bun
- ~50% less code than Express with stronger type safety
- [Benchmarks](https://github.com/CodeDynasty-dev/jetpath-benchmark) show massive throughput compared to Elysia.js *(JS faster Framework).

## Core Design Principles

Jetpath is built with strong opinions on what matters most:

1. **Zero config by default** - Convention eliminates boilerplate
2. **Runtime agnostic** - True support for Node.js, Deno, and Bun (not just compatibility layers)
3. **Type safety** - Full TypeScript support that doesn't get in your way
4. **Predictable routing** - Routes derived from function names (GET_users_$id → GET /users/:id)
5. **Built for production** - Security, validation, and error handling baked in

## In Production

I am using Jetpath in production and here are the results.
- 40% reduction in API codebase size
- Simplified onboarding for new team members
- Faster iterations on API endpoints

## Quick Start

```bash
# Create new project

npx jetpath new-project

# Navigate and start the dev server

cd new-project
npm install 
npm run dev
```

## API Design That makes everything simple and concise

```ts
import { type JetRoute, Jetpath, use } from "jetpath";

const app = new Jetpath();
app.listen(3000);

// GET /products
export const GET_products: JetRoute = async (ctx) => {
  const products = await db.products.findMany();
  ctx.send({ products });
};

// POST /products with validation
export const POST_products: JetRoute = async (ctx) => {
  const data = await ctx.parse();
  const product = await db.products.create({ data });
  ctx.send({ product }, 201);
};

// Add validation and docs in one step
use(POST_products)
  .title("Create a new product")
  .body((t) => ({
    name: t.string().required().min(3),
    price: t.number().required().min(0),
    description: t.string()
  }));

// Maps to ws://your-host/live instantly
export const GET_live: JetRoute = (ctx) => {
  ctx.upgrade();
  const conn = ctx.connection!;
  conn.addEventListener("open", (socket) => { /* ... */ });
  conn.addEventListener("message", (socket, event) => { /* ... */ });
};
```

## Key Features

- **Unified dev experience** across Node.js, Deno, and Bun
- **Auto-generated API documentation** with interactive UI
- **First-class WebSocket support**
- **Plugin system** for extending functionality
- **Schema validation** that is part of api documentation
- **Request parsing** Inbuilt (JSON, forms, multipart)
- **Performance-optimized** routing and middleware execution
- **Security** Great defaults

## Real Performance

It's not just a claim how fast - measure it. In the [benchmark suite](hhttps://github.com/CodeDynasty-dev/jetpath-benchmark), Jetpath consistently perform close to raw Bunjs performance matches elysia.js on common API workloads:

| Framework | Requests/sec | Latency (avg)
|-----------|-------------|---------------|
| Bun   | ~40,890       | 12.2ms        |
| Elysia   | ~33,383       | 13.2ms         |
| Jetpath   | ~32,339      | 13.7ms         |

*4-core CPU, 1000 concurrent connections and 1,000,000 requests, simple JSON response*

Bunjs being amongst the fastest http runtime.

## Installation

For existing projects:

```bash
npm install jetpath --save
```

## Community & Support

- [Documentation](https://jetpath.codedynasty.dev) - In-depth guides and API reference
- [Discord Community](https://discord.gg/faqydQASTy) - Get help from the team and other users
- [GitHub Issues](https://github.com/codedynasty-dev/jetpath/issues) - Report bugs or request features

## License

Apache 2.0 - Open source and built for the community.

### Contributing

We welcome contributions! See our [contributing guide](https://github.com/CodeDynasty-dev/Jetpath/blob/main/contributing.md) for details on how to get involved.

By contributing, you agree to license your code under the Apache 2.0 license and confirm that all contributions are your original work.

### Support or Sponsor the Project

If Jetpath helps you or your team ship faster and more understandable codebase, consider supporting its development through [GitHub Sponsors](https://github.com/sponsors/CodeDynasty-dev).