// src/routes/utils.ts

import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path"; // Import join
import { type JetFile, JetFunc, use } from "jetpath";
import { pets, reviews } from "../data/models"; // Import data for stats route
import { type AuthPluginType } from "../plugins/auth"; // Import AuthPluginType for stats route

// --- Utility and Miscellaneous Routes ---

// Mock structure for documentation data based on the original sample
// In a real Jetpath implementation, there might be an API to get registered routes and their info.
// For this example, we'll manually list the endpoints to demonstrate the export format,
// pulling descriptions from the route handlers' `.info` properties conceptually.
interface ApiEndpointInfo {
  path: string;
  method: string;
  description: string;
  parameters?: Record<string, string | undefined>;
}

interface ApiInfo {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: ApiEndpointInfo[];
}

// Manually list endpoints with basic info for the documentation export.
// This mirrors how the app.jet.ts sample generated documentation.
const manualApiEndpoints: ApiEndpointInfo[] = [
  { path: "/", method: "GET", description: "API information and status" },
  { path: "/auth/login", method: "POST", description: "Authenticate a user" },
  {
    path: "/pets",
    method: "GET",
    description: "Get all pets with filtering and pagination",
  },
  { path: "/pets", method: "POST", description: "Add a new pet (admin only)" },
  { path: "/petBy/:id", method: "GET", description: "Get pet details by ID" },
  {
    path: "/petBy/:id",
    method: "PUT",
    description: "Update an existing pet (admin only)",
  },
  {
    path: "/petBy/:id",
    method: "DELETE",
    description: "Delete a pet (admin only)",
  },
  {
    path: "/pets/search",
    method: "GET",
    description: "Advanced search for pets",
  },
  {
    path: "/petImage/:id",
    method: "POST",
    description: "Upload an image for a pet (admin only)",
  }, // Corrected path based on sample
  {
    path: "/petBy/:id/gallery",
    method: "GET",
    description: "Get images for a pet (simplified)",
  },
  {
    path: "/petBy/:id/reviews",
    method: "GET",
    description: "Get all reviews for a pet",
  },
  {
    path: "/petBy/:id/reviews",
    method: "POST",
    description: "Add a review for a pet (authenticated only)",
  },
  {
    path: "/reviews/:reviewId",
    method: "DELETE",
    description: "Delete a review (owner or admin only)",
  },
  {
    path: "/stats",
    method: "GET",
    description: "Get shop statistics (admin only)",
  },
  {
    path: "/live",
    method: "GET",
    description: "WebSocket endpoint for real-time updates",
  },
  {
    path: "/upload",
    method: "POST",
    description: "General file upload (admin only)",
  },
  {
    path: "/error",
    method: "GET",
    description: "Route that intentionally throws an error (for testing)",
  },
  { path: "/health", method: "GET", description: "API health check endpoint" },
  {
    path: "/serve/*",
    method: "GET",
    description: "Serve files from the file system",
  },
  { path: "/static/*", method: "GET", description: "Serve static files" },

  {
    path: "/export/docs/:format",
    method: "GET",
    description: "Export API documentation",
  },
];

/**
 * Root endpoint - Welcome message and API status (Extracted from app.jet.ts)
 * @route GET /
 * @access Public
 * Demonstrates: Basic GET route, returning simple JSON info.
 */
export const GET_: JetFunc = function (ctx) {
  ctx.send({
    name: "PetShop API", // Using PetShop name from original sample
    version: "1.0.0",
    status: "online",
    timestamp: new Date().toISOString(),
    endpoints: { // List some key endpoints
      documentationUI: "/api-doc",
      documentationExport: "/export/docs/json", // Example export format
      pets: "/pets",
      authentication: "/auth/login",
      realtime: "/live",
    },
  });
};

// Apply .info() for documentation.
use(GET_).info("Returns API information and status");

/**
 * Get shop statistics (Extracted from app.jet.ts)
 * @route GET /stats
 * @access Admin only (Based on sample logic)
 * Demonstrates: GET request, performing calculations on data, authorization check.
 */
