/**
 * Central export point for all Data Transfer Objects (DTOs)
 *
 * ⚠️ WARNING: These DTOs are currently UNUSED in the codebase
 *
 * They were created for future API versioning but are not yet implemented.
 * See README.md in this directory for details.
 *
 * Current approach: Use Prisma types directly or custom repository types.
 * Example: MaterialWithSuppliers, RecipeWithIngredients, etc.
 *
 * DO NOT USE these DTOs yet - they are premature optimization (YAGNI).
 *
 * Original intent: Represent data structures that move between layers:
 * - Database → Service Layer
 * - Service Layer → API Routes
 * - API Routes → Client
 */

// UNUSED exports (kept for future API versioning implementation)
export * from "./user.dto";
export * from "./inventory.dto";
export * from "./order.dto";
