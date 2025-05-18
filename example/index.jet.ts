// src/index.ts

import { Jetpath } from "../dist/index.js";
// Create mock plugin files in src/plugins if you don't have real ones.
import { authPlugin } from "./plugins/auth.js";
import { jetLogger } from "./plugins/logging.js";

// --- Application Initialization ---

// Create a new Jetpath application instance with configuration.
// Route handlers and global middleware are automatically detected
// by Jetpath based on their exported names from imported modules.
const app = new Jetpath({
  // Strict mode can enforce certain behaviors (e.g., strict content type checking).
  strictMode: "ON", // Example from app.jet.ts

  // Configure API documentation (Swagger UI).
  // This makes it easy to visualize and test the API endpoints.
  apiDoc: {
    display: "UI", // Set to "UI" to enable the Swagger UI
    name: "PetShop API", // Using PetShop name from original sample
    // Use Markdown for a rich description in the documentation.
    // This info can be more general, as route-specific info comes from .info() calls.
    info: `


#### PetShop API Documentation


This is an API for managing a pet shop inventory, built with the **Jetpath** cross-runtime framework.

It demonstrates various Jetpath features including:
- Convention-over-configuration for routing and middleware.
- Modular project structure.
- Cross-runtime capabilities.
- Authentication and authorization (via plugin).
- Comprehensive logging (via plugin).
- Robust error handling (via global middleware)

[check our docs for more info](https://jetpath.codedynasty.dev)





`,

    color: "#7e57c2", // Using the color from the original sample
    // Optional: Secure the documentation UI itself with basic authentication (example from sample).
    username: "admin", // Default username from sample
    password: "1234", // Default password from sample **WARNING:** Do not use simple passwords in production. Use environment variables.
  },
  source: "./example",
  // Configure global headers to be sent with all responses.
  globalHeaders: {
    "X-Pet-API-Version": "1.0.0", // Example custom header from sample
    "Access-Control-Allow-Origin": "*", // **WARNING:** In production, replace "*" with the specific origin(s) of your frontend application(s) for security.
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID", // Include Authorization and X-Request-ID headers
    "Content-Type": "application/json", // Default response content type
  },

  // Configure the port for the server to listen on.
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 9000, // Using sample's port

  // Enable WebSocket upgrades. This is required for the /live WebSocket endpoint to work.
  upgrade: true,
  // Optional: Configure a directory for serving static files automatically (alternative to GET_static$0 route)
  // static: "./public", // Example
});

// --- Add Plugins ---
// Add plugin instances to the application. Plugins provide extended functionality.
// Access plugins via ctx.plugins in middleware and route handlers.

// Add the logger plugin
// Configure the logger plugin first if needed, then add it.
jetLogger.setConfig({ // Using sample's logger config
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: "json", // Log format (json or text)
  filename: "./pet-shop-api-log.log", // Log file path relative to project root
});
app.addPlugin(jetLogger);
app.addPlugin(authPlugin);

// --- Start the Server ---
// Start the Jetpath server and begin listening for incoming HTTP requests.
// Jetpath automatically discovers and hooks up the exported middleware and routes
// from imported modules upon initialization and the call to .listen().
app.listen();
