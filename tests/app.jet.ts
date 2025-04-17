/**
 * PetShop API - A comprehensive demonstration of JetPath framework capabilities
 * 
 * This application showcases best practices for building robust APIs with JetPath,
 * including proper error handling, validation, authentication, logging, 
 * file uploads, real-time communication, and more.
 */
import {
  JetPath,
  type JetFunc,
  type JetMiddleware,
} from "../dist/index.js";
import { authPlugin, type AuthPluginType } from "./plugins/auth.ts";
import { jetlogger, type jetloggerType } from "./plugins/logging.ts";



/**
 * Configuration for the PetShop API application
 * 
 * The configuration includes API documentation settings, server configuration,
 * static file serving, and global headers that will be applied to all responses.
 */
const app = new JetPath({
  apiDoc: {
    name: "PetShop API",
    info: `
    # PetShop API Documentation
    
    This API provides comprehensive functionality for managing a pet shop inventory.
    Features include:
    
    - Complete CRUD operations for pets
    - Advanced searching and filtering
    - Image upload and management
    - Authentication and authorization
    - Real-time notifications via WebSockets
    - Comprehensive logging and error handling

    users:-:

      id,username,password,role
      1,admin,admin123,admin 
      2,user,user123,customer


    `,
    color: "#4287f5", // Professional blue color scheme
    username: "admin",
    password: "1234",
  },
  source: "./tests", // Organized routes directory
  APIdisplay: "UI", // Interactive API documentation UI
  port: 9000,
  // static: { 
  //   dir: "./public", 
  //   route: "/assets" 
  // }, 
  // globalHeaders: {
  //   "X-Pet-API-Version": "1.0.0",
  //   "Access-Control-Allow-Origin": "*",
  //   "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  //   "Access-Control-Allow-Headers": "Content-Type, Authorization",
  // }, 
});


jetlogger.setConfig({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: "json",
  filename: "./tests/petshop-api.log"

})
app.use(jetlogger);
app.use(authPlugin);

// Equivalent to: { name: string; age: number; }

// app.use(loggerPlugin);

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

/**
 * Global middleware for request processing and error handling
 * 
 * This here's deatiled API sample of framework2 actually called jetpathiddleware runs for all routes and handles:
 * - Request logging
 * - Authentication verification (when needed)
 * - Error processing
 * - Response formatting
 * 
 * @param {Object} ctx - The request context
 * @returns {Function} The post-handler middleware
 */