export const GET_stats: JetFunc<{}> = function (ctx) { // Removed plugin type here, relying on global middleware for auth check
  // Check if user is an admin (access user role from ctx.state)
  // The global middleware populates ctx.state.user if authenticated.
  const user = ctx.state["user"];
  if (!user || user.role !== "admin") {
    ctx.code = 403; // Forbidden
    ctx.send({
      status: "error",
      message: "Only administrators can access statistics",
    });
    return;
  }

  // Calculate statistics based on in-memory data.
  const totalPets = pets.length;
  const availablePets = pets.filter((pet) => pet.available).length;
  const totalSpecies = new Set(pets.map((pet) => pet.species)).size;

  // Count pets by species.
  const speciesCount: Record<string, number> = {};
  pets.forEach((pet) => {
    speciesCount[pet.species] = (speciesCount[pet.species] || 0) + 1;
  });

  // Calculate average pet price.
  const totalPrice = pets.reduce((sum, pet) => sum + pet.price, 0);
  const averagePrice = totalPets > 0 ? totalPrice / totalPets : 0;

  // Calculate review statistics.
  const totalReviews = reviews.length;
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

  // Send statistics in the response.
  ctx.send({
    status: "success",
    stats: {
      pets: {
        total: totalPets,
        available: availablePets,
        unavailable: totalPets - availablePets,
        speciesCount: speciesCount, // Include species count object
        totalSpecies: totalSpecies, // Include total unique species count
        averagePrice: averagePrice,
      },
      reviews: {
        total: totalReviews,
        averageRating: averageRating,
      },
    },
    generatedAt: new Date().toISOString(), // Timestamp for when stats were generated
  });
};

// Apply .info() for documentation.
use(GET_stats).info("Get shop statistics (admin only)");

/**
 * Intentional error route for testing error handling (Extracted from app.jet.ts)
 * @route GET /error
 * @access Public (for testing only)
 * Demonstrates: How throwing an error is caught by the global middleware.
 */
export const GET_error: JetFunc = function (_ctx) {
  // Intentionally throw an error to trigger the global error handler.
  throw new Error("This is an intentional error for testing error handling");
};

// Apply .info() for documentation.
use(GET_error).info(
  "Route that intentionally throws an error (for testing global error handling)",
);

/**
 * Health check endpoint (Extracted from app.jet.ts)
 * @route GET /health
 * @access Public
 * Demonstrates: Basic GET route, accessing system information, returning status.
 */
export const GET_health: JetFunc = function (ctx) {
  // Get system information like uptime and memory usage.
  const uptime = process.uptime(); // Process uptime in seconds
  const memoryUsage = process.memoryUsage(); // Memory usage details

  // Format uptime into a human-readable string.
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
  };

  // Format memory usage in MB.
  const formatMemory = (bytes: number) =>
    `${Math.round(bytes / 1024 / 1024)} MB`;

  // Send health status and system information.
  ctx.send({
    status: "healthy", // Indicate health status
    uptime: { // Include uptime information
      seconds: uptime,
      formatted: formatUptime(uptime),
    },
    memory: { // Include memory usage information
      rss: formatMemory(memoryUsage.rss), // Resident Set Size
      heapTotal: formatMemory(memoryUsage.heapTotal), // Total Heap Size
      heapUsed: formatMemory(memoryUsage.heapUsed), // Used Heap Size
    },
    timestamp: new Date().toISOString(), // Current timestamp
  });
};

// Apply .info() for documentation.
use(GET_health).info("API health check endpoint");

/**
 * Export API documentation in various formats (Extracted from app.jet.ts)
 * @route GET /export/docs/:format
 * @access Public
 * Demonstrates: Dynamic GET route ($format), path parameter, conditional response formatting (JSON, YAML, Markdown), setting Content-Type headers.
 */
export const GET_export_docs$format: JetFunc<{
  params: { format: string }; // Format from path parameter
}> = function (ctx) {
  // Access the requested format from the path parameter.
  const format = ctx.params.format.toLowerCase();

  // Construct the API information object.
  // We use the manually defined list of endpoints for this example.
  const apiInfo: ApiInfo = {
    name: "PetShop API", // Using PetShop name
    version: "1.0.0", // Using sample version
    description: "A comprehensive API for managing pet shop inventory", // Using sample description
    baseUrl:
      new URL(ctx.get("host") || `http://localhost:${ctx.config.port}`).origin, // Get base URL from context or config
    endpoints: manualApiEndpoints, // Use the manually defined list of endpoints
  };

  // Format the output based on the requested format and set appropriate Content-Type header.
  if (format === "json") {
    ctx.set("Content-Type", "application/json");
    ctx.send(apiInfo); // Send JSON object
  } else if (format === "yaml" || format === "yml") {
    // Simple YAML conversion.
    let yaml = `name: ${apiInfo.name}\n`;
    yaml += `version: ${apiInfo.version}\n`;
    yaml += `description: ${apiInfo.description}\n`;
    yaml += `baseUrl: ${apiInfo.baseUrl}\n`;
    yaml += `endpoints:\n`;

    apiInfo.endpoints.forEach((endpoint: any) => {
      yaml += `  - path: ${endpoint.path}\n`;
      yaml += `    method: ${endpoint.method}\n`;
      yaml += `    description: ${endpoint.description}\n`;
      if (endpoint.parameters && Object.keys(endpoint.parameters).length > 0) {
        yaml += `    parameters:\n`;
        for (const [param, desc] of Object.entries(endpoint.parameters)) {
          yaml += `      ${param}: "${desc}"\n`; // Quote descriptions for YAML compatibility
        }
      }
    });

    ctx.set("Content-Type", "text/yaml");
    ctx.send(yaml); // Send YAML string
  } else if (format === "markdown" || format === "md") {
    // Generate markdown documentation.
    let markdown = `# ${apiInfo.name} v${apiInfo.version}\n\n`;
    markdown += `${apiInfo.description}\n\n`;
    markdown += `Base URL: ${apiInfo.baseUrl}\n\n`;
    markdown += `## Endpoints\n\n`;

    apiInfo.endpoints.forEach((endpoint: any) => {
      markdown += `### ${endpoint.method} ${endpoint.path}\n\n`;
      markdown += `${endpoint.description}\n\n`;

      if (endpoint.parameters && Object.keys(endpoint.parameters).length > 0) {
        markdown += `**Parameters:**\n\n`;
        markdown += `| Name | Description |\n`;
        markdown += `| ---- | ----------- |\n`;

        for (const [param, desc] of Object.entries(endpoint.parameters)) {
          markdown += `| ${param} | ${desc} |\n`;
        }
        markdown += `\n`; // Add newline after parameters table
      }
    });

    ctx.set("Content-Type", "text/markdown");
    ctx.send(markdown); // Send Markdown string
  } else {
    // If the requested format is not supported, return a 400 error.
    ctx.code = 400; // Bad Request
    ctx.send({
      status: "error",
      message:
        `Unsupported format: ${format}. Supported formats are json, yaml, and markdown.`,
    });
  }
};

