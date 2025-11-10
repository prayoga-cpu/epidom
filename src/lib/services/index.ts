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

export * from "./auth.service";
export * from "./user.service";
export * from "./business.service";
export * from "./subscription.service";
export * from "./stripe-connect.service";
