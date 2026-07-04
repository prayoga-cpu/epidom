/**
 * Central export point for all validation schemas
 *
 * This module provides Zod schemas for runtime validation
 * and TypeScript type inference for all API inputs.
 */

// Common schemas
export * from "./common.schemas";

// Authentication schemas
export * from "./auth.schemas";

// Business and store schemas
export * from "./business.schemas";

// Inventory schemas (products, ingredients, recipes, suppliers)
export * from "./inventory.schemas";

// Orders schemas
export * from "./orders.schemas";

// Production batch schemas
export * from "./production.schemas";

// Storefront schemas
export * from "./storefront.schemas";

// Feedback schemas
export * from "./feedback.schemas";

// Re-export Zod for convenience
export { z } from "zod";
