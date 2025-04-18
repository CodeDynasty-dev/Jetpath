<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">

# Testing & Debugging

Ensuring your Jetpath application is reliable and maintainable requires effective testing and debugging strategies. Jetpath's structure, with its focus on distinct handlers, plugins, and middleware, lends itself well to various testing approaches.

---

## Testing Strategies

A balanced testing approach typically involves a mix of unit, integration, and potentially end-to-end tests.

### 1. Unit Testing

* **Goal:** Test individual, isolated pieces of code (units) without external dependencies like databases, external APIs, or the full framework request/response cycle.
* **What to Test:**
    * **Utility Functions:** Any standalone helper functions.
    * **Plugin Logic:** Test the core logic within plugin `executor` functions or methods, mocking any external dependencies they might have.
    * **Route Handler Logic (with Mocking):** Test the business logic *within* a route handler function. This requires mocking the `ctx` object and any `ctx.plugins` or `ctx.app` properties the handler uses. This can be complex but allows testing intricate logic in isolation.
    * **Validation Logic:** If you have complex custom validation functions (passed to schemas), test them directly.
* **Tools:**
    * **Test Runners:** Vitest, Jest (Node.js/Bun), Deno.test (Deno).
    * **Mocking Libraries:** `vi.fn()` (Vitest), `jest.fn()` (Jest), standard mocking techniques.
* **Example (Conceptual Handler Unit Test):**
    ```typescript
    import { GET_petBy$id } from '../src/pets/by$id.jet.ts'; // Import the handler
    import { describe, it, expect, vi } from 'vitest'; // Example using Vitest

    // Mock the database plugin method used by the handler
    const mockFindPetById = vi.fn();

    describe('GET_petBy$id handler', () => {
      it('should send a pet when found', async () => {
        const mockPet = { id: 'pet-123', name: 'Buddy' };
        mockFindPetById.mockResolvedValue(mockPet); // Simulate finding the pet

        // Create a mock context object
        const mockCtx = {
          params: { id: 'pet-123' },
          query: {},
          plugins: { findPetById: mockFindPetById }, // Provide mocked plugin
          app: {},
          code: 200,
          send: vi.fn(), // Mock the send function
          throw: vi.fn(),
          // ... mock other ctx methods/properties as needed
        };

        await GET_petBy$id(mockCtx as any); // Execute the handler with mock context

        expect(mockFindPetById).toHaveBeenCalledWith('pet-123');
        expect(mockCtx.send).toHaveBeenCalledWith({ status: 'success', pet: mockPet });
        expect(mockCtx.code).toBe(200);
        expect(mockCtx.throw).not.toHaveBeenCalled();
      });

      it('should throw 404 when pet not found', async () => {
        mockFindPetById.mockResolvedValue(null); // Simulate not finding the pet

        const mockCtx = { /* ... similar mock context ... */ };
        mockCtx.plugins.findPetById = mockFindPetById;
        mockCtx.throw = vi.fn(); // Important: mock throw
        mockCtx.send = vi.fn();

        await GET_petBy$id(mockCtx as any);

        expect(mockFindPetById).toHaveBeenCalledWith(expect.any(String));
        expect(mockCtx.throw).toHaveBeenCalledWith(404, expect.stringContaining("Pet not found"));
        expect(mockCtx.send).not.toHaveBeenCalled();
      });
    });
    ```

### 2. Integration Testing

* **Goal:** Test how different parts of *your* application work together, including routing, middleware, handlers, and potentially plugins, usually by making live HTTP requests to a running instance of your Jetpath app.
* **What to Test:**
    * **API Endpoints:** Send requests to your routes and assert the response status code, headers, and body content.
    * **Middleware Logic:** Verify that middleware (e.g., auth, logging headers) behaves correctly for different routes.
    * **Validation:** Send requests with invalid data and assert that appropriate error responses (e.g., 400 Bad Request) are returned.
    * **Error Handling:** Test specific error conditions (like requesting a non-existent resource or triggering an intentional error) and assert the standardized error response format. The `GET_error` route in `tests/app.jet.ts` is a good example target for this. [cite: tests/app.jet.ts]
* **Setup:**
    * You typically need to run your Jetpath server in a test environment.
    * Consider using a separate test database or mocking database calls at a higher level if needed.