export const MIDDLEWARE_: JetMiddleware<{}, [AuthPluginType, jetloggerType]> = (ctx) => {
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  ctx.plugins.info(ctx);

  // Add request ID to all responses
  ctx.set("X-Request-ID", requestId);

  // Skip auth check for public routes
  const isPublicRoute = ctx.request.url.includes("/login") ||
    ctx.request.url.includes("/register") ||
    ctx.request.url.includes("/api-doc") ||
    (ctx.request.url === "/" && ctx.request.method === "GET");

  // Verify authentication for protected routes
  if (!isPublicRoute && ctx.request.url !== "/" && !ctx.request.url.includes("/docs")) {
    const auth = ctx.plugins.verifyAuth(ctx);
    if (!auth.authenticated) {
      ctx.code = 401;
      ctx.set("WWW-Authenticate", "Bear");
      ctx.plugins?.["logger"]?.warn({
        requestId,
        message: "Authentication failed",
        url: ctx.request.url
      });
      ctx.throw("Unauthorized: Valid authentication is required");
    }

    // Attach user info to context for use in route handlers
    // Attach user info to context for use in route handlers
    ctx.app["user"] = auth.user;
  }

  return (ctx, err: any) => {
    console.log(err);
    ctx.plugins.error(ctx, String(err));
    const duration = Date.now() - startTime;

    // Add standard response headers
    ctx.set("X-Response-Time", `${duration}ms`);

    // Handle errors
    if (err) {
      ctx.code = ctx.code >= 400 ? ctx.code : 500;

      // Log the error
      // Log the error
      ctx.plugins?.["logger"]?.error({
        requestId,
        error: err.message,
        stack: err.stack,
        code: ctx.code,
        url: ctx.request.url,
        duration
      });

      // Send error response
      ctx.send({
        status: "error",
        message: ctx.code === 500 ? "Internal server error" : err.message,
        requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 404 handler
    if (ctx.code === 404) {
      ctx.plugins?.["logger"]?.warn({
        requestId,
        message: "Resource not found",
        url: ctx.request.url,
        duration
      });

      ctx.send({
        status: "error",
        message: "The requested resource was not found",
        requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Log successful response
    // Log successful response
    ctx.plugins?.["logger"]?.info({
      requestId,
      status: ctx.code,
      duration,
      url: ctx.request.url
    });
  };
};

// =============================================================================
// DATA MODELS AND STORAGE
// =============================================================================

/**
 * Pet data model
 * @typedef {Object} PetType
 * @property {string} id - Unique identifier for the pet
 * @property {string} name - Name of the pet
 * @property {string} species - Species of the pet (dog, cat, bird, etc.)
 * @property {string} breed - Breed of the pet
 * @property {number} age - Age of the pet in years
 * @property {string} gender - Gender of the pet (male/female)
 * @property {string} color - Color of the pet
 * @property {string} description - Detailed description of the pet
 * @property {string} [image] - URL to the pet's image
 * @property {number} price - Price of the pet
 * @property {boolean} available - Whether the pet is available for purchase
 * @property {string} createdAt - Date when the pet was added to inventory
 * @property {string} updatedAt - Date when the pet was last updated
 * @property {Array<string>} [tags] - Tags/keywords associated with the pet
 * @property {Object} [health] - Health information for the pet
 * @property {boolean} [health.vaccinated] - Whether the pet is vaccinated
 * @property {boolean} [health.neutered] - Whether the pet is neutered/spayed
 * @property {Array<string>} [health.medicalHistory] - Medical history entries
 */

type PetType = {
  id?: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  gender: string;
  color: string;
  description: string;
  image?: string;
  price: number;
  available: boolean;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
  health?: {
    vaccinated?: boolean;
    neutered?: boolean;
    medicalHistory?: string[];
  };
};

/**
 * User review data model
 * @typedef {Object} ReviewType
 * @property {string} id - Unique identifier for the review
 * @property {string} petId - ID of the pet being reviewed
 * @property {string} userId - ID of the user writing the review
 * @property {string} username - Username of the reviewer
 * @property {number} rating - Rating from 1-5
 * @property {string} comment - Review comment
 * @property {string} createdAt - Date when the review was created
 */
/**
 * In-memory pet database
 * In a production application, this would be replaced with a real database
 * @type {Array<PetType>}
 */
const pets: PetType[] = [
  {
    id: "pet-1",
    name: "Max",
    species: "Dog",
    breed: "Golden Retriever",
    age: 3,
    gender: "Male",
    color: "Golden",
    description: "Friendly and energetic golden retriever, great with children",
    image: "/assets/images/max.jpg",
    price: 500,
    available: true,
    createdAt: "2023-06-15T10:30:00Z",
    updatedAt: "2023-06-15T10:30:00Z",
    tags: ["friendly", "energetic", "family-friendly"],
    health: {
      vaccinated: true,
      neutered: true,
      medicalHistory: ["Regular checkup - 2023-05-01"]
    }
  },
  {
    id: "pet-2",
    name: "Luna",
    species: "Cat",
    breed: "Siamese",
    age: 2,
    gender: "Female",
    color: "Cream with brown points",
    description: "Elegant Siamese cat with striking blue eyes and a playful personality",
    image: "/assets/images/luna.jpg",
    price: 350,
    available: true,
    createdAt: "2023-07-10T14:15:00Z",
    updatedAt: "2023-07-10T14:15:00Z",
    tags: ["elegant", "vocal", "playful"],
    health: {
      vaccinated: true,
      neutered: true,
      medicalHistory: ["Regular checkup - 2023-06-15"]
    }
  }
];

/**
 * In-memory reviews database
 * @type {Array<ReviewType>}
 */
const reviews = [
  {
    id: "review-1",
    petId: "pet-1",
    userId: "2",
    username: "user",
    rating: 5,
    comment: "Max is such a wonderful companion! Highly recommend this breed.",
    createdAt: "2023-08-20T09:45:00Z"
  }
];

// Start the server and listen for incoming requests
app.listen();

// =============================================================================
// API ROUTES - CORE FUNCTIONALITY
// =============================================================================

/**
 * Root endpoint - Welcome message and API status
 * @route GET /
 * @access Public
 */
export const GET_: JetFunc = function (ctx) {
  ctx.send({
    name: "PetShop API",
    version: "1.0.0",
    status: "online",
    timestamp: new Date().toISOString(),
    endpoints: {
      documentation: "/docs",
      pets: "/pets",
      authentication: "/auth/login"
    }
  });
};

GET_.info = "Returns API information and status";

/**
 * Authentication endpoint - Login with username and password
 * @route POST /auth/login
 * @access Public
 */
export const POST_auth_login: JetFunc<{ body: { username: string; password: string } }, [AuthPluginType]> = async function (ctx) {
  await ctx.parse();
  const { username, password } = ctx.validate();

  const authResult = ctx.plugins.authenticateUser(username, password);

  if (!authResult.authenticated) {
    ctx.code = 401;
    ctx.send({ status: "error", message: authResult.message });
    return;
  }

  ctx.send({
    status: "success",
    message: "Authentication successful",
    token: authResult.token,
    user: {
      id: authResult.user.id,
      username: authResult.user.username,
      role: authResult.user.role
    }
  });
};

POST_auth_login.body = {
  username: { type: "string", required: true, err: "Username is required", inputDefaultValue: "admin" },
  password: { type: "string", required: true, err: "Password is required", inputDefaultValue: "admin123" }
};

POST_auth_login.info = "Authenticate a user and receive an access token";

// =============================================================================
// PET MANAGEMENT ROUTES
// =============================================================================

/**
 * Get all pets with filtering and pagination
 * @route GET /pets
 * @access Public
 */
export const GET_pets: JetFunc<{
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
  // Extract query parameters with defaults
  const {
    limit = 10,
    offset = 0,
    species,
    minAge,
    maxAge,
    available,
    sort = "name",
    search
  } = ctx.query;

  // Filter pets based on query parameters
  let filteredPets = [...pets];

  // Filter by availability
  if (available !== undefined) {
    const isAvailable = available === Boolean(available);
    filteredPets = filteredPets.filter(pet => pet.available === isAvailable);
  }

  // Filter by species
  if (species) {
    filteredPets = filteredPets.filter(pet =>
      pet.species.toLowerCase() === species.toLowerCase()
    );
  }

  // Filter by age range
  if (minAge !== undefined) {
    filteredPets = filteredPets.filter(pet => pet.age >= minAge);
  }

  if (maxAge !== undefined) {
    filteredPets = filteredPets.filter(pet => pet.age <= maxAge);
  }

  // Search by name, description, or tags
  if (search) {
    const searchLower = search.toLowerCase();
    filteredPets = filteredPets.filter(pet =>
      pet.name.toLowerCase().includes(searchLower) ||
      pet.description.toLowerCase().includes(searchLower) ||
      pet.breed.toLowerCase().includes(searchLower) ||
      (pet.tags && pet.tags.some(tag => tag.toLowerCase().includes(searchLower)))
    );
  }

  // Sort pets
  const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
  const sortDirection = sort.startsWith("-") ? -1 : 1;

  filteredPets.sort((a: any, b: any) => {
    if (a[sortField] < b[sortField]) return -1 * sortDirection;
    if (a[sortField] > b[sortField]) return 1 * sortDirection;
    return 0;
  });

  // Apply pagination
  const paginatedPets = filteredPets.slice(offset, offset + limit);

  // Calculate total pages for pagination
  const totalPages = Math.ceil(filteredPets.length / limit);

  // Create next and previous page URLs if applicable 

  const baseUrl = new URL(ctx.get("host")!).origin + "/pets";
  let nextPage: string | null = null;
  let prevPage: string | null = null;

  if (offset + limit < filteredPets.length) {
    nextPage = `${baseUrl}?limit=${limit}&offset=${offset + limit}`;
    // Add other query parameters
    if (species) nextPage += `&species=${species}`;
    if (minAge !== undefined) nextPage += `&minAge=${minAge}`;
    if (maxAge !== undefined) nextPage += `&maxAge=${maxAge}`;
    if (available !== undefined) nextPage += `&available=${available}`;
    if (sort) nextPage += `&sort=${sort}`;
    if (search) nextPage += `&search=${search}`;
  }

  if (offset > 0) {
    const prevOffset = Math.max(0, offset - limit);
    prevPage = `${baseUrl}?limit=${limit}&offset=${prevOffset}`;
    // Add other query parameters
    if (species) prevPage += `&species=${species}`;
    if (minAge !== undefined) prevPage += `&minAge=${minAge}`;
    if (maxAge !== undefined) prevPage += `&maxAge=${maxAge}`;
    if (available !== undefined) prevPage += `&available=${available}`;
    if (sort) prevPage += `&sort=${sort}`;
    if (search) prevPage += `&search=${search}`;
  }

  ctx.send({
    status: "success",
    count: paginatedPets.length,
    total: filteredPets.length,
    totalPages,
    currentPage: Math.floor(offset / limit) + 1,
    pagination: {
      next: nextPage,
      prev: prevPage
    },
    pets: paginatedPets
  });
};

GET_pets.info = "Retrieves a list of pets with filtering and pagination options";

/**
 * Get pet details by ID
 * @route GET /petBy/:id
 * @access Public
 */
export const GET_petBy$id: JetFunc<{
  params: { id: string };
  query: { includeReviews?: boolean };
}> = async function (ctx) {
  const petId = ctx.params.id;
  const includeReviews = ctx.query.includeReviews === true || ctx.query.includeReviews === Boolean("true");

  // Find pet by id
  const pet = pets.find((p) => p.id === petId);

  if (!pet) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Pet not found"
    });
    return;
  }

  // Include reviews if requested
  let petData: any = { ...pet };

  if (includeReviews) {
    const petReviews = reviews.filter(review => review.petId === petId);

    // Calculate average rating
    const totalRating = petReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = petReviews.length > 0 ? totalRating / petReviews.length : 0;

    petData = {
      ...petData,
      reviews: petReviews,
      reviewStats: {
        count: petReviews.length,
        averageRating: averageRating
      }
    };
  }

  ctx.send({
    status: "success",
    pet: petData
  });
};

GET_petBy$id.info = "Retrieve detailed information about a specific pet by ID";

/**
 * Add a new pet to the inventory
 * @route POST /pets
 * @access Authenticated (Admin only)
 */
export const POST_pets: JetFunc<{
  body: PetType;
}, [AuthPluginType]> = async function (ctx) {
  // Check if user is an admin
  if (!ctx.plugins.isAdmin(ctx)) {
    ctx.code = 403;
    ctx.send({
      status: "error",
      message: "Only administrators can add new pets"
    });
    return;
  }

  await ctx.parse();
  const petData = ctx.validate(ctx.body);

  // Generate unique ID and metadata
  const newPet = {
    ...petData,
    id: `pet-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    available: petData.available !== undefined ? petData.available : true
  };

  // Add pet to database
  pets.push(newPet);

  // Log pet creation
  // Log pet creation
  ctx.plugins?.["logger"]?.info({
    action: "create_pet",
    petId: newPet.id,
    adminId: ctx.app["user"]?.id || "unknown"
  });

  ctx.code = 201; // Created
  ctx.send({
    status: "success",
    message: "Pet added successfully",
    pet: newPet
  });
};

POST_pets.body = {
  name: {
    type: "string",
    required: true,
    err: "Pet name is required"
  },
  species: {
    type: "string",
    required: true,
    err: "Pet species is required"
  },
  breed: {
    type: "string",
    required: true,
    err: "Pet breed is required"
  },
  age: {
    type: "number",
    required: true,
    err: "Pet age is required",
    inputType: "number"
  },
  gender: {
    type: "string",
    required: true,
    err: "Pet gender is required"
  },
  color: {
    type: "string",
    required: true,
    err: "Pet color is required"
  },
  description: {
    type: "string",
    required: true,
    err: "Pet description is required"
  },
  price: {
    type: "number",
    required: true,
    err: "Pet price is required",
    inputType: "number"
  },
  available: {
    type: "boolean",
    required: false
  },
  image: {
    type: "string",
    required: false
  },
  tags: {
    type: "array",
    arrayType: "string",
    required: false
  },
  health: {
    type: "object",
    required: false,
    objectSchema: {
      vaccinated: { type: "boolean" },
      neutered: { type: "boolean" },
      medicalHistory: { type: "array", arrayType: "string" }
    }
  },

};

POST_pets.info = "Add a new pet to the inventory (admin only)";

/**
 * Update an existing pet
 * @route PUT /petBy/:id
 * @access Authenticated (Admin only)
 */
export const PUT_petBy$id: JetFunc<{
  params: { id: string };
  body: Partial<PetType>;
}, [AuthPluginType]> = async function (ctx) {
  // Check if user is an admin
  if (!ctx.plugins.isAdmin(ctx)) {
    ctx.code = 403;
    ctx.send({
      status: "error",
      message: "Only administrators can update pets"
    });
    return;
  }

  const petId = ctx.params.id;
  await ctx.parse();
  const updatedPetData = ctx.validate(ctx.body);

  // Find pet by ID
  const index = pets.findIndex((p) => p.id === petId);

  if (index === -1) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Pet not found"
    });
    return;
  }

  // Update the pet with new data while preserving the ID and creation date
  const updatedPet = {
    ...pets[index],
    ...updatedPetData,
    id: petId, // Ensure ID doesn't change
    createdAt: pets[index].createdAt, // Preserve original creation date
    updatedAt: new Date().toISOString() // Update the modification timestamp
  };

  // Save updated pet
  pets[index] = updatedPet;

  // Log pet update
  // Log pet update
  ctx.plugins?.["logger"]?.info({
    action: "update_pet",
    petId: updatedPet.id,
    adminId: ctx.app["user"]?.id || "unknown",
    changes: Object.keys(updatedPetData).join(", ")
  });

  ctx.send({
    status: "success",
    message: "Pet updated successfully",
    pet: updatedPet
  });
};

PUT_petBy$id.body = {
  name: { type: "string", required: false },
  species: { type: "string", required: false },
  breed: { type: "string", required: false },
  age: { type: "number", required: false, inputType: "number" },
  gender: { type: "string", required: false },
  color: { type: "string", required: false },
  description: { type: "string", required: false },
  price: { type: "number", required: false, inputType: "number" },
  available: { type: "boolean", required: false },
  image: { type: "string", required: false },
  tags: { type: "array", arrayType: "string", required: false },
  health: {
    type: "object",
    required: false,
    objectSchema: {
      vaccinated: { type: "boolean" },
      neutered: { type: "boolean" },
      medicalHistory: { type: "array", arrayType: "string" }
    }
  }
};

PUT_petBy$id.info = "Update an existing pet's information (admin only)";

/**
 * Delete a pet from the inventory
 * @route DELETE /petBy/:id
 * @access Authenticated (Admin only)
 */
export const DELETE_petBy$id: JetFunc<{
  params: { id: string }
}, [AuthPluginType]> = function (ctx) {
  // Check if user is an admin
  if (!ctx.plugins.isAdmin(ctx)) {
    ctx.code = 403;
    ctx.send({
      status: "error",
      message: "Only administrators can delete pets"
    });
    return;
  }

  const petId = ctx.params.id;

  // Find pet by ID
  const index = pets.findIndex((p) => p.id === petId);

  if (index === -1) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Pet not found"
    });
    return;
  }

  // Remove pet from database
  const deletedPet = pets.splice(index, 1)[0];

  // Remove associated reviews
  const reviewsToRemove = reviews.filter(review => review.petId === petId);
  reviewsToRemove.forEach(review => {
    const reviewIndex = reviews.findIndex(r => r.id === review.id);
    if (reviewIndex !== -1) {
      reviews.splice(reviewIndex, 1);
    }
  });

  // Log pet deletion
  // Log pet deletion
  ctx.plugins?.["logger"]?.info({
    action: "delete_pet",
    petId: deletedPet.id,
    adminId: ctx.app["user"]?.id || "unknown"
  });

  ctx.send({
    status: "success",
    message: "Pet deleted successfully",
    pet: deletedPet
  });
};

DELETE_petBy$id.info = "Remove a pet from the inventory (admin only)";

/**
 * Advanced search for pets
 * @route GET /pets/search
 * @access Public
 */
export const GET_pets_search$$: JetFunc<{
  query: {
    name?: string;
    species?: string;
    breed?: string;
    minPrice?: number;
    maxPrice?: number;
    tags?: string;
  }
}> = async function (ctx) {
  // Validate query parameters
  ctx.validate?.(ctx.query);

  const {
    name,
    species,
    breed,
    minPrice,
    maxPrice,
    tags
  } = ctx.query;

  // Create filters based on provided parameters
  let filteredPets = [...pets];

  if (name) {
    const searchName = name.toLowerCase();
    filteredPets = filteredPets.filter(pet =>
      pet.name.toLowerCase().includes(searchName)
    );
  }

  if (species) {
    const searchSpecies = species.toLowerCase();
    filteredPets = filteredPets.filter(pet =>
      pet.species.toLowerCase() === searchSpecies
    );
  }

  if (breed) {
    const searchBreed = breed.toLowerCase();
    filteredPets = filteredPets.filter(pet =>
      pet.breed.toLowerCase().includes(searchBreed)
    );
  }

  if (minPrice !== undefined) {
    if (minPrice !== undefined) {
      filteredPets = filteredPets.filter(pet => pet.price >= minPrice);
    }

    if (maxPrice !== undefined) {
      filteredPets = filteredPets.filter(pet => pet.price <= maxPrice);
    }

    if (tags) {
      const tagList = tags.split(',').map(tag => tag.trim().toLowerCase());
      filteredPets = filteredPets.filter(pet =>
        pet.tags && tagList.some(tag =>
          pet.tags?.map(t => t.toLowerCase()).includes(tag)
        )
      );
    }

    // Get pet reviews for average ratings
    const petsWithRatings = filteredPets.map(pet => {
      const petReviews = reviews.filter(review => review.petId === pet.id);
      const totalRating = petReviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = petReviews.length > 0 ? totalRating / petReviews.length : 0;

      return {
        ...pet,
        reviewStats: {
          count: petReviews.length,
          averageRating
        }
      };
    });

    ctx.send({
      status: "success",
      count: petsWithRatings.length,
      pets: petsWithRatings
    });
  };
}

GET_pets_search$$.info = "Advanced search for pets by various criteria";

// =============================================================================
// PET IMAGE MANAGEMENT
// =============================================================================

/**
 * Upload a pet's image
 * @route POST /petImage/:id
 * @access Authenticated (Admin only)
 */

export const POST_petImage$id: JetFunc<{
  params: { id: string };
}, [AuthPluginType]> = async function (ctx) {
  // Check if user is an admin
  if (!ctx.plugins.isAdmin(ctx)) {
    ctx.code = 403;
    ctx.send({
      status: "error",
      message: "Only administrators can upload pet images"
    });
    return;
  }

  const petId = ctx.params.id;

  // Find pet by ID
  const index = pets.findIndex((p) => p.id === petId);

  if (index === -1) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Pet not found"
    });
    return;
  }

  try {
    // Parse form data
    const formData = await ctx.plugins.formData(ctx);
    const image = formData.image;

    if (!image) {
      ctx.code = 400;
      ctx.send({
        status: "error",
        message: "No image file provided"
      });
      return;
    }

    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(image.mimetype)) {
      ctx.code = 400;
      ctx.send({
        status: "error",
        message: "Invalid image format. Only JPEG, PNG and WebP are supported."
      });
      return;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${petId}-${timestamp}${image.extension}`;
    const imageUrl = `/assets/images/${filename}`;

    // Save image to disk (in production, consider using a CDN or object storage)
    await image.saveTo(`./public/images/${filename}`);

    // Update pet with new image URL
    pets[index].image = imageUrl;
    pets[index].updatedAt = new Date().toISOString();

    // Log image upload
    // Log image upload
    ctx.plugins?.["logger"]?.info({
      action: "upload_pet_image",
      petId,
      imageUrl,
      adminId: ctx.app["user"]?.id || "unknown"
    });

    ctx.send({
      status: "success",
      message: "Image uploaded successfully",
      imageUrl,
      pet: pets[index]
    });
  } catch (error: any) {
    ctx.plugins?.["logger"]?.error({
      action: "upload_pet_image_error",
      petId,
      error: error.message
    });

    ctx.code = 500;
    ctx.send({
      status: "error",
      message: "Failed to process image upload"
    });
  }
};

POST_petImage$id.info = "Upload an image for a specific pet (admin only)";

/**
 * Get all pet images
 * @route GET /petBy/:id/gallery
 * @access Public
 */
export const GET_petBy$id_gallery: JetFunc<{
  params: { id: string };
}> = function (ctx) {
  const petId = ctx.params.id;

  // Find pet by ID
  const pet = pets.find(p => p.id === petId);

  if (!pet) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Pet not found"
    });
    return;
  }

  // In a real application, you would fetch all images for the pet
  // For this example, we'll just return the main image
  const gallery = pet.image ? [pet.image] : [];

  ctx.send({
    status: "success",
    petId,
    petName: pet.name,
    gallery
  });
};

