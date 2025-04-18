<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">

# Extending Jetpath: Plugins

Plugins are the primary way to extend Jetpath's core functionality, promote code reuse, and encapsulate complex or shared logic, such as authentication, database interactions, file handling, logging, or connections to third-party services.

---

## What are Plugins?

Think of plugins as self-contained modules that can:

1.  **Initialize Resources:** Set up database connections, configure API clients, read configuration, etc., when the application starts.
2.  **Expose Functionality:** Add new methods and properties to the `ctx.plugins` object, making them easily accessible within your middleware and route handlers.
3.  **Manage Dependencies:** Encapsulate dependencies needed by the plugin's functionality (as discussed in [Dependency Injection](./dependency-injection.md)).

---

## Using Plugins

Integrating existing plugins (whether official Jetpath plugins or community-created ones) is straightforward.

### 1. Installation

Install the plugin package using your preferred package manager:

```bash
# Example installing an official file upload plugin
npm install @jetpath/plugin-busboy
# or
bun add @jetpath/plugin-busboy
# or add via import map/URL for Deno
````

### 2\. Registration

Instantiate the plugin (if necessary, passing configuration options) and register it with your Jetpath application instance using `app.use()`. Registration typically happens in your main server file (`server.ts`).

```typescript
// server.ts
import { Jetpath } from "jetpath";
// Assuming jetbusboy is the exported plugin factory/instance
import { jetbusboy } from "@jetpath/plugin-busboy";
import { createAuthPlugin } from "./plugins/authPlugin"; // Your custom auth plugin

const app = new Jetpath({ source: "./src" });

// Instantiate and register plugins
// Official plugin for multipart/form-data handling
app.use(jetbusboy);

// Custom authentication plugin (example)
const authPlugin = createAuthPlugin({ /* options like JWT secret */ });
app.use(authPlugin);

app.listen();
```

*[cite: Registration pattern shown in tests/app.jet.ts]*

**Important:** Plugins are generally executed/initialized in the order they are registered with `app.use()`.

### 3\. Accessing Plugin Functionality

Once registered, the methods and properties returned by the plugin's `executor` function become available on the `ctx.plugins` object within middleware and route handlers.

```typescript
// In a route handler or middleware
import type { JetFunc, JetMiddleware } from "jetpath";
// Import types exposed by plugins if available
import type { JetBusBoyType } from "@jetpath/plugin-busboy";
import type { AuthPluginAPI } from "./plugins/authPlugin";

// Use generics to type ctx.plugins
type HandlerPlugins = [JetBusBoyType, AuthPluginAPI];

export const POST_upload: JetFunc<{}, HandlerPlugins> = async (ctx) => {
    // Access file upload functionality from jetbusboy plugin
    const formData = await ctx.plugins.formData(ctx);
    const image = formData.image;
    // ... process image ...

    ctx.send({ message: "Upload processed" });
};

export const GET_profile: JetFunc<{}, HandlerPlugins> = (ctx) => {
    // Access auth functionality from authPlugin
    const authResult = ctx.plugins.verifyAuth(ctx); // Example method name
    if (!authResult.authenticated) {
        ctx.throw(401, "Not authenticated");
    }
    ctx.send({ user: authResult.user });
};
```

*[cite: Usage pattern `ctx.plugins.methodName()` shown in tests/app.jet.ts]*

-----

## Creating Plugins

Creating your own plugins allows you to structure reusable logic cleanly.

### The `JetPlugin` Class

Jetpath provides a `JetPlugin` class (or a similar constructor pattern) to structure your plugin.

```typescript
import { JetPlugin } from "jetpath";
import type { JetContext } from "jetpath"; // For typing ctx if needed

// Define the interface for the API your plugin will expose on ctx.plugins
interface MyPluginAPI {
  doSomething: (input: string) => string;
  // Add other methods/properties
}

// Define options your plugin might accept
interface MyPluginOptions {
  prefix?: string;
}

