
// =============================================================================
// PLUGINS CONFIGURATION
// =============================================================================

import { JetPlugin, type ContextType } from "../../dist/index.js";

/**
 * Auth Plugin - Provides authentication and authorization functionality
 * 
 * This plugin adds methods for token generation, validation, and user
 * authentication that can be used across routes.
 */
export const authPlugin = new JetPlugin({
  executor() {
    // In a real application, use a secure secret management solution 
    const ADMIN_API_KEY = process.env["ADMIN_API_KEY"] || "admin-secret-key";

    // Simple in-memory user store (use a database in production)
    const users = [
      { id: "1", username: "admin", password: "admin123", role: "admin" },
      { id: "2", username: "user", password: "user123", role: "customer" }
    ];

    return {
      /**
       * Validates user credentials and returns a token
       * @param {string} username - User's username
       * @param {string} password - User's password
       * @returns {object} Authentication result with token if successful
       */
      authenticateUser(username: string, password: string) {
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
          return { authenticated: false, message: "Invalid credentials" };
        }

        // In production, use proper JWT library
        const token = `token-${user.id}-${Date.now()}`;
        return {
          authenticated: true,
          token,
          user: { id: user.id, username: user.username, role: user.role }
        };
      },

      /**
       * Verifies if a request has valid authentication
       * @param {JetRequest} request - The incoming request
       * @returns {object} Verification result with user info if authenticated
       */
      verifyAuth(ctx: ContextType<any, any>)  {
        const authHeader = ctx.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return { authenticated: false, message: "Missing or invalid token" };
        }

        const token = authHeader.split(" ")[1];
        // In production, implement proper token validation
        const userId = token.split("-")[1];
        const user = users.find(u => u.id === userId);

        if (!user) {
          return { authenticated: false, message: "Invalid token" };
        }

        return {
          authenticated: true,
          user: { id: user.id, username: user.username, role: user.role }
        };
      },

      /**
       * Verifies if the request is from an admin
       * @param {JetRequest} request - The incoming request
       * @returns {boolean} Whether the user is an admin
       */
      isAdmin(ctx: ContextType<any, any>): boolean {
        // Check for admin API key
        if (ctx.get("x-admin-Key") === ADMIN_API_KEY) {
          return true;
        }

        // Alternatively check user role
        const auth = this["verifyAuth"](ctx);
        return auth.authenticated && auth.user.role === "admin";
      }
    };
  }
});



export type AuthPluginType = ReturnType<typeof authPlugin.executor>
