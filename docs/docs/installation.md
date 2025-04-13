<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">
 

# Installation

Get ready to build universal JavaScript backends! Installing JetPath is straightforward and adapts to your preferred runtime environment: Node.js, Deno, or Bun.

---

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **A JavaScript Runtime:**
    * **Node.js:** Version 18.x or later recommended. ([Download Node.js](https://nodejs.org/))
    * **Deno:** Version 1.30 or later recommended. ([Install Deno](https://deno.land/manual/getting_started/installation))
    * **Bun:** Version 1.0 or later recommended. ([Install Bun](https://bun.sh/docs/installation))
2.  **TypeScript:** JetPath is built with TypeScript and provides first-class typing support. While you can use it with JavaScript, TypeScript is highly recommended for the best experience.
    ```bash
    npm install -g typescript # Or use the version included with Deno/Bun
    ```
3.  **(Optional but Recommended) A Schema Validation Library:** For robust validation and type inference, we strongly recommend installing a library like Zod or TypeBox. Examples in this documentation often use Zod.
    ```bash
    npm install zod
    # or
    bun add zod
    # or import from a CDN/registry in Deno
    ```

---

## Installing JetPath

Choose the installation method corresponding to your primary development runtime.

### 1. For Node.js (using npm, yarn, or pnpm)

If you're developing primarily within the Node.js ecosystem:

```bash
# Using npm
npm install jetpath

# Using yarn
yarn add jetpath

# Using pnpm
pnpm add jetpath
````

Don't forget your preferred schema library:

```bash
npm install zod
# or
yarn add zod
# or
pnpm add zod
```

### 2\. For Deno

Deno typically uses direct URL imports. Add JetPath as a dependency in your `deno.json` or `jsr.json` file, or import it directly.

**(Option A - Using `deno.json` / `jsr.json`)**

Add JetPath and your schema library to your import map or dependency list (replace with actual URLs/versions when available):

```jsonc
// deno.json (example using import map)
{
  "imports": {
    "jetpath": "jsr:@jetpath/jetpath@^0.1.0", // Example using JSR
    "zod": "npm:zod@^3.23.0" // Example using npm specifier
    // OR direct URLs:
    // "jetpath": "[https://deno.land/x/jetpath@v0.1.0/mod.ts](https://deno.land/x/jetpath@v0.1.0/mod.ts)", // Example Deno Land URL
    // "zod": "[https://deno.land/x/zod@v3.23.0/mod.ts](https://deno.land/x/zod@v3.23.0/mod.ts)"
  }
}
```

**(Option B - Direct URL Import)**

Import directly in your TypeScript files (replace with actual URLs when available):

```typescript
import { JetPath } from "jsr:@jetpath/jetpath@^0.1.0"; // Example JSR
import { z } from "npm:zod@^3.23.0"; // Example npm specifier
// OR
// import { JetPath } from "[https://deno.land/x/jetpath@v0.1.0/mod.ts](https://deno.land/x/jetpath@v0.1.0/mod.ts)";
// import { z } from "[https://deno.land/x/zod@v3.23.0/mod.ts](https://deno.land/x/zod@v3.23.0/mod.ts)";
```

### 3\. For Bun

If you're developing primarily with Bun:

```bash
bun add jetpath
```

Install your schema library:

```bash
bun add zod
```

-----

## Project Setup

Regardless of the runtime, a basic project structure and TypeScript configuration are recommended.

**1. Folder Structure:**

A common structure looks like this:

```
your-project/
├── src/              # Your JetPath route handlers (.jet.ts files)
│   └── index.jet.ts  # Maps to "/"
├── server.ts         # Your main server entry point (initializes JetPath)
├── node_modules/     # (Node.js/Bun)
├── package.json      # (Node.js/Bun)
├── bun.lockb         # (Bun)
├── deno.json         # (Deno - optional)
└── tsconfig.json     # TypeScript configuration
```

**2. TypeScript Configuration (`tsconfig.json`):**

Create a `tsconfig.json` file in your project root. A good starting point:

```js
{
  "compilerOptions": {
    /* Base Options */
    "esModuleInterop": true, // Enables compatibility with CommonJS modules
    "skipLibCheck": true, // Speeds up compilation by skipping type checking of declaration files
    "target": "ES2022", // Target modern ECMAScript features
    "allowJs": true, // Allow JavaScript files to be compiled
    "resolveJsonModule": true, // Allow importing JSON files
    "moduleDetection": "force", // Treat files as modules
    /* Module Resolution */
    "module": "ESNext", // Use modern module system 
    /* Strictness & Code Quality */
    "strict": true, // Enable all strict type-checking options
    "noUncheckedIndexedAccess": true, // Add 'undefined' to indexed types
    "noImplicitAny": true, // Require explicit 'any' type
    "forceConsistentCasingInFileNames": true, // Disallow inconsistently-cased references to the same file
    /* Output */
    "outDir": "./dist", // Optional: Output directory for compiled JavaScript
    "rootDir": "./",    // Specify the root directory of input files 
  }, 
  "exclude": ["node_modules", "dist"] // Files/directories to exclude
}

```

  * **Adjust `moduleResolution`:** Use `"Bundler"` (recommended for modern tools), `"NodeNext"` (for Node ESM), or `"Node"` (for Node CJS) depending on your Node.js setup. Deno's module resolution might not require explicit setting here if using import maps.
  * **Adjust `types`:** Add `"node"` if you need Node.js built-in types.

-----

## Verify Installation

1.  Create the basic `src/index.jet.ts` and `server.ts` files as shown in the [**Quick Start**](https://www.google.com/search?q=./quick-start.md) guide.
2.  Run your `server.ts` file using your chosen runtime (node, deno run, bun run).
3.  Visit `http://localhost:3000` (or your configured port) in your browser. You should see the welcome message from your root route.

If you see the welcome message, JetPath is installed and configured correctly\!

-----

## Next Steps

  * **Quick Start:** Build your first simple API following the [**Quick Start**](https://www.google.com/search?q=./quick-start.md) guide.
  * **Core Concepts:** Dive deeper into how JetPath works by reading the [**Core Concepts**](https://www.google.com/search?q=./core-concepts/routing.md).
 
 

</docmach>



