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