GET_petBy$id_gallery.info = "Get all images for a specific pet";

// =============================================================================
// REVIEWS MANAGEMENT
// =============================================================================

/**
 * Get all reviews for a pet
 * @route GET /petBy/:id/reviews
 * @access Public
 */
export const GET_petBy$id_reviews: JetFunc<{
  params: { id: string };
  query: { sort?: string };
}> = function (ctx) {
  const petId = ctx.params.id;
  const sort = ctx.query.sort || "-createdAt"; // Default sort by newest

  // Find pet by ID
  const pet = pets.find(p => p.id === petId);

  if (!pet) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Pet not found"
    });
    return;
  }

  // Get reviews for this pet
  let petReviews = reviews.filter(review => review.petId === petId);

  // Sort reviews
  const sortField = sort.startsWith("-") ? sort.substring(1) : sort;
  const sortDirection = sort.startsWith("-") ? -1 : 1;

  petReviews.sort((a: any, b: any) => {
    if (a[sortField] < b[sortField]) return -1 * sortDirection;
    if (a[sortField] > b[sortField]) return 1 * sortDirection;
    return 0;
  });

  // Calculate average rating
  const totalRating = petReviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = petReviews.length > 0 ? totalRating / petReviews.length : 0;

  ctx.send({
    status: "success",
    petId,
    petName: pet.name,
    stats: {
      count: petReviews.length,
      averageRating
    },
    reviews: petReviews
  });
};

