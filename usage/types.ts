/**
 * Pet data model (Based on app.jet.ts typedef comment)
 */
export type PetType = {
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
 * User review data model (Based on app.jet.ts typedef comment)
 */
export type ReviewType = {
  id: string;
  petId: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
};
