<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">
  # API Reference: Types

This section provides references for core types used within the Jetpath framework, as observed in usage examples. For precise definitions, refer to the Jetpath source code.

## `JetFunc<JetData = any, JetPluginTypes = any>`

* **Type:** Function Signature
* **Description:** Represents the expected signature for a Jetpath route handler function (exported with names like `GET_`, `POST_something`, `WS_live`).
* **Signature (Conceptual):**
    ```typescript
    type JetFunc<JetData = any, JetPluginTypes = any> =
      (ctx: JetContext<JetData, JetPluginTypes>) => void | Promise<void>;
    ```
* **Generics:**
    * `JetData`: An object type specifying the expected shapes for `ctx.body`, `ctx.query`, and `ctx.params`, often inferred from validation schemas when using `defineHandler`.
    * `JetPluginTypes`: A tuple type representing the APIs exposed by registered plugins (e.g., `[typeof PluginAInstance, typeof PluginBInstance]`), used for typing `ctx.plugins`.
* **Usage:**
    ```typescript
    import type { JetFunc, JetContext } from "jetpath";
    import type { AuthPluginAPI } from "./plugins"; // Example plugin type

    // Example without data/plugins specified
    export const GET_: JetFunc = (ctx) => {
        ctx.send("Hello");
    };

    // Example with specific types
    type UserParams = { params: { id: string } };
    type UserPlugins = [AuthPluginAPI];

    export const GET_user$id: JetFunc<UserParams, UserPlugins> = async (ctx) => {
        const userId = ctx.params.id; // Typed as string
        const auth = ctx.plugins.verifyAuth(ctx); // Plugin methods typed
        // ...
    };
    ```
    *[cite: Usage shown in tests/app.jet.ts]*

## `JetMiddleware<AppState = {}, JetPluginTypes = any>`

* **Type:** Function Signature
* **Description:** Represents the expected signature for a Jetpath middleware function (exported as `MIDDLEWARE_`). It receives the context and returns a post-handler function.
* **Signature (Conceptual):**
    ```typescript
    type JetMiddleware<AppState = {}, JetPluginTypes = any> =
      (ctx: JetContext<AppState, JetPluginTypes>) =>
        (ctx: JetContext<AppState, JetPluginTypes>, err?: Error) => void | Promise<void>;
    ```
* **Generics:**
    * `AppState`: Defines the expected shape of the `ctx.app` object, allowing type-safe sharing of request-scoped state.
    * `JetPluginTypes`: A tuple type representing the APIs exposed by registered plugins, used for typing `ctx.plugins` within the middleware.
* **Usage:**
    ```typescript
    import type { JetMiddleware, JetContext } from "jetpath";
    import type { AuthPluginAPI, LoggerPluginAPI } from "./plugins";

    type MyAppState = { user?: { id: string, role: string } };
    type MyPlugins = [AuthPluginAPI, LoggerPluginAPI];

    export const MIDDLEWARE_: JetMiddleware<MyAppState, MyPlugins> = (ctx) => {
      // Pre-handler logic using ctx.plugins.verifyAuth, setting ctx.app.user
      // ...
      return (ctx, err) => {
        // Post-handler logic using ctx.plugins.logger, handling err
        // ...
      };
    };
    ```
    *[cite: Usage shown in tests/app.jet.ts]*

## `JetContext<JetData = any, JetPluginTypes = any>`

* **Type:** Interface / Object
* **Description:** The main context object passed to handlers and middleware. See the dedicated [**API Reference: Context**](./context.md) page for full details.

## `Jetpath`

* **Type:** Class
* **Description:** The main class used to create and configure a Jetpath application instance.
* **Constructor:** `new Jetpath(options: JetPathOptions)`
* **Key Options (`JetPathOptions` - based on example):**
    * `source: string`: **Required.** Path to the directory containing route handler files (`.jet.ts`).
    * `port?: number`: Port number to listen on (default typically 3000 or 8000).
    * `hostname?: string`: Hostname to bind to (default typically '0.0.0.0' or 'localhost').
    * `apiDoc?: { name: string; info: string; color?: string; username?: string; password?: string; }`: Configuration for automatic API documentation generation.
    * `APIdisplay?: "UI" | "JSON" | false`: How to display API docs ('UI' enables Swagger UI at `/docs`, 'JSON' provides spec at `/docs/json`, `false` disables).
    * `static?: { dir: string; route: string; options?: object }`: Configuration for serving static files.
    * `globalHeaders?: Record<string, string>`: Headers to add to all responses.
    * `runtimeAdapters?: object`: *(Conceptual)* Potential option for specifying optimized runtime adapters.
* **Methods:**
    * `use(plugin: JetPlugin | object)`: Registers a plugin instance.
    * `listen(callback?: () => void)`: Starts the HTTP server.
* **Example:**
    ```typescript
    import { Jetpath } from "jetpath";
    import { myPlugin } from "./plugins";

    const app = new Jetpath({
        source: "./src",
        port: 9000,
        apiDoc: { name: "My API", info: "Docs..." },
        APIdisplay: "UI",
    });

    app.use(myPlugin);
    app.listen(() => console.log("Server started!"));
    ```
    *[cite: Usage shown in tests/app.jet.ts]*

## `JetPlugin`

* **Type:** Class
* **Description:** The class used to structure plugins for Jetpath.
* **Constructor:** `new JetPlugin({ executor: () => Promise<PluginAPI> | PluginAPI })`
* **Options:**
    * `executor: () => Promise<PluginAPI> | PluginAPI`: **Required.** A function that runs when the plugin is registered via `app.use()`. It performs initialization and **must return an object**. The properties/methods of the returned object become the plugin's public API, accessible via `ctx.plugins`. Can be `async`.
* **Usage:** See [**Creating Plugins**](../plugins.md#creating-plugins) documentation.
    *[cite: Usage shown in tests/app.jet.ts]*

## `HTTPBody<T>` (Legacy/Internal)

* **Type:** Generic Type Definition
* **Description:** Defines the structure for validation schemas when attaching them directly as properties to handler functions (e.g., `POST_route.body = {...}`). Includes validation rules (`type`, `required`, `RegExp`, `validator`) and metadata (`inputType`, `inputAccept`). This appears to be the internal type used by the custom validator shown in `tests/val.ts`.
* **Recommendation:** Prefer using `defineHandler` with established schema libraries like Zod or TypeBox for improved ergonomics and type safety, rather than directly using this `HTTPBody` structure.
    *[cite: Defined in tests/val.ts, Used in tests/app.jet.ts]*

## `JetSchema` (Conceptual / Legacy)

* **Type:** Interface / Object
* **Description:** An apparent type or interface used when attaching validation schemas directly to handler functions, possibly containing nested `HTTPBody` definitions for `body`, `query`, `params`. Observed in `tests/uploading-files.md`.
* **Recommendation:** Prefer using `defineHandler` with integrated schemas.
    *[cite: Usage shown in tests/uploading-files.md]*

</docmach>



