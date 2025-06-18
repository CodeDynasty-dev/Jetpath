// src/routes/auth.ts

import { type JetRoute, use } from "../../dist/index.js";
import { type AuthPluginType } from "../plugins/auth.ts"; // Import AuthPluginType

// --- Authentication Route ---

/**
 * Authentication endpoint - Login with username and password
 * @route POST /auth/login
 * @access Public
 * Demonstrates: POST request, body parsing, plugin usage (auth), sending token.
 */
export const POST_auth_login: JetRoute<
  { body: { username: string; password: string } },
  [AuthPluginType]
> = async function (ctx) {
  // Parse the request body. Jetpath handles this.
  await ctx.parse();
  const { username, password } = ctx.body;

  // Use the auth plugin to authenticate the user.
  // Access plugins via ctx.plugins, assuming the plugin was added with app.addPlugin(authPlugin) in index.ts.
  const authResult = ctx.plugins.authenticateUser(username, password);

  // Check authentication result.
  if (!authResult.authenticated) {
    ctx.code = 401; // Unauthorized status code.
    ctx.send({ status: "error", message: authResult.message }); // Send error response.
    return; // Stop further processing.
  }

  // If authentication is successful, send success response with token and user info.
  ctx.send({
    status: "success",
    message: "Authentication successful",
    token: authResult.token, // Send the generated token.
    user: { // Send basic user info.
      id: authResult.user?.id,
      username: authResult.user?.username,
      role: authResult.user?.role,
    },
  });
};

// Apply body validation and .info() for documentation using use() chained after the function definition.
use(POST_auth_login).body((t) => {
  // Define the expected request body structure and validation rules.
  return {
    username: t.string({
      err: "Username is required",
      inputDefaultValue: "admin",
    }).required(), // Username must be a required string.
    password: t.string({
      err: "Password is required",
      inputDefaultValue: "admin123",
    }).required(), // Password must be a required string.
  };
}).title("Authenticate a user and receive an access token") // Add info for documentation.
  .description(`
    ### ok here
 `);
