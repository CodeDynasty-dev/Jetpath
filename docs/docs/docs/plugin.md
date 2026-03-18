
## Jetpath Plugins

Jetpath plugins extend the framework's functionality by adding methods to `ctx.plugins`.
They can provide authentication, logging, database access, file handling, or any shared logic.

### Creating a Plugin

A plugin is a plain object with a `name` and an `executor` function that returns the methods to expose:

```typescript
export const myPlugin = {
  name: "myPlugin",
  executor() {
    return {
      greet(name: string) {
        return `Hello, ${name}!`;
      },
    };
  },
};
```

### Registering Plugins

Register plugins with your Jetpath app using `derivePlugins()`:

```typescript
import { Jetpath } from "jetpath";
import { myPlugin } from "./plugins/myPlugin";

const app = new Jetpath({ source: "./src" });
app.derivePlugins(myPlugin);
app.listen();
```

### Using Plugins in Handlers

Once registered, plugin methods are available on `ctx.plugins`:

```typescript
import { type JetRoute } from "jetpath";

export const GET_hello: JetRoute = (ctx) => {
  const message = ctx.plugins.greet("World");
  ctx.send({ message });
};
```

For more details, see the [Plugins guide](./plugins.html).
