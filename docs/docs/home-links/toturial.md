<docmach type="wrapper" file="doc-fragments/other.html" replacement="content">
   
 







# Tutorials

Welcome to the JetPath Tutorials section! These guides provide practical, step-by-step instructions for building common features and tackling specific tasks using the JetPath framework. While the [Core Concepts](./core-concepts/routing.md) explain *how* things work, these tutorials show you *how to do it*.

We'll often refer to concepts demonstrated in the PetShop API example found in the `tests/app.jet.ts` file.

---

## Available Tutorials

Here's a list of available tutorials to help you master JetPath:

### 1. Building Your First CRUD API

* **Goal:** Create a complete Create, Read, Update, Delete (CRUD) API for managing resources (e.g., "Pets").
* **Covers:**
    * Setting up routes for `GET /resource`, `POST /resource`, `GET /resource/:id`, `PUT /resource/:id`, `DELETE /resource/:id` using file/export conventions.
    * Handling path parameters (`ctx.params`).
    * Parsing JSON request bodies (`ctx.json()`).
    * Validating request bodies and parameters (`ctx.validate()` with schemas).
    * Sending JSON responses (`ctx.send()`).
    * Basic in-memory data storage patterns (adaptable to databases).
* **Concepts:** Routing, Context, Validation, Request/Response Handling.
* **Based on:** Pet management routes (`GET_pets`, `POST_pets`, `GET_petBy$id`, `PUT_petBy$id`, `DELETE_petBy$id`) in [cite: tests/app.jet.ts].

### 2. Adding Authentication & Authorization

* **Goal:** Secure your API endpoints using token-based authentication (e.g., JWT) and implement basic role checks.
* **Covers:**
    * Creating a custom authentication plugin (`JetPlugin`) to handle token generation and validation. [cite: tests/app.jet.ts]
    * Setting up a login route (`POST /auth/login`) to issue tokens. [cite: tests/app.jet.ts]
    * Using middleware (`MIDDLEWARE_`) to check for valid tokens on incoming requests. [cite: tests/app.jet.ts]
    * Protecting specific routes based on authentication status.
    * Implementing basic authorization checks (e.g., admin-only routes) using `ctx.app` state set by middleware. [cite: tests/app.jet.ts]
    * Using `ctx.throw()` for sending `401 Unauthorized` and `403 Forbidden` responses.
* **Concepts:** Plugins, Middleware, Context (`ctx.plugins`, `ctx.app`), Error Handling.

### 3. Handling File Uploads

* **Goal:** Implement endpoints that accept file uploads (e.g., images) using `multipart/form-data`.
* **Covers:**
    * Using an official or custom plugin (like `jetbusboy`) to parse `multipart/form-data`. [cite: tests/app.jet.ts]
    * Accessing uploaded file details (filename, mimetype, size) and text fields via `ctx.plugins.formData()`. [cite: tests/app.jet.ts]
    * Saving uploaded files to the server's filesystem or preparing them for cloud storage.
    * Validating file types and sizes.
    * Discussing cross-runtime considerations for file handling (Node vs. Deno vs. Bun) and how plugins help abstract this. [cite: tests/uploading-files.md]
* **Concepts:** Plugins, Context, Request Handling, Cross-Runtime Patterns.
* **Based on:** `POST_petImage$id`, `POST_upload` routes in [cite: tests/app.jet.ts] and examples in [cite: tests/uploading-files.md].

### 4. Real-time Updates with WebSockets

* **Goal:** Set up a WebSocket endpoint for real-time communication between the server and clients.
* **Covers:**
    * Defining WebSocket handlers using the `WS_` export convention. [cite: tests/app.jet.ts]
    * Accessing the WebSocket connection object (`ctx.connection`).
    * Handling connection events (`open`, `close`, `error`).
    * Sending and receiving messages (`message` event, `socket.send()`).
    * Broadcasting messages to multiple connected clients (requires managing connections).
    * Basic ping/pong for health checks.
    * Building a simple client-side implementation (using HTML/JS) to connect and interact. [cite: tests/index.html]
    * Cross-runtime notes for WebSocket server setup. [cite: tests/websockets-usage.md]
* **Concepts:** Routing (WebSockets), Context (`ctx.connection`).
* **Based on:** `WS_live` route in [cite: tests/app.jet.ts] and examples in [cite: tests/websockets-usage.md, tests/index.html].

### 5. Advanced Validation & Error Handling

* **Goal:** Implement robust input validation using a library like Zod and configure centralized, user-friendly error responses.
* **Covers:**
    * Defining complex validation schemas (nested objects, arrays, custom rules) using Zod/TypeBox.
    * Integrating schemas with `defineHandler` (recommended pattern) or attaching them directly.
    * Validating request body, query parameters, and path parameters.
    * Customizing validation error messages.
    * Implementing detailed error handling in global middleware (`MIDDLEWARE_`) to catch validation errors (`400`), auth errors (`401`/`403`), not found errors (`404`), and server errors (`500`). [cite: tests/app.jet.ts]
    * Formatting consistent JSON error responses (e.g., including request IDs).
    * Using the `GET_error` route example for testing error paths. [cite: tests/app.jet.ts]
* **Concepts:** Validation, Schemas, Middleware, Error Handling, Context (`ctx.throw`, `ctx.validate`).

### 6. Creating & Using Custom Plugins

* **Goal:** Learn how to build your own reusable JetPath plugins to encapsulate specific functionality or dependencies.
* **Covers:**
    * The structure of a `JetPlugin` using the `executor` function.
    * Initializing dependencies (like API clients or services) within a plugin.
    * Returning an API object from the `executor`.
    * Passing configuration options to plugins.
    * Registering and using the custom plugin via `app.use()` and `ctx.plugins`.
* **Concepts:** Plugins, Dependency Injection patterns.
* **Based on:** `authPlugin` example structure in [cite: tests/app.jet.ts].

### 7. Setting up API Documentation

* **Goal:** Configure and utilize JetPath's built-in automatic API documentation generation.
* **Covers:**
    * Configuring `apiDoc` and `APIdisplay` options in the `JetPath` constructor. [cite: tests/app.jet.ts]
    * Adding descriptions and metadata to schemas (e.g., using Zod's `.describe()`) and route handlers (`GET_.info = "..."`) to enrich the generated documentation.
    * Accessing the interactive Swagger UI (usually at `/docs`).
    * Understanding how schemas translate into documentation.
* **Concepts:** Configuration, Schemas, Documentation.

--- 


</docmach>
