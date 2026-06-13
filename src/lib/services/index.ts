/**
 * Service Layer
 *
 * Services contain business logic and orchestrate repositories.
 *
 * Benefits:
 * - Separates business logic from data access (SRP)
 * - Makes business rules testable
 * - Enforces consistent business logic across the app
 * - Implements Dependency Inversion Principle
 *
 * Architecture:
 * API Route → Service → Repository → Database
 */

// Auth & User services
export * from "./user.service";

// Business & Store services
export * from "./business.service";
export * from "./subscription.service";
export * from "./stripe-connect.service";
export * from "./storefront.service";

// Domain services
export * from "./material.service";
export * from "./product.service";
export * from "./recipe.service";
export * from "./supplier.service";
export * from "./production-batch.service";

// Utility services
export * from "./email.service";
export * from "./exchange-rate.service";
