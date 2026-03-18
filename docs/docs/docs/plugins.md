<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Extending Jetpath: Plugins

Plugins are the primary way to extend Jetpath's core functionality, promote code reuse, and encapsulate complex or shared logic such as authentication, database interactions, file handling, logging, or connections to third-party services.

---

## What are Plugins?

Plugins are self-contained modules that can:

1.  **Initialize Resources:** Set up database connections, configure API clients, read configuration when the application starts.
2.  **Expose Functionality:** Add new methods to the `ctx.plugins` object, making them accessible in middleware and route handlers.
3.  **Encapsulate Dependencies:** Keep internal state private while exposing a clean public API.

---

## Using Plugins

### 1. Installation

Install the plugin package:

```bash
npm install @jetpath/plugin-busboy
# or
bun add @jetpath/plugin-busboy
```

### 2. Registration

Register plugins with your Jetpath app using `app.derivePlugins()`. This is typically done in your main server file before calling `app.listen()`.

```typescript
// server.ts
import { Jetpath } from "jetpath";
import { jetbusboy } from "@jetpath/plugin-busboy";
import { authPlugin } from "./plugins/auth";
import { jetLogger } from "./plugins/logging";

const app = new Jetpath({ source: "./src" });

// Register one or more plugins
app.derivePlugins(jetLogger, authPlugin);

app.listen();
```

Plugins are initialized in the order they are passed to `derivePlugins()`.

### 3. Accessing Plugin Functionality

Once registered, the methods returned by each plugin's `executor` function are available on `ctx.plugins`:

```typescript
import { type JetRoute } from "jetpath";

export const POST_upload: JetRoute = async (ctx) => {
  // Access file upload functionality from a plugin
  const formData = await ctx.plugins.formData(ctx);
  const image = formData.image;
  ctx.send({ message: "Upload processed" });
};

export const GET_profile: JetRoute = (ctx) => {
  // Access auth functionality from a plugin
  const auth = ctx.plugins.verifyAuth(ctx);
  if (!auth.authenticated) {
    ctx.send("Not authenticated", 401);
    return;
  }
  ctx.send({ user: auth.user });
};
```

---

## Creating Plugins

### Plugin Structure

A plugin is a plain object with:
- `name` (string) — identifier for the plugin
- `executor` (function) — runs at registration time, returns the public API

```typescript
export const myPlugin = {
  name: "myPlugin",
  executor() {
    // Private state — not accessible from handlers
    const cache = new Map<string, any>();

    // Public API — merged into ctx.plugins
    return {
      getCached(key: string) {
        return cache.get(key);
      },
      setCached(key: string, value: any) {
        cache.set(key, value);
      },
    };
  },
};
```

### Example: Auth Plugin

```typescript
import { type JetContext } from "jetpath";

export const authPlugin = {
  name: "authPlugin",
  executor() {
    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

    const users = [
      { id: "1", username: "admin", password: "admin123", role: "admin" },
      { id: "2", username: "user", password: "user123", role: "customer" },
    ];

    return {
      authenticateUser(username: string, password: string) {
        const user = users.find(
          (u) => u.username === username && u.password === password
        );
        if (!user) {
          return { authenticated: false, message: "Invalid credentials" };
        }
        const token = `token-${user.id}-${Date.now()}`;
        return {
          authenticated: true,
          token,
          user: { id: user.id, username: user.username, role: user.role },
        };
      },

      verifyAuth(ctx: JetContext) {
        const authHeader = ctx.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return { authenticated: false, message: "Missing token" };
        }
        const token = authHeader.split(" ")[1];
        const userId = token.split("-")[1];
        const user = users.find((u) => u.id === userId);
        if (!user) {
          return { authenticated: false, message: "Invalid token" };
        }
        return { authenticated: true, user };
      },

      isAdmin(ctx: JetContext): boolean {
        const auth = this.verifyAuth(ctx);
        return auth.authenticated && auth.user?.role === "admin";
      },
    };
  },
};

export type AuthPluginType = ReturnType<typeof authPlugin.executor>;
```

### Typing Plugin Access

Export the return type of your plugin's executor to get type safety in handlers:

```typescript
import { type JetRoute } from "jetpath";
import { type AuthPluginType } from "./plugins/auth";

export const GET_admin: JetRoute<{}, [AuthPluginType]> = (ctx) => {
  if (!ctx.plugins.isAdmin(ctx)) {
    ctx.send("Forbidden", 403);
    return;
  }
  ctx.send({ message: "Admin access granted" });
};
```

---

## Best Practices

- **Single Responsibility:** Each plugin should handle one concern (auth, logging, database, etc.)
- **Clear API:** Define and export TypeScript types for the functionality your plugin exposes
- **Configuration:** Accept options via the plugin object or environment variables, not hardcoded values
- **Async Initialization:** If your executor needs async setup (DB connections), handle it with `async/await`
- **Documentation:** Document the methods your plugin provides on `ctx.plugins`

---

## Next Steps

- Understand how plugin methods are accessed via the [Context (`ctx`) Object](./context.html)

</docmach>