GET_petBy$id_reviews.info = "Get all reviews for a specific pet";

/**
 * Add a review for a pet
 * @route POST /petBy/:id/reviews
 * @access Authenticated
 */
export const POST_petBy$id_reviews: JetFunc<{
  params: { id: string };
  body: {
    rating: number;
    comment: string;
  };
}, [AuthPluginType]> = async function (ctx) {
  // Verify user is authenticated
  const auth = ctx.plugins.verifyAuth(ctx);
  if (!auth.authenticated) {
    ctx.code = 401;
    ctx.send({
      status: "error",
      message: "Authentication required to post reviews"
    });
    return;
  }

  const petId = ctx.params.id;

  // Find pet by ID
  const pet = pets.find(p => p.id === petId);

  if (!pet) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Pet not found"
    });
    return;
  }

  await ctx.parse();
  const { rating, comment } = ctx.validate(ctx.body);

  // Create new review
  const newReview = {
    id: `review-${Date.now()}`,
    petId,
    userId: auth.user.id,
    username: auth.user.username,
    rating,
    comment,
    createdAt: new Date().toISOString()
  };

  // Add review to database
  reviews.push(newReview);

  // Log review creation
  // Log review creation
  ctx.plugins?.["logger"]?.info({
    action: "create_review",
    reviewId: newReview.id,
    petId,
    userId: auth.user.id
  });

  ctx.code = 201; // Created
  ctx.send({
    status: "success",
    message: "Review added successfully",
    review: newReview
  });
};