// Apply .info() for documentation.
use(GET_export_docs$format).info(
  "Export API documentation in different formats (json, yaml, markdown)",
);

/**
 * General file upload handler (Extracted from app.jet.ts)
 * @route POST /upload
 * @access Authenticated (Admin only - Based on sample logic)
 * Demonstrates: Handling multipart/form-data with multiple file fields and text fields, saving files.
 * Assumes body contains fields like 'image', 'document', 'title', 'description', 'tags'.
 */
export const POST_upload: JetFunc<{
  body: { // Expected structure based on sample's use().body()
    image: JetFile;
    document: JetFile; // Assuming 'document' is also a file based on sample
    title: string;
    description: string;
    tags: string; // Tags were a string in sample's use().body(), though maybe intended as array later. Stick to string for now.
  };
  // Sample also had plugin types here, implying plugins might help with form data parsing.
  // If use().body() handles this directly with t.file(), plugin isn't strictly needed for parsing.
}, [AuthPluginType]> = async (ctx) => { // Sample had AuthPluginType and jetLoggerType here
  // Check if user is an admin (access user role from ctx.state)
  const user = ctx.state["user"];
  if (!user || user.role !== "admin") {
    ctx.code = 403; // Forbidden
    ctx.send({
      status: "error",
      message: "Only administrators can upload files",
    });
    return;
  }

  try {
    // Parse the multipart/form-data body. Jetpath handles this via use().body() with t.file().
    // The parsed fields (files and text) are available at ctx.body.
    // The sample used ctx.parse() with a maxBodySize option, which is also possible.
    // Let's stick to use().body() for consistency with other routes.
    await ctx.parse({
      maxBodySize: 20 * 1024 * 1024, // Set max body size (e.g., 20MB)
    });
    const formData = ctx.body; // Access the parsed form data

    const results: Record<string, any> = {}; // Object to store results of processing each field

    // Process each field in the parsed form data.
    // The sample iterated formData directly.
    for (const fieldName in formData) {
      const field = formData[fieldName as keyof typeof formData]; // Access field value

      // Check if the field is an uploaded file (JetFile type has fileName and content).
      // JetFile extends Blob or File, so checking for fileName and content is a way to identify files.
      if (
        field && typeof field === "object" && "fileName" in field &&
        field.content
      ) {
        const fileData = field as JetFile; // Cast to JetFile type for clarity

        console.log(
          `Processing file: ${fileData.fileName}, type: ${fileData.mimeType}`,
        );

        // Define the directory to save uploaded files. Ensure it exists.
        let saveDir = "./uploads/general-files"; // Use a general upload directory
        // In a real application, ensure this directory is created on startup.
        // const { mkdir } = await import("node:fs/promises");
        // await mkdir(saveDir, { recursive: true }).catch(console.error);

        // Generate a unique filename to prevent overwrites.
        const timestamp = Date.now();
        // Get the original file extension.
        const fileExtension = fileData.fileName.split(".").pop() || "bin";
        const uniqueFilename = `${fieldName}-${timestamp}.${fileExtension}`; // Include field name in unique name
        const filePath = join(saveDir, uniqueFilename); // Full path to save the file

        // Save the file content.
        try {
          await writeFile(filePath, fileData.content);

          // Store result information for this file.
          results[fieldName] = {
            fileName: fileData.fileName,
            savedAs: uniqueFilename,
            size: fileData.content.byteLength, // File size in bytes
            mimeType: fileData.mimeType,
            url: `/${saveDir}/${uniqueFilename}`, // URL path (relative)
          };
          console.log(`File saved: ${filePath}`);
        } catch (fileError) {
          console.error(`Error saving file ${fileData.fileName}:`, fileError);
          // Log file save error using logger plugin.
          ctx.plugins?.logger?.error({
            action: "file_upload_save_error",
            fieldName: fieldName,
            fileName: fileData.fileName,
            error: fileError instanceof Error
              ? fileError.message
              : String(fileError),
            adminId: user.id,
            message:
              `Admin ${user.username} failed to save file ${fileData.fileName}`,
          });

          // Decide how to handle individual file save errors: skip, fail whole request, etc.
          // For this example, we'll log and note the failure in results.
          results[fieldName] = {
            fileName: fileData.fileName,
            status: "failed",
            error: "Failed to save file",
          };
        }
      } else {
        // If the field is not a file, it's likely a text field. Store its value.
        results[fieldName] = field;
      }
    }

    // Log the overall upload action.
    ctx.plugins?.logger?.info({
      action: "general_file_upload",
      userId: user.id,
      uploadedFiles: Object.keys(results).filter((key) => results[key].url).map(
        (key) => results[key].fileName,
      ),
      message: `Admin ${user.username} performed a general file upload`,
    });

    // Send a success response with the results of processing each field.
    ctx.send({
      status: "success",
      message: "File processing complete", // Message reflects overall process
      data: results, // Include details about each processed field
    });
  } catch (error: any) {
    // If an error occurred during body parsing (e.g., maxBodySize exceeded, invalid multipart data),
    // log it and throw it to the global error handler.
    console.error("Error processing file upload:", error);
    ctx.plugins?.logger?.error({
      action: "general_file_upload_process_error",
      error: error.message,
      adminId: user?.id || "unknown",
      message: "Failed to process general file upload",
    });
    throw error; // Throw the error to the global handler.
  }
};

