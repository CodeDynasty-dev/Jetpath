// src/routes/pets.ts

import { writeFile } from "node:fs/promises";
import { type JetFile,type JetRoute, use } from "../../dist/index.js";
// Import AuthPluginType if authentication checks are done within route handlers (besides global middleware)
import { type AuthPluginType } from "../plugins/auth.js";
// Import data models and in-memory data arrays
import { pets, reviews } from "../data/models.js";
import { type PetType } from "../types.js"; // Import PetType
import { join } from "node:path";

// --- Pet Management Routes ---

/**
 * Get all pets with filtering and pagination
 * @route GET /pets
 * @access Public
 * Demonstrates: GET request, query parameters, filtering, sorting, pagination.
 */
export const GET_pets: JetRoute<{
  query: {
    limit?: number;
    offset?: number;
    species?: string;
    minAge?: number;
    maxAge?: number;
    available?: boolean;
    sort?: string;
    search?: string;
  };
}> = function (ctx) {
  // Extract query parameters with defaults (Parsing to appropriate types if necessary, e.g., numbers)
  const limit = ctx.query.limit !== undefined
    ? parseInt(ctx.query.limit as any, 10)
    : 10;
  const offset = ctx.query.offset !== undefined
    ? parseInt(ctx.query.offset as any, 10)
    : 0;
  const species = ctx.query.species;
  const minAge = ctx.query.minAge !== undefined
    ? parseInt(ctx.query.minAge as any, 10)
    : undefined;
  const maxAge = ctx.query.maxAge !== undefined
    ? parseInt(ctx.query.maxAge as any, 10)
    : undefined;
  // Handle boolean query parameter for availability
  let available: boolean | undefined;
  if (ctx.query.available !== undefined) {
    // Convert string "true" or "false" to boolean, or handle other cases
    available = String(ctx.query.available).toLowerCase() === "true";
  }
  const sort = ctx.query.sort || "name"; // Default sort field
  const search = ctx.query.search;

  // Start with a copy of the pets data to apply filters
  let filteredPets = [...pets];

  // Apply filters based on query parameters
  if (available !== undefined) {
    filteredPets = filteredPets.filter((pet) => pet.available === available);
  }

  if (species) {
    filteredPets = filteredPets.filter((pet) =>
      pet.species.toLowerCase() === species.toLowerCase()
    );
  }

  if (minAge !== undefined && !isNaN(minAge)) {
    filteredPets = filteredPets.filter((pet) => pet.age >= minAge);
  }

  if (maxAge !== undefined && !isNaN(maxAge)) {
    filteredPets = filteredPets.filter((pet) => pet.age <= maxAge);
  }

  // Apply search filter (case-insensitive search across name, description, breed, tags)
  if (search) {
    const searchLower = search.toLowerCase();
    filteredPets = filteredPets.filter((pet) =>
      pet.name.toLowerCase().includes(searchLower) ||
      pet.description.toLowerCase().includes(searchLower) ||
      pet.breed.toLowerCase().includes(searchLower) ||
      (pet.tags &&
        pet.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
    );
  }

  // Apply sorting
  const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
  const sortDirection = sort.startsWith("-") ? -1 : 1; // 1 for ascending, -1 for descending

  // Sort the filtered pets array
  filteredPets.sort((a: any, b: any) => {
    const valueA = a[sortField];
    const valueB = b[sortField];

    // Handle different data types for sorting (basic example)
    if (valueA < valueB) return -1 * sortDirection;
    if (valueA > valueB) return 1 * sortDirection;
    return 0; // Values are equal
  });

  // Apply pagination using slice()
  // Ensure limit and offset are valid numbers and non-negative
  const effectiveLimit = !isNaN(limit) && limit > 0 ? limit : 10; // Default or min limit
  const effectiveOffset = !isNaN(offset) && offset >= 0 ? offset : 0; // Default or min offset

  const paginatedPets = filteredPets.slice(
    effectiveOffset,
    effectiveOffset + effectiveLimit,
  );

  // Calculate total pages for pagination info
  const totalPages = Math.ceil(filteredPets.length / effectiveLimit);

  // Create next and previous page URLs for pagination metadata
  const baseUrl = new URL(ctx.get("host")!).origin + "/pets"; // Construct base URL for pagination links
  let nextPage: string | null = null;
  let prevPage: string | null = null;

  // Check if there is a next page
  if (effectiveOffset + effectiveLimit < filteredPets.length) {
    const nextOffset = effectiveOffset + effectiveLimit;
    // Build next page URL, preserving existing query parameters
    const nextUrl = new URL(baseUrl);
    nextUrl.searchParams.set("limit", effectiveLimit.toString());
    nextUrl.searchParams.set("offset", nextOffset.toString());
    if (species) nextUrl.searchParams.set("species", species);
    if (minAge !== undefined) {
      nextUrl.searchParams.set("minAge", minAge.toString());
    }
    if (maxAge !== undefined) {
      nextUrl.searchParams.set("maxAge", maxAge.toString());
    }
    if (available !== undefined) {
      nextUrl.searchParams.set("available", available.toString());
    }
    if (sort) nextUrl.searchParams.set("sort", sort);
    if (search) nextUrl.searchParams.set("search", search);
    nextPage = nextUrl.toString();
  }

  if (effectiveOffset > 0) {
    const prevOffset = Math.max(0, effectiveOffset - effectiveLimit); // Ensure offset is not negative
    // Build previous page URL, preserving existing query parameters
    const prevUrl = new URL(baseUrl);
    prevUrl.searchParams.set("limit", effectiveLimit.toString());
    prevUrl.searchParams.set("offset", prevOffset.toString());
    if (species) prevUrl.searchParams.set("species", species);
    if (minAge !== undefined) {
      prevUrl.searchParams.set("minAge", minAge.toString());
    }
    if (maxAge !== undefined) {
      prevUrl.searchParams.set("maxAge", maxAge.toString());
    }
    if (available !== undefined) {
      prevUrl.searchParams.set("available", available.toString());
    }
    if (sort) prevUrl.searchParams.set("sort", sort);
    if (search) prevUrl.searchParams.set("search", search);
    prevPage = prevUrl.toString();
  }

  // Send the paginated and filtered results in the response.
  ctx.send({
    status: "success",
    count: paginatedPets.length, // Number of pets in the current page
    total: filteredPets.length, // Total number of pets matching filters (before pagination)
    totalPages,
    currentPage: Math.floor(effectiveOffset / effectiveLimit) + 1,
    pagination: {
      next: nextPage,
      prev: prevPage,
    },
    pets: paginatedPets,
  });
};

// Apply .info for documentation.
use(GET_pets).title(
  "Retrieves a list of pets with filtering and pagination options",
);

/**
 * Get pet details by ID
 * @route GET /petBy/:id
 * @access Public
 * Demonstrates: Dynamic GET route ($id), path parameter access, querying data, handling "not found", optional related data inclusion (reviews).
 */
export const GET_petBy$id: JetRoute<{
  params: { id: string };
  query: { includeReviews?: boolean }; // Example query parameter
}> = async function (ctx) {
  const petId = ctx.params.id; // Access the path parameter 'id'.
  // Access query parameter 'includeReviews' and convert to boolean.
  const includeReviews = ctx.query.includeReviews === true ||
    String(ctx.query.includeReviews).toLowerCase() === "true";

  // Find pet by id in the in-memory array.
  const pet = pets.find((p) => p.id === petId);

  // If pet is not found, set 404 status and send error response.
  if (!pet) {
    ctx.code = 404; // Not Found
    ctx.send({
      status: "error",
      message: `Pet with ID ${petId} not found.`,
    });
    return; // Stop processing.
  }

  // Prepare pet data to send in the response. Start with the basic pet object.
  let petData: any = { ...pet };

  // If includeReviews query parameter is true, find and include related reviews.
  if (includeReviews) {
    const petReviews = reviews.filter((review) => review.petId === petId);

    // Calculate average rating for the pet's reviews.
    const totalRating = petReviews.reduce(
      (sum, review) => sum + review.rating,
      0,
    );
    const averageRating = petReviews.length > 0
      ? totalRating / petReviews.length
      : 0;

    // Add reviews and stats to the pet data object.
    petData = {
      ...petData,
      reviews: petReviews,
      reviewStats: {
        count: petReviews.length,
        averageRating: averageRating,
      },
    };
  }

  // Send success response with the pet data (and optionally reviews/stats).
  ctx.send({
    status: "success",
    pet: petData,
  });
};

// Apply .info for documentation.
use(GET_petBy$id).title(
  "Retrieve detailed information about a specific pet by ID",
);

/**
 * Add a new pet to the inventory
 * @route POST /pets
 * @access Authenticated (Admin only - based on sample's middleware check)
 * Demonstrates: POST request, body parsing, input validation (via use().body()), data insertion.
 */
export const POST_pets: JetRoute<{
  body: PetType; // Expecting PetType structure in the request body
}, [AuthPluginType]> = async function (ctx) {
  // The global middleware handles general authentication.
  // The sample included an isAdmin check here, implying this route is admin-only.
  // Access user role from ctx.state, set by the global middleware after successful auth.
  const user = ctx.state["user"];
  if (!user || user.role !== "admin") {
    ctx.code = 403; // Forbidden
    ctx.send({
      status: "error",
      message: "Only administrators can add new pets",
    });
    return;
  }

  // Parse and validate the request body. Jetpath handles this via use().body().
  await ctx.parse(); // Ensure body is parsed
  const petData = ctx.body; // Access the validated body

  // Generate a unique ID and add creation/update timestamps.
  const newPet: PetType = {
    ...petData,
    id: `pet-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`, // More unique ID
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Ensure 'available' is a boolean, defaulting to true if not provided in the body.
    available: petData.available !== undefined
      ? Boolean(petData.available)
      : true,
  };

  // Add the new pet to the in-memory database array.
  pets.push(newPet);

  // Log the creation action (using logger plugin via ctx.plugins).
  // Log the creation action (using logger plugin via ctx.plugins).
  ctx.plugins?.["info"]({
    action: "create_pet",
    petId: newPet.id,
    adminId: user.id,
    message: `Admin ${user.username} created new pet ${newPet.name}`,
  });

  // Send a 201 Created response with the newly created pet details.
  ctx.code = 201; // Created status code.
  ctx.send({
    status: "success",
    message: "Pet added successfully",
    pet: newPet,
  });
};

// Apply body validation and .info() for documentation using use() chained after the function definition.
use(POST_pets).body((t) => {
  // Define the expected request body structure and validation rules.
  return {
    name: t.string({ err: "Pet name is required" }).required(),
    species: t.string({ err: "Pet species is required" }).required(),
    breed: t.string({ err: "Pet breed is required" }).required(),
    // Validate age as a required number.
    age: t.number({ err: "Pet age must be a number" }).required(),
    gender: t.string({ err: "Pet gender is required" }).required(),
    color: t.string({ err: "Pet color is required" }).required(),
    description: t.string({ err: "Pet description is required" }).required(),
    // Validate image as an optional file type.
    image: t.file().optional(),
    // Validate price as a required number.
    price: t.number({ err: "Pet price must be a number" }).required(),
    // Validate available as an optional boolean.
    available: t.boolean().optional(),
    // Validate tags as an optional array of strings.
    tags: t.array(t.string({ err: "Each tag must be a string" })).optional(),
    // Validate health as an optional object with boolean and array properties.
    health: t.object({
      vaccinated: t.boolean().optional(),
      neutered: t.boolean().optional(),
      medicalHistory: t.array(t.string()).optional(),
    }).optional(),
  };
}).title("Add a new pet to the inventory (admin only)");

/**
 * Update an existing pet
 * @route PUT /petBy/:id
 * @access Authenticated (Admin only - based on sample's middleware check)
 * Demonstrates: PUT request, dynamic routing ($id), path parameter access, body parsing, input validation, data update.
 */
export const PUT_petBy$id: JetRoute<{
  params: { id: string };
  body: Partial<PetType>; // Expecting partial PetType structure in body
}, [AuthPluginType]> = async function (ctx) {
  // Check if user is an admin (access user role from ctx.state)
  const user = ctx.state["user"];
  if (!user || user.role !== "admin") {
    ctx.code = 403; // Forbidden
    ctx.send({
      status: "error",
      message: "Only administrators can update pets",
    });
    return;
  }

  const petId = ctx.params.id; // Access path parameter 'id'.
  await ctx.parse(); // Ensure body is parsed.
  const updatedPetData = ctx.body; // Access the parsed body (validation happens via use().body()).

  // Find pet by ID in the in-memory array.
  const index = pets.findIndex((p) => p.id === petId);

  // If pet is not found, set 404 status and send error response.
  if (index === -1) {
    ctx.code = 404; // Not Found
    ctx.send({
      status: "error",
      message: `Pet with ID ${petId} not found.`,
    });
    return; // Stop processing.
  }

  // Update the pet object with new data from the request body.
  // Use spread operator to merge, preserving original ID and creation date.
  const updatedPet = {
    ...pets[index], // Existing pet data
    ...updatedPetData, // New data from the request body (overwrites matching properties)
    id: petId, // Ensure ID remains the same
    createdAt: pets[index].createdAt, // Preserve original creation date
    updatedAt: new Date().toISOString(), // Set update timestamp to now
  };

  // Replace the old pet object in the array with the updated one.
  pets[index] = updatedPet;

  // Log the update action.
  // Log the update action.
  ctx.plugins?.["info"]({
    action: "update_pet",
    petId: updatedPet.id,
    adminId: user.id,
    changes: Object.keys(updatedPetData).join(", "), // Log which fields were potentially changed
    message: `Admin ${user.username} updated pet ${updatedPet.name}`,
  });

  // Send a success response with the updated pet details.
  ctx.send({
    status: "success",
    message: `Pet with ID ${petId} updated successfully`,
    pet: updatedPet,
  });
};

// Apply body validation and .info() for documentation using use() chained after the function definition.
// Validation allows partial updates: all fields are optional here.
use(PUT_petBy$id).body((t) => {
  return {
    name: t.string({ err: "Pet name must be a string" }).optional(),
    species: t.string({ err: "Pet species must be a string" }).optional(),
    breed: t.string({ err: "Pet breed must be a string" }).optional(),
    age: t.number({ err: "Pet age must be a number" }).optional(),
    gender: t.string({ err: "Pet gender must be a string" }).optional(),
    color: t.string({ err: "Pet color must be a string" }).optional(),
    description: t.string({ err: "Pet description must be a string" })
      .optional(),
    image: t.file().optional(), // Allow updating image via file upload (though POST /petImage is dedicated)
    price: t.number({ err: "Pet price must be a number" }).optional(),
    available: t.boolean().optional(),
    tags: t.array(t.string()).optional(),
    health: t.object({
      vaccinated: t.boolean().optional(),
      neutered: t.boolean().optional(),
      medicalHistory: t.array(t.string()).optional(),
    }).optional(),
  };
}).title("Update an existing pet's information (admin only)");

/**
 * Delete a pet from the inventory
 * @route DELETE /petBy/:id
 * @access Authenticated (Admin only - based on sample's middleware check)
 * Demonstrates: DELETE request, dynamic routing ($id), path parameter access, data deletion.
 */
export const DELETE_petBy$id: JetRoute<{
  params: { id: string }; // Access path parameter 'id'.
}, [AuthPluginType]> = function (ctx) {
  // Check if user is an admin (access user role from ctx.state)
  const user = ctx.state["user"];
  if (!user || user.role !== "admin") {
    ctx.code = 403; // Forbidden
    ctx.send({
      status: "error",
      message: "Only administrators can delete pets",
    });
    return;
  }

  const petId = ctx.params.id; // Access path parameter 'id'.

  // Find index of pet by ID.
  const index = pets.findIndex((p) => p.id === petId);

  // If pet is not found, set 404 status and send error response.
  if (index === -1) {
    ctx.code = 404; // Not Found
    ctx.send({
      status: "error",
      message: `Pet with ID ${petId} not found.`,
    });
    return; // Stop processing.
  }

  // Remove the pet from the in-memory array using splice().
  // splice returns an array of deleted elements. We take the first [0].
  const deletedPet = pets.splice(index, 1)[0];

  // Remove associated reviews for the deleted pet.
  // Filter out reviews that match the deleted pet's ID.
  const reviewsToRemove = reviews.filter((review) => review.petId === petId);
  reviewsToRemove.forEach((review) => {
    const reviewIndex = reviews.findIndex((r) => r.id === review.id);
    if (reviewIndex !== -1) {
      reviews.splice(reviewIndex, 1); // Remove the review
    }
  });

  // Log the deletion action.
  // Log the deletion action.
  ctx.plugins?.["info"]({
    action: "delete_pet",
    petId: deletedPet.id,
    adminId: user.id,
    message: `Admin ${user.username} deleted pet ${deletedPet.name}`,
  });

  // Send a success response with details of the deleted pet.
  ctx.send({
    status: "success",
    message: `Pet with ID ${petId} deleted successfully`,
    pet: deletedPet,
  });
};

// Apply .info() for documentation.
use(DELETE_petBy$id).title("Remove a pet from the inventory (admin only)");

/**
 * Advanced search for pets
 * @route GET /pets/search
 * @access Public
 * Demonstrates: GET request, query parameters for complex filtering.
 */
export const GET_pets_search: JetRoute<{
  query: {
    name?: string;
    species?: string;
    breed?: string;
    minPrice?: number; // Note: Query params are strings, need to parse.
    maxPrice?: number; // Note: Query params are strings, need to parse.
    tags?: string; // Expecting comma-separated tags string.
  };
}> = async function (ctx) { // The sample marked this async, although it doesn't await anything. Keep async for consistency.
  // Extract and parse query parameters.
  const name = ctx.query.name;
  const species = ctx.query.species;
  const breed = ctx.query.breed;
  const minPrice = ctx.query.minPrice !== undefined
    ? parseFloat(ctx.query.minPrice as any)
    : undefined; // Parse to float
  const maxPrice = ctx.query.maxPrice !== undefined
    ? parseFloat(ctx.query.maxPrice as any)
    : undefined; // Parse to float
  const tags = ctx.query.tags; // Comma-separated string

  // Start with a copy of the pets data.
  let filteredPets = [...pets];

  // Apply filters. Use case-insensitive comparison where appropriate.
  if (name) {
    const searchName = name.toLowerCase();
    filteredPets = filteredPets.filter((pet) =>
      pet.name.toLowerCase().includes(searchName)
    );
  }

  if (species) {
    const searchSpecies = species.toLowerCase();
    filteredPets = filteredPets.filter((pet) =>
      pet.species.toLowerCase() === searchSpecies
    );
  }

  if (breed) {
    const searchBreed = breed.toLowerCase();
    filteredPets = filteredPets.filter((pet) =>
      pet.breed.toLowerCase().includes(searchBreed)
    );
  }

  if (minPrice !== undefined && !isNaN(minPrice)) {
    filteredPets = filteredPets.filter((pet) => pet.price >= minPrice);
  }

  if (maxPrice !== undefined && !isNaN(maxPrice)) {
    filteredPets = filteredPets.filter((pet) => pet.price <= maxPrice);
  }

  // Filter by tags: split comma-separated string into an array and check if pet has any matching tags.
  if (tags) {
    const tagList = tags.split(",").map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0); // Split, trim, lowercase, remove empty tags
    if (tagList.length > 0) {
      filteredPets = filteredPets.filter((pet) =>
        pet.tags && pet.tags.some((petTag) =>
          // Check if pet has tags AND if any of pet's tags match the search list
          tagList.includes(petTag.toLowerCase()) // Case-insensitive tag comparison
        )
      );
    }
  }

  // Optional: Get pet reviews for average ratings (example from sample)
  // This involves iterating filtered pets and calculating stats from the reviews array.
  const petsWithRatings = filteredPets.map((pet) => {
    const petReviews = reviews.filter((review) => review.petId === pet.id);
    const totalRating = petReviews.reduce(
      (sum, review) => sum + review.rating,
      0,
    );
    const averageRating = petReviews.length > 0
      ? totalRating / petReviews.length
      : 0;

    return {
      ...pet,
      reviewStats: { // Add review stats to the pet object
        count: petReviews.length,
        averageRating,
      },
    };
  });

  // Send the filtered results with review stats.
  ctx.send({
    status: "success",
    count: petsWithRatings.length,
    pets: petsWithRatings,
  });
};

