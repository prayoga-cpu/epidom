/**
 * Mock data for stores/locations
 * TODO: Replace with real API calls to /api/stores
 */

export interface Store {
  id: string;
  name: string;
  city: string;
  image: string;
}

export const MOCK_STORES: Store[] = [
  {
    id: "1",
    name: "Artisan Bakery Paris Centre",
    city: "Paris",
    image: "/images/pantry-shelf.jpg",
  },
  {
    id: "2",
    name: "Épicerie Fine Lyon",
    city: "Lyon",
    image: "/images/pantry-shelf.jpg",
  },
  {
    id: "3",
    name: "Pâtisserie Marseille",
    city: "Marseille",
    image: "/images/pantry-shelf.jpg",
  },
  {
    id: "4",
    name: "Boulangerie Traditionnelle Toulouse",
    city: "Toulouse",
    image: "/images/pantry-shelf.jpg",
  },
  {
    id: "5",
    name: "Chocolaterie Nice",
    city: "Nice",
    image: "/images/pantry-shelf.jpg",
  },
  {
    id: "6",
    name: "Fromagerie Bordeaux",
    city: "Bordeaux",
    image: "/images/pantry-shelf.jpg",
  },
];
