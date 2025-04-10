
## jetpath plugins

Jetpath plugins are a way to extend the functionalities of Jetpath.
They can be used to add new features to Jetpath or to modify existing ones.

Plugins can be used to add new routes, middleware, or to modify the request
and response objects or even convert to serverless runtime.

### Creating a plugin

```ts
import { JetPlugin } from "jetpath";

export const plugin = new JetPlugin{
  name: "plugin",
  version: "1.0.0",
  executor({ config }) {
    return {
      greet_world() {
        return {
          body: "Hello world",
        };
      },
    };
  },
});

```