// Apply .info() for documentation.
use(GET_pets_search).title("Advanced search for pets by various criteria");

// --- File Upload Route for Recipe Images ---

/**
 * POST /recipes/:id/image
 * Uploads an image for a specific recipe. (Adapted from sample's POST_upload)
 * @route POST /recipes/:id/image
 * @access Authenticated (Admin only - Based on sample logic, though applied to /upload)
 * Demonstrates: File uploads using use().body() with t.file(), accessing file data, saving files.
 * Assumes multipart/form-data with a field named 'image'.
 */
export const POST_recipes$id_image: JetRoute<{
  params: { id: string }; // Recipe ID from path
  body: { image: JetFile }; // Expecting a file field named 'image' in multipart/form-data body
}, [AuthPluginType]> = async (ctx) => { // Sample had AuthPluginType and jetLoggerType here
  // Check if user is an admin (access user role from ctx.state)
  const user = ctx.state["user"];
  if (!user || user.role !== "admin") {
    ctx.code = 403; // Forbidden
    ctx.send({
      status: "error",
      message: "Only administrators can upload pet images", // Adjusted message
    });
    return;
  }

  const petId = ctx.params.id; // Access recipe ID (using petId variable name for consistency with sample)
  // Check if recipe exists before proceeding with upload.
  const pet = pets.find((p) => p.id === petId);
  if (!pet) {
    ctx.code = 404; // Not Found
    ctx.send({
      status: "error",
      message: `Recipe with ID ${petId} not found.`,
    });
    return;
  }

  // Parse and validate the request body for the file field. Jetpath handles this via use().body() with t.file().
  // The parsed file will be available at ctx.body.image.
  await ctx.parse(); // Ensure body is parsed (required for file access)
  const imageData = ctx.body.image; // Access the uploaded file data (JetFile type)

  // Check if file data is present and valid.
  if (!imageData || !imageData.fileName) {
    ctx.code = 400; // Bad Request
    ctx.send({
      status: "error",
      message: "No image file provided in the 'image' field.",
    });
    return;
  }

  // Optional: Validate image type (example from sample)
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]; // Add gif perhaps
  if (!allowedTypes.includes(imageData.mimeType)) {
    ctx.code = 400;
    ctx.send({
      status: "error",
      message: "Invalid image format. Only JPEG, PNG, WebP, GIF are supported.",
    });
    return;
  }

  // Define the directory to save images. Ensure this directory exists before running.
  const uploadDir = "./uploads/pet-images"; // Using pet-images for consistency with sample logic
  // In a real application, you would want to create this directory if it doesn't exist on startup.
  // const { mkdir } = await import("node:fs/promises");
  // await mkdir(uploadDir, { recursive: true }).catch(console.error);

  // Generate a unique filename for the saved image to prevent name collisions.
  const timestamp = Date.now();
  // Get the original file extension, defaulting if needed.
  const fileExtension = imageData.fileName.split(".").pop() || "bin";
  const uniqueFileName = `${petId}-${timestamp}.${fileExtension}`;
  const filePath = join(uploadDir, uniqueFileName); // Full path to save the file

  try {
    // Save the file content (Buffer/Uint8Array) to the specified path using node:fs/promises.
    await writeFile(filePath, imageData.content);

    // Optional: Update the pet record in the database/memory with the image URL/path
    // Update the existing pet object directly.
    pet.image = `/uploads/pet-images/${uniqueFileName}`; // Store a URL path that can be served
    pet.updatedAt = new Date().toISOString(); // Update modification timestamp

    // Log the image upload action.
    // Log the image upload action.
    ctx.plugins?.["info"]({
      action: "upload_pet_image",
      petId,
      imageUrl: pet.image, // Log the new image URL
      adminId: user.id,
      message: `Admin ${user.username} uploaded image for pet ${pet.name}`,
    });

    // Send a success response with details about the uploaded file.
    ctx.send({
      status: "success",
      message: `Image uploaded successfully for pet ID ${petId}`,
      petId: petId,
      fileName: imageData.fileName, // Original file name
      savedAs: uniqueFileName, // The unique name it was saved as
      url: pet.image, // The URL path stored/associated with the pet
    });
  } catch (error: any) {
    // If an error occurs during file saving, log it and throw it to the global error handler.
    console.error("Error saving file:", error);
    ctx.plugins?.["error"]({
      action: "upload_pet_image_error",
      petId,
      error: error.message,
      message: "Failed to save pet image file",
    });
    throw new Error("Failed to save image file."); // Throw a generic error message
  }
};
// Apply use().body() to define the expected file field and .info() for documentation.
// The body is expected to be multipart/form-data. Jetpath's use().body() with t.file() handles this.
use(POST_recipes$id_image).body((t) => {
  return {
    // Define the 'image' field as a required file type.
    image: t.file({ inputAccept: "image/*" }).required(),
    // You could define other expected text fields in the form data here if any.
  };
}).title("Upload an image for a specific pet (admin only)");

/**
 * Get all pet images (Example route from sample - simplified as we only store one image URL per pet)
 * @route GET /petBy/:id/gallery
 * @access Public
 * Demonstrates: Dynamic GET route ($id), returning related data.
 */
export const GET_petBy$id_gallery: JetRoute<{
  params: { id: string };
}> = function (ctx) {
  const petId = ctx.params.id;

  // Find pet by ID
  const pet = pets.find((p) => p.id === petId);

  if (!pet) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: `Pet with ID ${petId} not found`,
    });
    return;
  }

  // In this sample, we only store a single 'image' URL on the pet object.
  // A real gallery would likely involve fetching multiple image URLs from a database table.
  const gallery = pet.image ? [pet.image] : []; // Return an array containing the single image URL if it exists.

  ctx.send({
    status: "success",
    petId: petId,
    petName: pet.name,
    gallery: gallery,
  });
};

use(GET_petBy$id_gallery).title(
  "Get images for a specific pet (returns main image URL in this sample)",
);

// Export route handlers so Jetpath can discover and register them based on naming convention.
