// src/routes/reviews.ts

import { type JetRoute, use } from "../../dist/index.js";
// Import AuthPluginType if authentication checks are done within route handlers
import { type AuthPluginType } from "../plugins/auth.ts";
// Import data models and in-memory data arrays
import { pets, reviews } from "../data/models.ts";
import { type ReviewType } from "../types.ts"; // Import ReviewType

// --- Reviews Management Routes ---

/**
 * Get all reviews for a pet
 * @route GET /petBy/:id/reviews
 * @access Public
 * Demonstrates: Dynamic GET route ($id), path parameter, filtering related data, sorting, calculating aggregates (average rating).
 */
export const GET_petBy$id_reviews: JetRoute<{
  params: { id: string }; // Pet ID from path
  query: { sort?: string }; // Optional sort query parameter
}> = function (ctx) {
  const petId = ctx.params.id; // Access pet ID from path.
  const sort = ctx.parseQuery().sort || "-createdAt"; // Access sort query param, default to newest first.

  // Find the pet to ensure it exists.
  const pet = pets.find((p) => p.id === petId);

  if (!pet) {
    ctx.code = 404; // Not Found
    ctx.send({
      status: "error",
      message: `Pet with ID ${petId} not found.`,
    });
    return;
  }

  // Filter reviews to get only those for the specified pet.
  let petReviews = reviews.filter((review) => review.petId === petId);

  // Sort the filtered reviews based on the sort query parameter.
  const sortField = sort.startsWith("-") ? sort.substring(1) : sort; // Get field name (remove leading '-')
  const sortDirection = sort.startsWith("-") ? -1 : 1; // Determine sort direction (1 for asc, -1 for desc)

  // Sort the array. Using `any` for simplicity due to dynamic sortField access.
  petReviews.sort((a: any, b: any) => {
    const valueA = a[sortField];
    const valueB = b[sortField];

    if (valueA < valueB) return -1 * sortDirection;
    if (valueA > valueB) return 1 * sortDirection;
    return 0; // Values are equal
  });

  // Calculate aggregate statistics for the reviews (e.g., average rating).
  const totalRating = petReviews.reduce(
    (sum, review) => sum + review.rating,
    0,
  ); // Sum of all ratings
  const averageRating = petReviews.length > 0
    ? totalRating / petReviews.length
    : 0; // Calculate average, handle division by zero.

  // Send the response with the filtered, sorted reviews and statistics.
  ctx.send({
    status: "success",
    petId: petId,
    petName: pet.name,
    stats: { // Include review statistics
      count: petReviews.length,
      averageRating: averageRating,
    },
    reviews: petReviews, // Include the list of reviews
  });
};

// Apply .info() for documentation.
use(GET_petBy$id_reviews).title("Get all reviews for a specific pet").query(
  (t) => {
    // Define the expected query parameters and validation rules.
    return {
      // Optional sort parameter, default to '-createdAt' (newest first).
      sort: t.string({
        err: "Sort parameter must be a string",
      }).default("-createdAt"),
    };
  },
);

/**
 * Add a review for a pet
 * @route POST /petBy/:id/reviews
 * @access Authenticated (Based on sample's middleware check)
 * Demonstrates: POST request, dynamic routing ($id), body parsing, input validation (use().body()), data insertion.
 */
