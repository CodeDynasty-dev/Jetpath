import { PetType, ReviewType } from "../types"; // Import types

/**
 * In-memory pet database
 * In a production application, this would be replaced with a real database
 * Exported for use in route handlers.
 */
export const pets: PetType[] = [
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
      medicalHistory: ["Regular checkup - 2023-05-01"],
    },
  },
  {
    id: "pet-2",
    name: "Luna",
    species: "Cat",
    breed: "Siamese",
    age: 2,
    gender: "Female",
    color: "Cream with brown points",
    description:
      "Elegant Siamese cat with striking blue eyes and a playful personality",
    image: "/assets/images/luna.jpg",
    price: 350,
    available: true,
    createdAt: "2023-07-10T14:15:00Z",
    updatedAt: "2023-07-10T14:15:00Z",
    tags: ["elegant", "vocal", "playful"],
    health: {
      vaccinated: true,
      neutered: true,
      medicalHistory: ["Regular checkup - 2023-06-15"],
    },
  },
];

/**
 * In-memory reviews database
 * Exported for use in route handlers.
 */
export const reviews: ReviewType[] = [
  {
    id: "review-1",
    petId: "pet-1",
    userId: "2",
    username: "user",
    rating: 5,
    comment: "Max is such a wonderful companion! Highly recommend this breed.",
    createdAt: "2023-08-20T09:45:00Z",
  },
];