POST_petBy$id_reviews.body = {
  rating: {
    type: "number",
    required: true,
    err: "Rating is required (1-5)",
    inputType: "number"
  },
  comment: {
    type: "string",
    required: true,
    err: "Review comment is required"
  }
};

POST_petBy$id_reviews.info = "Add a review for a specific pet";

/**
 * Delete a review
 * @route DELETE /reviews/:reviewId
 * @access Authenticated (Review owner or Admin)
 */
export const DELETE_reviews$reviewId: JetFunc<{
  params: { reviewId: string };
}, [AuthPluginType]> = function (ctx) {
  // Verify user is authenticated
  const auth = ctx.plugins.verifyAuth(ctx);
  if (!auth.authenticated) {
    ctx.code = 401;
    ctx.send({
      status: "error",
      message: "Authentication required to delete reviews"
    });
    return;
  }

  const reviewId = ctx.params.reviewId;

  // Find review by ID
  const reviewIndex = reviews.findIndex(r => r.id === reviewId);

  if (reviewIndex === -1) {
    ctx.code = 404;
    ctx.send({
      status: "error",
      message: "Review not found"
    });
    return;
  }

  const review = reviews[reviewIndex];

  // Check if user is the review owner or an admin
  const isOwner = review.userId === auth.user.id;
  const isAdmin = auth.user.role === "admin";

  if (!isOwner && !isAdmin) {
    ctx.code = 403;
    ctx.send({
      status: "error",
      message: "You don't have permission to delete this review"
    });
    return;
  }

  // Remove review
  const deletedReview = reviews.splice(reviewIndex, 1)[0];

  // Log review deletion
  // Log review deletion
  ctx.plugins?.["logger"]?.info({
    action: "delete_review",
    reviewId,
    petId: deletedReview.petId,
    userId: auth.user.id
  });

  ctx.send({
    status: "success",
    message: "Review deleted successfully",
    review: deletedReview
  });
};