export const POST_petBy$id_reviews: JetRoute<{
  params: { id: string }; // Pet ID from path
  body: { // Expected request body structure
    rating: number;
    comment: string;
  };
}, [AuthPluginType]> = async function (ctx) {
  // Check if user is authenticated (access user and authenticated status from ctx.state/plugins)
  // The global middleware sets ctx.state.user if authenticated.
  const user = ctx.state["user"];
  if (!user) {
    ctx.code = 401; // Unauthorized
    ctx.send({
      status: "error",
      message: "Authentication required to post reviews",
    });
    return;
  }

  const petId = ctx.params.id; // Access pet ID from path.

  // Find the pet to ensure it exists before adding a review.
  const pet = pets.find((p) => p.id === petId);

  if (!pet) {
    ctx.code = 404; // Not Found
    ctx.send({
      status: "error",
      message: `Pet with ID ${petId} not found.`,
    });
    return;
  }

  // Parse and validate the request body. Jetpath handles this via use().body().
  const { rating, comment } = await ctx.parse(); // Ensure body is parsed

  // Create a new review object with a unique ID and current timestamp.
  const newReview: ReviewType = {
    id: `review-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`, // Generate unique ID
    petId: petId, // Link to the pet
    userId: user.id, // Link to the authenticated user's ID
    username: user.username, // Store the reviewer's username
    rating: rating, // Rating from the request body
    comment: comment, // Comment from the request body
    createdAt: new Date().toISOString(), // Set creation timestamp
  };

  // Add the new review to the in-memory database array.
  reviews.push(newReview);

  // Log the review creation action.
  // Log the review creation action.
  ctx.plugins?.["info"]({
    action: "create_review",
    reviewId: newReview.id,
    petId: newReview.petId,
    userId: newReview.userId,
    message: `User ${newReview.username} added review for pet ${pet.name}`,
  });

  // Send a 201 Created response with the newly created review details.
  ctx.code = 201; // Created status code.
  ctx.send({
    status: "success",
    message: "Review added successfully",
    review: newReview,
  });
};

// Apply body validation and .info() for documentation using use() chained after the function definition.
use(POST_petBy$id_reviews).body((t) => {
  // Define the expected request body structure and validation rules.
  return {
    // Validate rating as a required number.
    rating: t.number({
      err: "Rating is required (1-5)",
    }).required(),
    // Validate comment as a required string.
    comment: t.string({ err: "Review comment is required" }).required(),
  };
}).title("Add a review for a specific pet (authenticated users only)");

/**
 * Delete a review
 * @route DELETE /reviews/:reviewId
 * @access Authenticated (Review owner or Admin - Based on sample logic)
 * Demonstrates: DELETE request, dynamic routing ($reviewId), path parameter, data deletion, authorization check (owner or admin).
 */
export const DELETE_reviews$reviewId: JetRoute<{
  params: { reviewId: string }; // Review ID from path
}, [AuthPluginType]> = function (ctx) {
  // Check if user is authenticated.
  const user = ctx.state["user"];
  if (!user) {
    ctx.code = 401; // Unauthorized
    ctx.send({
      status: "error",
      message: "Authentication required to delete reviews",
    });
    return;
  }

  const reviewId = ctx.params.reviewId; // Access review ID from path.

  // Find index of the review by ID.
  const reviewIndex = reviews.findIndex((r) => r.id === reviewId);

  // If review is not found, set 404 status and send error response.
  if (reviewIndex === -1) {
    ctx.code = 404; // Not Found
    ctx.send({
      status: "error",
      message: `Review with ID ${reviewId} not found.`,
    });
    return;
  }

  const review = reviews[reviewIndex]; // Get the review object.

  // Authorization Check: Check if the authenticated user is the owner of the review OR an admin.
  const isOwner = review.userId === user.id;
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    ctx.code = 403; // Forbidden
    ctx.send({
      status: "error",
      message: "You don't have permission to delete this review",
    });
    return;
  }

  // Remove the review from the in-memory array using splice().
  const deletedReview = reviews.splice(reviewIndex, 1)[0];

  // Log the deletion action.
  ctx.plugins?.["info"]({
    action: "delete_review",
    reviewId: deletedReview.id,
    petId: deletedReview.petId,
    userId: user.id,
    message: `User ${user.username} deleted review ${deletedReview.id}`,
  });

  // Send a success response with details of the deleted review.
  ctx.send({
    status: "success",
    message: `Review with ID ${reviewId} deleted successfully`,
    review: deletedReview,
  });
};

// Apply .info() for documentation.
use(DELETE_reviews$reviewId).title(
  "Delete a review (admin or review owner only)",
);

// Export route handlers so Jetpath can discover and register them based on naming convention.
