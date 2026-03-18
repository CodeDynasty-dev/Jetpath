<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 
 
# Quick Start Guide

Let's build your first Jetpath application! This guide will walk you through creating a simple API server.

## Prerequisites

Before you start, make sure you have:

- A compatible JavaScript runtime (Node.js v18+, Deno v1.30+, or Bun v1.0+)

## Create a New Project

```bash
npx jetpath my-api
```

Your project structure will look like this:

```
my-api/
├── src/
│   ├── app/
│   │   ├── auth.jet.ts
│   │   └── users.jet.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── interfaces.ts
│   │   └── index.ts
│   └── site/
│       └── index.html
├── package.json
├── .dockerignore
├── .gitignore
├── Dockerfile
├── README.md
├── fly.toml
└── tsconfig.json
```

## Install Dependencies

```bash
cd my-api
npm install # or bun install
```

## Create Your First Route

Create a file named `users.jet.ts` in the `src/app` directory:

```typescript
// src/app/users.jet.ts
import { type JetRoute, use } from "jetpath";

// Handles GET /users
export const GET_users: JetRoute = (ctx) => {
  ctx.send({
    message: "Welcome to your first Jetpath API!",
    status: "ok"
  });
};

// Add title and description for the auto-generated API docs
use(GET_users)
  .title("List Users")
  .description("Returns a welcome message and API status.");
```

## Create the Server Entry Point

Create a file named `server.jet.ts` in your project root (or `src/main.jet.ts`):

```typescript
import { Jetpath } from "jetpath";

const app = new Jetpath({
  source: "./src",
  port: 3000,
  apiDoc: {
    name: "My First Jetpath API",
    info: "Documentation for the Quick Start API.",
    color: "#7e57c2",
    display: "UI"
  }
});

app.listen();
```

## Run Your Server

```bash
bun server.jet.ts
# or
node --experimental-strip-types server.jet.ts
# or
deno run server.jet.ts
```

## Verify It Works

1. Open your browser and navigate to `http://localhost:3000/users` to see the JSON response
2. Visit `http://localhost:3000/api-doc` to explore the interactive API documentation

## Add a POST Route with Validation

```typescript
// src/app/users.jet.ts
import { type JetRoute, use } from "jetpath";

export const POST_users: JetRoute = async (ctx) => {
  const body = await ctx.parse();
  ctx.send({ message: `User ${body.name} created!` }, 201);
};

use(POST_users)
  .title("Create User")
  .description("Creates a new user account.")
  .body((t) => ({
    name: t.string().required(),
    email: t.string().required().email(),
    age: t.number().required().min(18),
  }));
```

The validation schema is automatically enforced when `ctx.parse()` is called, and it also generates interactive API documentation.

## Add Middleware

Create `src/app/middleware.jet.ts`:

```typescript
import { type JetMiddleware } from "jetpath";

// Global middleware — the MIDDLEWARE_ export name is the convention
export const MIDDLEWARE_: JetMiddleware = (ctx) => {
  const start = Date.now();
  console.log(`→ ${ctx.request.method} ${ctx.path}`);

  return (ctx, err) => {
    const ms = Date.now() - start;
    if (err) {
      ctx.code = ctx.code >= 400 ? ctx.code : 500;
      ctx.send({ error: String(err) }, ctx.code);
      return;
    }
    console.log(`← ${ctx.code} (${ms}ms)`);
  };
};
```

## Next Steps

- Learn about [Routing](./routing.html), the [Context Object](./context.html), [Validation](./validation.html), and [Middleware](./middleware.html)


</docmach>