DELETE_reviews$reviewId.info = "Delete a review (admin or review owner only)";

// =============================================================================
// STATISTICS AND REPORTS
// =============================================================================

/**
 * Get shop statistics
 * @route GET /stats
 * @access Admin only
 */
export const GET_stats: JetFunc<{}, [AuthPluginType]> = function (ctx) {
  // Check if user is an admin
  if (!ctx.plugins.isAdmin(ctx)) {
    ctx.code = 403;
    ctx.send({
      status: "error",
      message: "Only administrators can access statistics"
    });
    return;
  }

  // Calculate statistics
  const totalPets = pets.length;
  const availablePets = pets.filter(pet => pet.available).length;
  const totalSpecies = new Set(pets.map(pet => pet.species)).size;

  // Count pets by species
  const speciesCount: Record<string, number> = {};
  pets.forEach(pet => {
    speciesCount[pet.species] = (speciesCount[pet.species] || 0) + 1;
  });

  // Calculate average price
  const totalPrice = pets.reduce((sum, pet) => sum + pet.price, 0);
  const averagePrice = totalPets > 0 ? totalPrice / totalPets : 0;

  // Calculate review statistics
  const totalReviews = reviews.length;
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

  ctx.send({
    status: "success",
    stats: {
      pets: {
        total: totalPets,
        available: availablePets,
        unavailable: totalPets - availablePets,
        speciesCount,
        totalSpecies,
        averagePrice
      },
      reviews: {
        total: totalReviews,
        averageRating
      }
    },
    generatedAt: new Date().toISOString()
  });
};