* **Tools:**
    * **HTTP Client Libraries:**
        * `supertest` (Popular for Node.js/Express-like apps, might need adaptation for Jetpath's server instance).
        * Standard `Workspace` API (Available in Node.js, Deno, Bun - often sufficient).
    * **Test Runners:** Vitest, Jest, Deno.test.
* **Example (Conceptual Integration Test using `Workspace`):**
    ```typescript
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    // Assuming you have a way to start/stop your Jetpath app programmatically
    import { startTestServer, stopTestServer, appInstance } from './test-setup'; // Your test setup helper

    describe('Pet API Integration Tests', () => {
      let serverUrl: string;

      beforeAll(async () => {
        serverUrl = await startTestServer(); // Starts Jetpath on a random port
      });

      afterAll(async () => {
        await stopTestServer();
      });

      it('GET /pets should return a list of pets', async () => {
        const response = await fetch(`${serverUrl}/pets`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');
        expect(Array.isArray(data.pets)).toBe(true);
        // Add more assertions about the data structure
      });

      it('GET /petBy/:id should return 404 for non-existent pet', async () => {
        const response = await fetch(`${serverUrl}/petBy/non-existent-id`);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error?.message).toContain('Pet not found');
      });

      it('POST /pets should require authentication (if implemented)', async () => {
         const response = await fetch(`${serverUrl}/pets`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: 'Test', species: 'Dog', /* ... */ })
         });
         // Assuming middleware checks auth and returns 401 if missing
         expect(response.status).toBe(401);
      });

       it('GET /error should trigger error handling middleware', async () => {
         const response = await fetch(`${serverUrl}/error`);
         const data = await response.json();

         expect(response.status).toBe(500); // Assuming middleware sets 500 for generic errors
         expect(data.error?.message).toBeDefined();
         expect(data.error?.requestId).toBeDefined();
       });
    });
    ```

### 3. End-to-End (E2E) Testing

* **Goal:** Simulate real user interactions with the entire system, including the frontend (if applicable) and the backend API.
* **Tools:** Playwright, Cypress.
* **Scope:** Typically involves setting up the full application stack and running automated browser tests that interact with the UI and trigger API calls. Less common for pure API testing unless verifying interactions with specific clients.

---

## Debugging Techniques

When things go wrong, here's how to troubleshoot your Jetpath application:

### 1. Console Logging

* The simplest method. Use `console.log()`, `console.warn()`, `console.error()` strategically within your handlers, middleware, and plugins to trace execution flow and inspect variable values.
* Consider using a structured logging plugin for more organized and filterable logs, especially in production or complex scenarios. Include request IDs in your logs to trace a single request's journey.

### 2. Runtime Debuggers

Use the built-in debugging capabilities of your chosen runtime:

* **Node.js:**
    * Start your server with the inspect flag: `node --inspect server.ts` (or attach to `ts-node`).
    * Connect using Chrome DevTools (`chrome://inspect`) or your IDE's debugger (like VS Code's JavaScript Debugger).
    * Set breakpoints, step through code, inspect variables.
* **Deno:**
    * Start with the inspect flag: `deno run --inspect --allow-net --allow-read server.ts` or `--inspect-brk` to pause on the first line.
    * Connect using Chrome DevTools or your IDE debugger.
* **Bun:**
    * Start with the inspect flag: `bun --inspect server.ts`.
    * Connect using compatible debuggers (support might vary, check Bun's documentation).

### 3. Debugging Routing Issues

If requests aren't hitting the handler you expect:

* **Check Filenames and Paths:** Ensure your `.jet.ts` files and folders exactly match the desired URL structure. Case sensitivity matters on some systems.
* **Check Export Names:** Verify the `METHOD_` prefix and any `optionalPathSegment` match the HTTP method and expected path. Double-check the use of `$` for parameters and `$$` for catch-alls.
* **Look for Conflicts:** Ensure you don't have conflicting definitions (e.g., two different files/exports trying to handle the exact same METHOD + Path).
* **Use a Route Listing Tool:** *(Recommendation)* An official Jetpath CLI command like `jetpath routes` would be invaluable here, showing exactly how Jetpath mapped files/exports to routes.

### 4. Debugging Validation Errors

* **Check Schemas:** Carefully review your Zod/TypeBox/custom schema definitions (`.body`, `.query`, `.params` attached to handlers or defined in `defineHandler`).
* **Inspect Input:** Log the raw `ctx.query`, `ctx.params`, or the *parsed* `ctx.body` (after `ctx.json()` or similar) *before* calling `ctx.validate()` to see the exact data being validated.
* **Check `ctx.validate()` Call:** Ensure you are calling `ctx.validate()` correctly and passing the right schema object if not using automatic validation.
* **Examine Error Messages:** The error thrown by `ctx.validate()` usually contains details about which field failed and why. Ensure your error handling middleware logs this detail.

### 5. Debugging Middleware

* **Trace Execution:** Add `console.log` statements at the beginning of the pre-handler section and the beginning of the post-handler function to confirm middleware is running for the expected routes.
* **Inspect `ctx.app`:** Log `ctx.app` before and after middleware runs to see how it modifies request-scoped state.
* **Check `err` Parameter:** In the post-handler function `(ctx, err) => { ... }`, always log the `err` object to see if errors from the handler are being caught correctly.

---

## Next Steps

* Review the [**Middleware**](./middleware.md) documentation for error handling patterns.
* Consult the documentation for your chosen JavaScript runtime (Node.js, Deno, Bun) for more advanced debugging techniques.
 

</docmach>