// Apply use().body() to define the expected fields in the multipart/form-data body.
use(POST_upload).body((t) => {
  return {
    // Define expected file fields using t.file().
    image: t.file({ inputAccept: "image/*", err: "Image field must be a file" })
      .optional(), // Optional image file
    document: t.file({ err: "Document field must be a file" }).optional(), // Optional document file
    // Define expected text fields using t.string().
    title: t.string({ err: "Title must be a string" }).optional(), // Optional title string
    description: t.string({ err: "Description must be a string" }).optional(), // Optional description string
    tags: t.string({ err: "Tags must be a string" }).optional(), // Optional tags string (as in sample's use)
  };
}).info(
  "Upload files with metadata (admin only) - expects multipart/form-data",
);

/**
 * Serve files from the file system (Extracted from app.jet.ts)
 * @route GET /serve/*
 * @access Public
 * Demonstrates: Dynamic routing ($0 for wildcard), serving static content.
 */
export const GET_serve$0: JetFunc<{ params: { "*": string } }> = function (
  ctx,
) {
  // Access the wildcard path parameter.
  const filePath = ctx.params["*"] || ""; // Path relative to the serve directory

  // Construct the full path to the file to serve.
  // Assuming files to serve are in a 'served-content' directory.
  // In the sample it uses './usage', let's make it a more generic 'served-content'.
  const serveDir = "./served-content"; // Directory containing files to serve
  const fullPath = join(serveDir, filePath);

  // Use ctx.sendStream to efficiently stream the file content as the response.
  // This is suitable for large files. Jetpath likely handles setting Content-Type.
  ctx.sendStream(fullPath);
};

// Apply .info() for documentation.
use(GET_serve$0).info(
  "Serve files from the file system based on wildcard path parameter.",
);

/**
 * Serve static files (Similar to serve, but often used for explicit static assets) (Extracted from app.jet.ts)
 * @route GET /static/*
 * @access Public
 * Demonstrates: Dynamic routing ($0 for wildcard), downloading content (often in-browser).
 */
export const GET_static$0: JetFunc<{ params: { "*": string } }> = function (
  ctx,
) {
  // Access the wildcard path parameter.
  const filePath = ctx.params["*"] || ""; // Path relative to the static directory

  // Construct the full path to the static file.
  const staticDir = "./public/static"; // Directory containing static files
  const fullPath = join(staticDir, filePath);

  // Use ctx.download to send the file. This often prompts the browser to download the file.
  // Jetpath likely handles setting Content-Type and Content-Disposition headers.
  ctx.download(fullPath);
};

// Apply .info() for documentation.
use(GET_static$0).info(
  "Serve static files for download or in-browser display.",
);

// Export route handlers so Jetpath can discover and register them based on naming convention.
