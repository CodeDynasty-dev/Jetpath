<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 

# Installation

Hello welcome to jetpath.


Get ready to build universal JavaScript backends! Installing Jetpath is straightforward and adapts to your preferred runtime environment: Node.js, Deno, or Bun.

---

## Prerequisites

Before you begin, ensure you have the following installed:

1.**A JavaScript Runtime:**

  **Node.js:** Version 18.x or later recommended. ([Download Node.js](https://nodejs.org/))

  **Deno:** Version 1.30 or later recommended. ([Install Deno](https://deno.land/manual/getting_started/installation))

  **Bun:** Version 1.0 or later recommended. ([Install Bun](https://bun.sh/docs/installation))

2.**TypeScript:** Jetpath is built with TypeScript and provides first-class typing support. While you can use it with JavaScript,

 TypeScript is highly recommended for the best experience.

  ```bash
  npm install -g typescript
  ```

---

## Installing Jetpath:

```bash
# Create your project folder
mkdir my-api

# Navigate to your project folder
cd my-api

# Initialize a new Node.js project
npm init -y




# Choose the installation method corresponding to your primary development runtime.

# Using npm
npm install jetpath

# Using yarn
yarn add jetpath

# Using pnpm
pnpm add jetpath
````


-----

## Project Setup

Regardless of the runtime, a basic project structure and TypeScript configuration are recommended.

**1. Folder Structure:**

A common structure looks like this:

```
your-project/
├── src/              # Your Jetpath route handlers (.jet.ts files)
│   └── users.jet.ts  # where you defined functions for users
│   └── products.jet.ts  # where you defined functions for products
│   └── auth.jet.ts  # where you defined functions for authentication
│   └── carts.jet.ts  # where you defined functions for carts
│   └── users.jet.ts  # where you defined functions for users
├── server.jet.ts         # Your main server entry point (initializes Jetpath)
├── node_modules/     # (Node.js/Bun)
├── package.json      # (Node.js/Bun)
└── tsconfig.json     # TypeScript configuration
```



## Next Steps

  * Quick Start: Build your first simple API following the [**Quick Start**](./quickstart.html) guide.
  * Core Concepts: Dive deeper into how Jetpath works by reading the [**Core Concepts**](./routing.html).
 
 

</docmach>