GET_stats.info = "Get shop statistics (admin only)";

// =============================================================================
// REAL-TIME COMMUNICATIONS
// =============================================================================

/**
 * WebSocket for real-time inventory updates and notifications
 * @route WS /live
 * @access Public
 */
export const WS_live: JetFunc = (ctx) => {
  const conn = ctx.connection!;

  if (!conn) {
    ctx.code = 500;
    ctx.send({
      status: "error",
      message: "WebSocket connection failed"
    });
    return;
  }

  try {
    // Handle new connections
    conn.addEventListener("open", (socket) => {
      console.log("New client connected to live updates");

      // Send welcome message with current stats
      const availablePets = pets.filter(pet => pet.available).length;
      socket.send(JSON.stringify({
        type: "welcome",
        message: "Connected to PetShop live updates",
        stats: {
          totalPets: pets.length,
          availablePets
        },
        timestamp: new Date().toISOString()
      }));
    });

    // Handle incoming messages
    conn.addEventListener("message", (socket, event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle subscription requests
        if (message.type === "subscribe") {
          if (message.topic === "inventory") {
            socket.send(JSON.stringify({
              type: "subscribed",
              topic: "inventory",
              message: "Subscribed to inventory updates"
            }));
          } else if (message.topic === "reviews") {
            socket.send(JSON.stringify({
              type: "subscribed",
              topic: "reviews",
              message: "Subscribed to review updates"
            }));
          } else {
            socket.send(JSON.stringify({
              type: "error",
              message: "Unknown subscription topic"
            }));
          }
        } else if (message.type === "ping") {
          // Handle ping-pong for connection health checks
          socket.send(JSON.stringify({
            type: "pong",
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        // Handle invalid JSON
        socket.send(JSON.stringify({
          type: "error",
          message: "Invalid message format"
        }));
      }
    });

    // Handle connection close
    conn.addEventListener("close", () => {
      console.log("Client disconnected from live updates");
    });

  } catch (error) {
    console.error("WebSocket error:", error);
  }
};

WS_live.info = "WebSocket for real-time inventory updates and notifications";

// =============================================================================
// FILE UPLOADS AND FORMS
// =============================================================================

/**
 * General file upload handler with metadata
 * @route POST /upload
 * @access Authenticated (Admin only)
 */
export const POST_upload: JetFunc<{}, [AuthPluginType, jetloggerType]> = async (ctx) => {
  // Check if user is an admin
  if (!ctx.plugins.isAdmin(ctx)) {
    ctx.code = 403;
    ctx.send({
      status: "error",
      message: "Only administrators can upload files"
    });
    return;
  }

  try {
    // Parse form data
    const form = await ctx.parse();
    console.log(form);
    const results: Record<string, any> = {};

    // Process each file in the form
    for (const fieldName in form) {
      const field = form[fieldName];

      // Check if field is a file
      if (field && field.filename) {
        // Generate unique filename to prevent overwrites
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${field.filename}`;

        // Save file to appropriate directory based on mimetype
        let saveDir = "./public/uploads";
        let publicPath = "/assets/uploads";

        if (field.mimetype.startsWith("image/")) {
          saveDir = "./public/images";
          publicPath = "/assets/images";
        } else if (field.mimetype.startsWith("video/")) {
          saveDir = "./public/videos";
          publicPath = "/assets/videos";
        } else if (field.mimetype.startsWith("audio/")) {
          saveDir = "./public/audio";
          publicPath = "/assets/audio";
        }

        // Save the file
        await field.saveTo(`${saveDir}/${uniqueFilename}`);

        // Store result information
        results[fieldName] = {
          filename: field.filename,
          savedAs: uniqueFilename,
          size: field.size,
          mimetype: field.mimetype,
          url: `${publicPath}/${uniqueFilename}`
        };
      } else {
        // Store text field values
        results[fieldName] = field;
      }
    }

    // Log upload activity
    // Log upload activity
    ctx.plugins?.["logger"]?.info({
      action: "file_upload",
      userId: ctx.app["user"]?.id || "unknown",
      files: Object.keys(results).filter(key => results[key].url)
    });

    ctx.send({
      status: "success",
      message: "Files uploaded successfully",
      data: results
    });

  } catch (error: any) {
    ctx.plugins?.error(ctx,{
      action: "file_upload_error",
      error: error.message
    });

    ctx.code = 500;
    ctx.send({
      status: "error",
      message: "Failed to process file upload"
    });
  }
};

POST_upload.body = {
  image: { type: "file", inputType: "file", required: false },
  document: { type: "file", inputType: "file", required: false },
  title: { type: "string", required: false },
  description: { type: "string", required: false },
  tags: { type: "string", required: false }
};

POST_upload.info = "Upload files with metadata (admin only)";

// =============================================================================
// ERROR HANDLING AND TESTING
// =============================================================================

/**
 * Intentional error route for testing error handling
 * @route GET /error
 * @access Public (for testing only)
 */
export const GET_error: JetFunc = function (_ctx) {
  throw new Error("This is an intentional error for testing error handling");
};

GET_error.info = "Route that intentionally throws an error (for testing)";

/**
 * Health check endpoint
 * @route GET /health
 * @access Public
 */
export const GET_health: JetFunc = function (ctx) {
  // Simple health check with basic system stats
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  ctx.send({
    status: "healthy",
    uptime: {
      seconds: uptime,
      formatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    },
    timestamp: new Date().toISOString()
  });
};

GET_health.info = "API health check endpoint";
interface ApiInfo {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: Array<{
    path: string;
    method: string;
    description: string;
    parameters?: Record<string, string | undefined>;
  }>;
}
// =============================================================================
// EXPORT DOCUMENTATION
// =============================================================================

/**
 * Export API documentation in various formats
 * @route GET /export/docs/:format
 * @access Public
 */
export const GET_export_docs$format: JetFunc<{
  params: { format: string };
}> = function (ctx) {
  const format = ctx.params.format.toLowerCase();

  // Basic API information
  const apiInfo: ApiInfo = {
    name: "PetShop API",
    version: "1.0.0",
    description: "A comprehensive API for managing pet shop inventory",
    baseUrl: new URL(ctx.get("host")!).origin,
    endpoints: []
  };

  // Get all routes and their information
  // In a real application, you would implement introspection to gather all routes

  // Example endpoints
  const endpoints = [
    {
      path: "/pets",
      method: "GET",
      description: "List all pets with filtering and pagination",
      parameters: {
        limit: "Number of pets to return",
        offset: "Number of pets to skip",
        species: "Filter by species",
        available: "Filter by availability"
      }
    },
    {
      path: "/petBy/:id",
      method: "GET",
      description: "Get details for a specific pet",
      parameters: {
        id: "Pet ID (path parameter)",
        includeReviews: "Include pet reviews in response"
      }
    },
  ];

  apiInfo.endpoints = endpoints;

  // Format the output based on requested format
  if (format === "json") {
    ctx.set("Content-Type", "application/json");
    ctx.send(apiInfo);
  } else if (format === "yaml" || format === "yml") {
    // Simple YAML conversion for demonstration
    let yaml = `name: ${apiInfo.name}\n`;
    yaml += `version: ${apiInfo.version}\n`;
    yaml += `description: ${apiInfo.description}\n`;
    yaml += `baseUrl: ${apiInfo.baseUrl}\n`;
    yaml += `endpoints:\n`;

    apiInfo.endpoints.forEach((endpoint: any) => {
      yaml += `  - path: ${endpoint.path}\n`;
      yaml += `    method: ${endpoint.method}\n`;
      yaml += `    description: ${endpoint.description}\n`;
      if (endpoint.parameters) {
        yaml += `    parameters:\n`;
        for (const [param, desc] of Object.entries(endpoint.parameters)) {
          yaml += `      ${param}: ${desc}\n`;
        }
      }
    });

    ctx.set("Content-Type", "text/yaml");
    ctx.send(yaml);
  } else if (format === "markdown" || format === "md") {
    // Generate markdown documentation
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
        markdown += `\n`;
      }
    });

    ctx.set("Content-Type", "text/markdown");
    ctx.send(markdown);
  } else {
    ctx.code = 400;
    ctx.send({
      status: "error",
      message: `Unsupported format: ${format}. Supported formats are json, yaml, and markdown.`
    });
  }
};

GET_export_docs$format.info = "Export API documentation in different formats (json, yaml, markdown)";



