/**
 * User Data Transfer Objects (DTOs)
 *
 * These types represent data structures for user-related operations
 * between different layers of the application.
 */

// User DTO (safe to expose to client - no password)
export interface UserDto {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  phone: string | null;
  locale: string;
  timezone: string;
  currency: string;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// User profile with business and subscription
export interface UserProfileDto extends UserDto {
  business: BusinessWithStoresDto | null;
  subscription: SubscriptionDto | null;
}

// Business DTO
export interface BusinessDto {
  id: string;
  userId: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

// Business with stores
export interface BusinessWithStoresDto extends BusinessDto {
  stores: StoreDto[];
}

// Store DTO
export interface StoreDto {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  image: string | null;
  // isActive: boolean; // Removed: Not in DB schema
  createdAt: Date;
  updatedAt: Date;
}

// Subscription DTO
export interface SubscriptionDto {
  id: string;
  userId: string;
  plan: "STARTER" | "PRO" | "ENTERPRISE";
  status: "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE";
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Minimal user info (for references)
export interface UserRefDto {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}
