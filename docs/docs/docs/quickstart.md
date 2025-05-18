<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 
 
# Quick Start Guide

Let's build your first Jetpath application! This guide will walk you through creating a simple API server that returns a welcome message.

## Prerequisites

Before you start, make sure you have:

1. A compatible JavaScript runtime (Node.js v18+, Deno v1.30+, or Bun v1.0+)

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
│   │   ├── carts.jet.ts
│   │   ├── products.jet.ts
│   │   └── users.jet.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── interfaces.ts
│   │   └── index.ts
│   └── site/
│       ├── index.html
│       ├── about.html
│       └── contact.html
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
npm install # or yarn install or pnpm install or bun install
```

## Create Your First Route

Create a file named `users.jet.ts` in the `src` directory:

```typescript
// src/users.jet.ts
import { type JetRoute, use } from "jetpath";

/**
 * Handles GET requests to the root path ('/')
 */
export const GET_users: JetRoute = (ctx) => {
  ctx.send({
    message: "Welcome to your first Jetpath API!",
    status: "ok"
  });
};

use(GET_users).title("Returns a welcome message and API status.");
```

## Create the Server Entry Point

Create a file named `server.ts` in your project root:

```typescript
// server.ts
import { Jetpath } from "jetpath";

const app = new Jetpath({
  source: "./src",
  port: 3000,
  apiDoc: {
    name: "My First Jetpath API",
    info: "This is the documentation for the Quick Start API.",
    color: "#7e57c2"
    display: "UI"
  },
});

app.listen();
```

## Run Your Server

```bash
npx run dev
```

## Verify It Works

1. Open your browser and navigate to `http://localhost:3000` to see the JSON response
2. Visit `http://localhost:3000/api-docs` to explore the interactive API documentation

**Congratulations! You've successfully created and run your first Jetpath application!**

## Next Steps

Now that you have a basic server running, explore further:

  * **Core Concepts:** Learn about [Routing](./routing.md), the [Context Object](./context.md), [Validation](./validation.md), and [Middleware](./middleware.md).
  * **Guides:** Build more complex features by following the practical [Guides](./guides/crud-api.md).
  
 

</docmach>