export function createMyPlugin(options: MyPluginOptions = {}): JetPlugin {
  const prefix = options.prefix || "DEFAULT";

  // Instantiate plugin
  return new JetPlugin({
    // The executor function runs when app.use() is called
    async executor(/* Optional args like app instance might be passed */): Promise<MyPluginAPI> {
      console.log(`Initializing MyPlugin with prefix: ${prefix}`);

      // === Perform Initialization ===
      // e.g., connect to a service, load config
      // const externalClient = await connectToService();

      // === Return the Plugin's Public API ===
      // These methods become available on ctx.plugins
      return {
        doSomething: (input: string): string => {
          // This function has access to 'prefix' and 'externalClient'
          // via closure scope.
          console.log("MyPlugin doing something...");
          return `${prefix}: Processed ${input}`;
          // Example using initialized client:
          // return externalClient.process(input);
        },
        // Add other methods...
      };
    }
  });
}
```

### The `executor` Function

  * **Purpose:** This function is the core of your plugin. It's executed when `app.use(yourPluginInstance)` is called.
  * **Initialization:** Use the `executor` to perform any setup required by your plugin (e.g., establish database connections, initialize SDKs, read configuration). It can be `async` if needed.
  * **Return Value:** The `executor` **must return an object**. The properties and methods of this returned object are merged into the `ctx.plugins` object, forming the public API of your plugin.
  * **Dependency Scope:** Variables defined *outside* the returned object but *within* the `executor`'s scope (or the factory function's scope, like `prefix` and `dbClient` in the examples) act as private state or encapsulated dependencies for your plugin's public methods.

### Example: Simplified Auth Plugin Structure

This mirrors the `authPlugin` structure seen in `tests/app.jet.ts`.

```typescript
import { JetPlugin } from "jetpath";
import type { JetContext } from "jetpath";

// Define the API exposed by this plugin
export interface AuthPluginAPI {
  verifyAuth: (ctx: JetContext) => { authenticated: boolean; user?: any; message?: string };
  isAdmin: (ctx: JetContext) => boolean;
}

// Define configuration options
interface AuthPluginOptions {
  jwtSecret: string;
  adminApiKey: string;
}

export function createAuthPlugin(options: AuthPluginOptions): JetPlugin {
  // Dependencies are configured here and accessible within the executor's returned methods
  const JWT_SECRET = options.jwtSecret;
  const ADMIN_API_KEY = options.adminApiKey;
  // In-memory store or DB connection could be initialized here

  return new JetPlugin({
    executor(): AuthPluginAPI {
      // Return the methods that handlers will call via ctx.plugins
      return {
        verifyAuth(ctx: JetContext) {
          const authHeader = ctx.get("authorization");
          // ... logic to validate token using JWT_SECRET ...
          if (/* valid token */) {
            // const user = findUserFromToken(...);
            return { authenticated: true, user: { id: '...', role: '...' } };
          }
          return { authenticated: false, message: "Invalid token" };
        },

        isAdmin(ctx: JetContext) {
          if (ctx.get("x-admin-key") === ADMIN_API_KEY) {
            return true;
          }
          const auth = this.verifyAuth(ctx); // Can call other plugin methods
          return auth.authenticated && auth.user?.role === "admin";
        }
      };
    }
  });
}
```

*[cite: Based on `authPlugin` structure in tests/app.jet.ts]*

-----

## Plugin Lifecycle

  * **Instantiation:** You create an instance of your plugin, potentially passing configuration options.
  * **Registration:** You call `app.use(pluginInstance)`.
  * **Execution:** The plugin's `executor` function runs during the `app.use()` call. Any asynchronous operations within the `executor` should complete before the server starts fully listening or handling requests (depending on Jetpath's internal handling, usually `app.listen` awaits plugin initialization implicitly or explicitly).
  * **Runtime:** The methods returned by the `executor` are available on `ctx.plugins` for every incoming request handled after the plugin was registered.

-----

## Best Practices

  * **Single Responsibility:** Design plugins to handle a specific concern (authentication, database access, specific API client).
  * **Clear API:** Define a clear and well-typed interface for the functionality your plugin exposes.
  * **Configuration:** Allow configuration via options passed during instantiation rather than relying solely on global environment variables within the plugin.
  * **Asynchronous Initialization:** Handle connections and other async setup correctly within the `executor` using `async/await`.
  * **Documentation:** Document your plugin's configuration options and the methods it provides on `ctx.plugins`.

-----

## Next Steps

  * See how plugins provide dependencies in the [**Dependency Injection**](https://www.google.com/search?q=./dependency-injection.md) guide.
  * Understand how plugin methods are accessed via the [**Context (`ctx`) Object**](https://www.google.com/search?q=./context.md).
 

</docmach>



