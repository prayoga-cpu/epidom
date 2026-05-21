/**
 * Configuration Module
 *
 * Centralized configuration following the Open/Closed Principle.
 * All application settings should be defined here rather than
 * hardcoded throughout the codebase.
 *
 * Benefits:
 * - Easy to find and modify settings
 * - Type-safe configuration
 * - Environment-aware settings
 * - Single source of truth
 */

export * from "./app.config";
export * from "./navigation.config";
