// src/middleware/global.ts

import { JetMiddleware } from "../../dist";
// Assuming AuthPluginType and jetLoggerType are defined or imported from plugin types
import { type AuthPluginType } from "../plugins/auth"; // Assuming auth plugin types are here
import { type jetLoggerType } from "../plugins/logging"; // Assuming logger plugin types are here

/**
 * Global middleware for request processing and error handling (Extracted from app.jet.ts)
 * This middleware runs for all routes and handles:
 * - Request logging
 * - Authentication verification (when needed)
 * - Error processing
 * - Response formatting
 *
 * It is automatically applied by Jetpath because of its exported name `MIDDLEWARE_`.
 *
 * @param {Object} ctx - The request context (pre-handler)
 * @returns {Function} The post-handler middleware function
 */
export const MIDDLEWARE_: JetMiddleware<{}, [AuthPluginType, jetLoggerType]> = (
  ctx,
) => {
  // --- Pre-handler Logic (runs before the route handler) ---
  const startTime = Date.now();
  // Generate a unique request ID (example from app.jet.ts)
  const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  ctx.set("X-Request-ID", requestId); // Add request ID to response headers

  // Log initial request info using the logger plugin (if available)
  // Use optional chaining in case plugins aren't correctly loaded/typed
  ctx.plugins?.logger?.info({
    requestId,
    method: ctx.request.method,
    url: ctx.request.url,
    message: "Request received",
  });

  // Authentication verification (example from app.jet.ts)
  // Skip auth check for public routes
  const isPublicRoute = ctx.request.url.includes("/auth/login") ||
    ctx.request.url.includes("/api-doc") || // api-doc is public
    ctx.request.url.includes("/export/docs") || // documentation export is public
    ctx.request.url.includes("/health") || // health check is public
    ctx.request.url === "/" || // root is public
    ctx.request.url.startsWith("/static/") || // static files are public (based on GET_static$0)
    ctx.request.url.startsWith("/serve/"); // served files are public (based on GET_serve$0)
  // Note: Pet list and detail (GET /pets, GET /petBy/:id) were public in the sample,
  // while POST/PUT/DELETE pets and others were protected.
  // We'll leave the authentication check logic as it was in the sample for now.

  // Verify authentication for protected routes
  // The original sample checked auth for any non-public route unless it was the root GET.
  // Let's refine this check slightly for clarity, assuming auth is needed *unless* it's explicitly public.
  const requiresAuth = !isPublicRoute &&
    !ctx.request.url.startsWith("/pets") && // Assuming GET /pets and /petBy/:id are public
    !ctx.request.url.startsWith("/petBy/") && // GET pet details are public
    !ctx.request.url.startsWith("/reviews"); // Assuming GET reviews are public

  if (requiresAuth) { // Only run auth check if the route is not public
    const auth = ctx.plugins?.auth?.verifyAuth(ctx); // Use optional chaining for safety
    if (!auth?.authenticated) {
      ctx.code = 401; // Unauthorized
      ctx.set("WWW-Authenticate", "Bearer"); // Suggest Bearer auth
      ctx.plugins?.logger?.warn({
        requestId,
        message: "Authentication failed",
        url: ctx.request.url,
        method: ctx.request.method,
      });
      // We don't ctx.throw here; the post-handler will process the 401 code.
    } else {
      // Attach user info to context state for use in route handlers
      ctx.state["user"] = auth.user;
    }
  }

  // --- Post-handler Logic (runs after the route handler, or if an error occurs) ---
  // This function is returned by the pre-handler and receives the context and potential error.
  return (ctx, err: any) => {
    const duration = Date.now() - startTime; // Calculate total request duration.

    // Add standard response header
    ctx.set("X-Response-Time", `${duration}ms`);

    // --- Error Handling ---
    if (err) {
      // An error occurred. Log it using the logger plugin.
      ctx.plugins?.logger?.error({
        requestId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        code: ctx.code || 500, // Use existing code or default to 500
        url: ctx.request.url,
        method: ctx.request.method,
        duration,
        message: "Request failed due to error",
      });

      // Determine the status code for the error response.
      ctx.code = ctx.code >= 400
        ? ctx.code
        : (err.statusCode && err.statusCode >= 400 ? err.statusCode : 500);

      // Send a standardized JSON error response.
      ctx.send({
        status: "error",
        message: ctx.code === 500 && process.env.NODE_ENV === "production"
          ? "An internal server error occurred."
          : err.message || "Internal server error", // Use error message in dev or for client errors
        requestId,
        timestamp: new Date().toISOString(),
        // Include stack trace in non-production environments
        ...(process.env.NODE_ENV !== "production" && err instanceof Error &&
          err.stack && { stack: err.stack.split("\n") }),
      });

      // Return to stop further processing of this error by Jetpath.
      return;
    }

    // --- 404 Handling ---
    // If no route matched, Jetpath sets ctx.code to 404. Handle this specifically.
    if (ctx.code === 404) {
      ctx.plugins?.logger?.warn({
        requestId,
        message: "Resource not found (404)",
        url: ctx.request.url,
        method: ctx.request.method,
        duration,
      });

      ctx.send({
        status: "error",
        message: "The requested resource was not found",
        requestId,
        timestamp: new Date().toISOString(),
      });
      return; // Return to stop further processing
    }

    // --- Successful Response Logging ---
    // If no error and code is not 404, it's a successful response.
    ctx.plugins?.logger?.info({
      requestId,
      status: ctx.code,
      duration,
      url: ctx.request.url,
      method: ctx.request.method,
      message: "Request completed successfully",
    });

    // If the post-handler doesn't return anything (or returns undefined),
    // Jetpath continues with the response process.
  };
};
