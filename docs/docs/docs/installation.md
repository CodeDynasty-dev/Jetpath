<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 

# Installation

Installing Jetpath is straightforward and adapts to your preferred runtime environment: Node.js, Deno, or Bun.

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

# Using Jetpath:


## Start fresh:

step one: Create your project folder

step two: Run ```npm init -y```

step three: Install jetpath ```npm i jetpath```


Then create your routes and run your server check [Quick Start](./quickstart.html) for more infomation.


## Installing Oficial Jetpath template:


```bash
npx jetpath my-new-api
```
## Install Dependencies

```bash
cd my-api
npm install # or yarn install or pnpm install or bun install
```

## Run the template

```bash
npm run dev
```

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



