// src/index.ts

import { Jetpath, use } from "jetpath"; // Need `use` for app.addPlugin.info
// Import database initialization function (optional for this in-memory sample, but good practice)
// import { initializeDatabase } from "./data/database"; // Uncomment if using database
// Import global middleware (Jetpath detects and applies it by name)
import "./middleware/global";
// Import route files (Jetpath detects and registers exported routes by name)
import "./routes/auth";
import "./routes/pets";
import "./routes/reviews";
import "./routes/live";
import "./routes/utils";

// Import plugin instances (assuming these files export the plugin instance)
// Create mock plugin files in src/plugins if you don't have real ones.
import { authPlugin } from "./plugins/auth";
import { jetLogger } from "./plugins/logging";

// --- Application Initialization ---

// Optional: Database Initialization (for persistent data)
// Uncomment and adapt if you switch from in-memory arrays to a real database like SQLite.
/*
initializeDatabase().then(() => {
    console.log('Database initialized successfully.');
    startServer(); // Start server after database is ready
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1); // Exit if database initialization fails
});
*/

// For this in-memory sample, we just start the server directly:
startServer();

// Function to create and start the Jetpath server.
const startServer = () => {
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
# PetShop API Documentation

This is a comprehensive API for managing a pet shop inventory, built with the **Jetpath** cross-runtime framework.

It demonstrates various Jetpath features including:
- Convention-over-configuration for routing and middleware.
- Modular project structure.
- Cross-runtime capabilities.
- Authentication and authorization (via plugin).
- Comprehensive logging (via plugin).
- Robust error handling (via global middleware).
- Input validation using \`use().body()\`.
- **File uploads (multipart/form-data).**
- **WebSocket communication for real-time updates.**
- Automatic API Documentation UI (Swagger UI).
- API Documentation Export (JSON, YAML, Markdown).
- Handling of various HTTP methods (GET, POST, PUT, DELETE).
- Dynamic routing with path parameters (e.g., \`/petBy/:id\`).
- Query parameter parsing for filtering, sorting, and pagination.
- Error Handling and Testing routes (\`/error\`).
- Health Check route (\`/health\`).
- Serving static/uploaded files (\`/serve/*\`, \`/static/*\`).

Access this interactive documentation at \`/api-doc\`.
        `,
      color: "#7e57c2", // Using the color from the original sample
      // Optional: Secure the documentation UI itself with basic authentication (example from sample).
      username: "admin", // Default username from sample
      password: "1234", // Default password from sample **WARNING:** Do not use simple passwords in production. Use environment variables.
    },

    // Configure global headers to be sent with all responses.
    globalHeaders: {
      "X-Pet-API-Version": "1.0.0", // Example custom header from sample
      "Access-Control-Allow-Origin": "*", // **WARNING:** In production, replace "*" with the specific origin(s) of your frontend application(s) for security.
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Request-ID", // Include Authorization and X-Request-ID headers
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
  // Use .info() with the plugin instance for documentation (check if plugins are documented this way)
  use(jetLogger).info(
    "Adds a logging plugin for detailed request and error logging.",
  );

  // Add the authentication plugin
  app.addPlugin(authPlugin);
  // Use .info() with the plugin instance for documentation (check if plugins are documented this way)
  use(authPlugin).info(
    "Adds an authentication plugin for user login and verification.",
  );

  // --- Start the Server ---
  // Start the Jetpath server and begin listening for incoming HTTP requests.
  // Jetpath automatically discovers and hooks up the exported middleware and routes
  // from imported modules upon initialization and the call to .listen().
  app.listen();

  // Log messages indicating the server is running and where to access it.
  console.log(
    `PetShop API server running on http://localhost:${app.config.port}`,
  );
  console.log(
    `Access API Documentation (Swagger UI) at http://localhost:${app.config.port}/api-doc`,
  );

  // export default app; // Export the app instance if needed
};
