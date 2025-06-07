export const routes = {
  GET_live: {
    path: "/live",
    method: "get",
    title: "WebSocket endpoint for real-time pet updates.",
  },
  GET_petBy$id_reviews: {
    path: "/petBy/:id/reviews",
    method: "get",
    query: { "sort": "string" },
    title: "Get all reviews for a specific pet",
  },
  GET_: {
    path: "/",
    method: "get",
    title: "Returns API information and status",
  },
  GET_error: {
    path: "/error",
    method: "get",
    title:
      "Route that intentionally throws an error (for testing global error handling)",
  },
  GET_export_docs$format: {
    path: "/export/docs/:format",
    method: "get",
    title:
      "Export API documentation in different formats (json, yaml, markdown)",
  },
  GET_health: {
    path: "/health",
    method: "get",
    title: "API health check endpoint",
  },
  GET_serve$0: {
    path: "/serve/*",
    method: "get",
    title: "Serve files from the file system based on wildcard path parameter.",
  },
  GET_static$0: {
    path: "/static/*",
    method: "get",
    title: "Serve static files for download or in-browser display.",
  },
  GET_stats: {
    path: "/stats",
    method: "get",
    title: "Get shop statistics (admin only)",
  },
  GET_petBy$id: {
    path: "/petBy/:id",
    method: "get",
    title: "Retrieve detailed information about a specific pet by ID",
  },
  GET_petBy$id_gallery: {
    path: "/petBy/:id/gallery",
    method: "get",
    title:
      "Get images for a specific pet (returns main image URL in this sample)",
  },
  GET_pets: {
    path: "/pets",
    method: "get",
    title: "Retrieves a list of pets with filtering and pagination options",
  },
  GET_pets_search: {
    path: "/pets/search",
    method: "get",
    title: "Advanced search for pets by various criteria",
  },
  POST_auth_login: {
    path: "/auth/login",
    method: "post",
    body: { "username": "string", "password": "string" },
    title: "Authenticate a user and receive an access token",
  },
  POST_petBy$id_reviews: {
    path: "/petBy/:id/reviews",
    method: "post",
    body: { "rating": 1, "comment": "string" },
    title: "Add a review for a specific pet (authenticated users only)",
  },
  POST_upload: {
    path: "/upload",
    method: "post",
    body: {
      "image": "file",
      "document": "file",
      "title": "string",
      "description": "string",
      "tags": "string",
    },
    title:
      "Upload files with metadata (admin only) - expects multipart/form-data",
  },
  POST_pets: {
    path: "/pets",
    method: "post",
    body: {
      "name": "string",
      "species": "string",
      "breed": "string",
      "age": 1,
      "gender": "string",
      "color": "string",
      "description": "string",
      "image": "file",
      "price": 1,
      "available": true,
      "tags": [],
      "health": {},
    },
    title: "Add a new pet to the inventory (admin only)",
  },
  POST_recipes$id_image: {
    path: "/recipes/:id/image",
    method: "post",
    body: { "image": "file" },
    title: "Upload an image for a specific pet (admin only)",
  },
  PUT_petBy$id: {
    path: "/petBy/:id",
    method: "put",
    body: {
      "name": "string",
      "species": "string",
      "breed": "string",
      "age": 1,
      "gender": "string",
      "color": "string",
      "description": "string",
      "image": "file",
      "price": 1,
      "available": true,
      "tags": [],
      "health": {},
    },
    title: "Update an existing pet's information (admin only)",
  },
  DELETE_reviews$reviewId: {
    path: "/reviews/:reviewId",
    method: "delete",
    title: "Delete a review (admin or review owner only)",
  },
  DELETE_petBy$id: {
    path: "/petBy/:id",
    method: "delete",
    title: "Remove a pet from the inventory (admin only)",
  },
} as const;
