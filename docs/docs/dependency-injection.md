<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">
  
# Dependency Injection in Jetpath

Dependency Injection (DI) is a design pattern used to manage how components (like services, repositories, controllers) get instances of their dependencies (other components they rely on). While Jetpath **does not include a built-in, dedicated Dependency Injection container** like frameworks such as NestJS or Angular, it provides effective patterns for managing dependencies, primarily through its **Plugin System**.

---

## Jetpath's Approach to Dependencies

Instead of relying on a complex DI container, Jetpath encourages managing dependencies through:

1.  **Plugins:** Encapsulating related functionality and its dependencies within a plugin, making them accessible via the `ctx.plugins` object.
2.  **Module Scope / Manual Instantiation:** Creating and managing instances of services or clients within specific modules and importing them where needed.
3.  **(Less Common) Attaching to App/Context:** Sharing singleton instances by attaching them to the main `app` object or request-scoped instances via `ctx.app`.

---

## 1. Using the Plugin System (Recommended)

The **Plugin System** is the most idiomatic way to manage shared services and dependencies in Jetpath.

* **Concept:** Create a plugin that initializes your dependency (e.g., a database client, an email service, a configuration object) and exposes methods that use that dependency.
* **How it Works:**
    * Define a `JetPlugin`.
    * Inside the plugin's `executor` function, instantiate your dependency (e.g., connect to the database). You can access environment variables or pass configuration during plugin instantiation.
    * Return an object from the `executor` containing the methods that your route handlers will use. These methods have access to the dependency instance via the plugin's closure scope.
    * Register the plugin instance using `app.use()`.
    * Access the exposed methods in your route handlers and middleware via `ctx.plugins.yourPluginMethod(...)`.

* **Example: Database Service Plugin (Conceptual)**

    ```typescript
    // plugins/databasePlugin.ts
    import { JetPlugin } from "jetpath";
    import { createDatabaseClient, type DatabaseClient } from "../services/database"; // Your DB client logic

    // Define configuration options for the plugin
    interface DatabasePluginOptions {
      connectionString: string;
      maxRetries?: number;
    }

    // Define the interface for the methods exposed by the plugin
    interface DatabasePluginAPI {
      getClient: () => DatabaseClient;
      findUserById: (id: string) => Promise<any | null>;
      createPet: (data: any) => Promise<any>;
    }

    export function createDatabasePlugin(options: DatabasePluginOptions): JetPlugin {
      let dbClient: DatabaseClient | null = null; // Dependency stored in closure

      return new JetPlugin({
        // Executor runs when plugin is registered
        async executor(): Promise<DatabasePluginAPI> {
          console.log(`Connecting to database: ${options.connectionString.substring(0, 15)}...`);
          // Initialize the dependency
          dbClient = await createDatabaseClient(options.connectionString, options.maxRetries);
          console.log("Database connected.");

          // Return the API accessible via ctx.plugins
          return {
            getClient: () => {
              if (!dbClient) throw new Error("Database client not initialized");
              return dbClient;
            },
            async findUserById(id: string) {
              if (!dbClient) throw new Error("Database client not initialized");
              return dbClient.query("SELECT * FROM users WHERE id = $1", [id]);
            },
            async createPet(data: any) {
              if (!dbClient) throw new Error("Database client not initialized");
              // ... perform insert query using dbClient ...
              return dbClient.query("INSERT INTO pets (...) VALUES (...) RETURNING *", [...]);
            }
          };
        }
      });
    }

    // server.ts
    import { Jetpath } from "jetpath";
    import { createDatabasePlugin } from "./plugins/databasePlugin";

    const dbConnectionString = process.env.DATABASE_URL || "postgres://user:pass@host:port/db";
    const databasePlugin = createDatabasePlugin({ connectionString: dbConnectionString });

    const app = new Jetpath({ source: "./src" });
    app.use(databasePlugin); // Register the plugin

    app.listen();


    // src/users/by$id.jet.ts
    import type { JetRoute } from "jetpath";
    // Assuming DatabasePluginAPI is exported or available for typing ctx
    export const GET_: JetRoute<...> = async (ctx) => {
       const userId = ctx.params.id;
       // Access the dependency via the plugin method
       const user = await ctx.plugins.findUserById(userId);
       if (!user) {
           ctx.throw(404, "User not found");
       }
       ctx.send({ user });
    };
    ```

* **Pros:** Encapsulates dependencies, promotes modularity, easy access via `ctx`, good for shared services.
* **Cons:** Primarily suitable for singleton-like dependencies initialized once. Managing request-scoped dependencies might require different patterns.

---

## 2. Module Scope / Manual Instantiation

This is the standard approach in JavaScript/TypeScript without a dedicated DI container.

* **Concept:** Create instances of your services or dependencies in dedicated files (e.g., `services/email.ts`, `clients/paymentGateway.ts`) and configure them there. Then, import these instances directly into the route handler files (`.jet.ts`) where they are needed.
* **Example:**

    ```typescript
    // services/notificationService.ts
    class NotificationService {
      private apiKey: string;
      constructor() {
        this.apiKey = process.env.NOTIFICATION_API_KEY || "default-key";
        if (!this.apiKey) {
          console.warn("Notification API Key not set!");
        }
      }
      sendWelcomeEmail(email: string) {
        console.log(`Sending welcome email to ${email} using key ${this.apiKey.substring(0, 3)}...`);
        // ... actual email sending logic ...
      }
    }
    // Export a singleton instance
    export const notificationService = new NotificationService();


    // src/users.jet.ts
    import type { JetRoute } from "jetpath";
    import { notificationService } from "../services/notificationService"; // Import instance

    export const POST_: JetRoute<...> = async (ctx) => {
       // ... create user logic ...
       const newUser = { id: 'user-456', email: 'test@example.com' };

       // Directly use the imported service instance
       notificationService.sendWelcomeEmail(newUser.email);

       ctx.code = 201;
       ctx.send(newUser);
    };
    ```

* **Pros:** Simple, explicit, leverages standard JS/TS modules, good control over instantiation.
* **Cons:** Can lead to tighter coupling if not managed carefully, managing complex dependency graphs manually can be cumbersome, less suitable for easily swapping implementations during testing without extra work.

---

## 3. Attaching to `app` or `ctx.app`

* **Attaching to `app`:** You can attach singleton instances (like a database client) directly to the `app` instance after creating it in `server.ts`. This instance can potentially be accessed within handlers or middleware (though accessing the main `app` instance from `ctx` isn't directly shown in the provided examples and might require specific patterns).
    ```typescript
    // server.ts (Conceptual)
    // const dbClient = await createDatabaseClient(...);
    // const app = new Jetpath(...);
    // app.db = dbClient; // Attach directly (Type needs extending if using TS)
    ```
* **Attaching to `ctx.app`:** As shown earlier, middleware can attach request-scoped data or potentially request-scoped service instances to `ctx.app`. This is suitable if you need a dependency instance unique to each request.

* **Pros:** Can work for simple singletons (`app`) or request-scoped instances (`ctx.app`).
* **Cons:** Can feel like using global variables (`app`), potentially obscures dependencies, `ctx.app` requires careful typing with middleware generics. Generally less clean than using Plugins or module imports for managing dependencies.

---

## Conclusion

Jetpath provides flexibility in managing dependencies.

* **For shared services and singleton resources (like database clients, external API clients, configuration services), the Plugin System is the recommended and most idiomatic approach.** It promotes modularity and provides easy access via `ctx.plugins`.
* **For simpler dependencies or utilities specific to certain routes, standard module imports (Manual Instantiation) offer a direct and explicit way.**
 
</docmach>



