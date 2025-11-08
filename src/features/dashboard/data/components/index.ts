/**
 * Shared components for data sections
 *
 * These components follow DRY, KISS, and YAGNI principles by:
 * - Centralizing common responsive patterns
 * - Reducing code duplication
 * - Maintaining consistency across Materials, Recipes, Products, and Suppliers sections
 */

export { SectionHeader, ActionButtons, ActionButton } from "./section-header";
export { SectionCard } from "./section-card";
export { SectionLoadingState } from "./section-loading-state";
export { FilterSection, type FilterField, type FilterOption } from "./filter-section";
export { BaseItemCard, ItemCardGrid } from "./base-item-card";

