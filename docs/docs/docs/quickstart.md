<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 
 
# Quick Start Guide

Let's build your first Jetpath application! This guide will walk you through creating a simple API server that returns a welcome message.

---

## Goal

Create a basic Jetpath server with a single endpoint (`GET /`) that responds with JSON.

## Prerequisites

Before you start, make sure you have:

1.  Installed a compatible JavaScript runtime (Node.js v18+, Deno v1.30+, or Bun v1.0+).
2.  Completed the steps in the [**Installation Guide**](./installation.html) to install Jetpath and TypeScript.
---

## Build from from the basic template.
 

```bash
npx jetpath my-api
```

Your structure should look like this:

```
my-api/
└── src/ 
        └── app/
                └── auth.jet.ts
                └── carts.jet.ts
                └── products.jet.ts
                └── users.jet.ts
            └── db/
                └── schema.ts
                └── interfaces.ts
                └── index.ts                
            └── site/
                └── index.html
                └── about.html
                └── contact.html
└── package.json 
└── .dockerignore 
└── .gitignore
└── Dockerfile
└── README.md
└── fly.toml 
└── tsconfig.json
```

-----

## Install Dependencies

If you haven't already, install Jetpath and a schema library (we'll use Zod here). Choose the command for your runtime:

```shell
# cd into your project directory
cd my-api

# install dependencies
npm install # or yarn install or pnpm install or bun install
```

-----
  
 
## Create Your First Route

Inside the `src` directory, create a file named `users.jet.ts`. This file will automatically handle requests to the root path (`/`) of your API.

```typescript
// src/users.jet.ts
import { type JetRoute, use } from "jetpath";

/**
 * Handles GET requests to the root path ('/').
 */
export const GET_users: JetRoute = (ctx) => {
  // Use the context (ctx) to send a response
  ctx.send({
    message: "Welcome to your first Jetpath API!",
    status: "ok", 
  });
};

// Optional: Add description for API documentation
use(GET_users).info("Returns a welcome message and API status.");

```

**Explanation:**

  * We import the `JetRoute` type for better type checking of our handler.
  * We import the `use` function to add metadata for API documentation.
  * We export a constant named `GET_users`. 
  The `GET` part maps to the HTTP GET method, and the `users` combined with the filename `users.jet.ts` maps to the root path `/`.
  * The function receives the `ctx` (Context) object.
  * `ctx.send()` sends a JSON response back to the client. 
  Jetpath automatically sets the `Content-Type` header to `application/json` for objects.

-----

## Create the Server Entry Point

Now, create a file named `server.ts` in your project root (`my-api/`). This file initializes and starts the Jetpath server.

```typescript
// server.ts
import { Jetpath } from "jetpath";

// Define the port the server will listen on
const PORT = 3000;

// Create a new Jetpath instance
const app = new Jetpath({
  // Specify the directory containing your route files (.jet.ts)
  source: "./src",

  // Configure the server port
  port: PORT,

  // Configure API documentation generation (optional but recommended)
  apiDoc: {
    name: "My First Jetpath API",
    info: "This is the documentation for the Quick Start API.",
    color: "#7e57c2", // Choose a color!
  },
  APIdisplay: "UI", // Enable the interactive Swagger-like UI at /docs
});

// Start listening for incoming requests
app.listen();

// Log messages to the console
console.log(`🚀 Jetpath server running on http://localhost:${PORT}`);
console.log(`📚 API Docs available at http://localhost:${PORT}/docs`);

```

**Explanation:**

  * We import the main `Jetpath` class.
  * We create a new instance, passing configuration options:
      * `source`: Tells Jetpath where to find your route files.
      * `port`: The port number for the server.
      * `apiDoc`, `APIdisplay`: Configures the built-in documentation generator.
  * `app.listen()` starts the server.

-----

## Run Your Server

Open your terminal in the project root (`my-api`) and run the server using your chosen runtime:

```bash
# Using Node.js (you might need ts-node or compile first)
# Option 1: Use ts-node (if installed: npm install -D ts-node)
npx ts-node server.ts
# Option 2: Compile and run
# tsc && node dist/server.js

# Using Deno
deno run --allow-net --allow-read server.ts

# Using Bun
bun run server.ts
```

You should see the following output (or similar):

```
🚀 Jetpath server running on http://localhost:3000
📚 API Docs available at http://localhost:3000/docs
```

-----

## Verify It Works

1.  **Check the API:** Open your web browser and navigate to `http://localhost:3000`. You should see the JSON response:
    ```json
    {
      "message": "Welcome to your first Jetpath API!",
      "status": "ok",
      "timestamp": "..."
    }
    ```
2.  **Check the Docs:** Navigate to `http://localhost:3000/docs`. You should see the interactive API documentation UI, listing your `GET /` endpoint.

**Congratulations\! You've successfully created and run your first Jetpath application  \!**

-----

## Next Steps

Now that you have a basic server running, explore further:

  * **Core Concepts:** Learn about [Routing](./core-concepts/routing.md), the [Context Object](./core-concepts/context.md), [Validation](./core-concepts/validation.md), and [Middleware](./core-concepts/middleware.md).
  * **Guides:** Build more complex features by following the practical [Guides](./guides/crud-api.md).
  
 

</docmach>



