// This file is deprecated and unused in favor of direct Supabase calls in store.tsx.
// Keeping it as a reference structure but disabling functionality to prevent errors.

import { Restaurant, Product } from '../types';

// const API_URL = 'http://localhost:5000/api';

export const api = {
  // Methods commented out to prevent "Failed to fetch" errors if accidentally used.
  getRestaurants: async (): Promise<Restaurant[]> => { return []; },
  addRestaurant: async (restaurant: Restaurant) => { },
  updateRestaurant: async (id: string, data: Partial<Restaurant>) => { },
  deleteRestaurant: async (id: string) => { },
  addProduct: async (restaurantId: string, product: Product) => { }
};