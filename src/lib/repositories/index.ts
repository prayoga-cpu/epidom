/**
 * Repository Layer
 *
 * Repositories handle all database operations following the
 * Repository Pattern and Dependency Inversion Principle.
 *
 * Benefits:
 * - Abstracts database implementation details
 * - Makes code testable (can mock repositories)
 * - Centralizes data access logic
 * - Follows Single Responsibility Principle
 */

export * from "./base.repository";
export * from "./user.repository";
export * from "./business.repository";
export * from "./store.repository";
export * from "./subscription.repository";
export * from "./material.repository";
export * from "./product.repository";
export * from "./production-batch.repository";
export * from "./recipe.repository";
export * from "./supplier.repository";

