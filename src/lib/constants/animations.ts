/**
 * Animation Constants
 *
 * Centralized animation timing and configuration values
 * for consistent animations across the marketing landing page.
 *
 * @module
 */

/**
 * Animation timing constants in milliseconds
 */
export const ANIMATION_TIMING = {
  /** Delay before mounting animations start */
  MOUNT_DELAY: 100,
  /** Fallback delay to ensure visibility if IntersectionObserver fails */
  VISIBILITY_FALLBACK: 500,
  /** Interval between staggered animation items */
  STAGGER_INTERVAL: 100,
  /** Standard transition duration */
  TRANSITION_DURATION: 1000,
  /** Carousel auto-scroll interval */
  CAROUSEL_INTERVAL: 5000,
  /** Marquee animation duration in seconds */
  MARQUEE_DURATION: 30,
} as const;

/**
 * IntersectionObserver configuration options
 */
export const INTERSECTION_OPTIONS = {
  /** Minimum visibility threshold to trigger animation */
  threshold: 0.1,
  /** Higher threshold for sections that should be more visible */
  thresholdHigh: 0.2,
  /** Root margin for early/late triggering */
  rootMargin: "0px",
} as const;

/**
 * CSS transition delay calculator
 * @param index - Item index in a list
 * @param baseDelay - Base delay before staggering starts
 * @returns CSS transition delay string
 */
export function getStaggerDelay(index: number, baseDelay = 0): string {
  return `${baseDelay + index * ANIMATION_TIMING.STAGGER_INTERVAL}ms`;
}

/**
 * Feature animation delay calculator for feature lists
 * @param sectionIndex - Section/card index
 * @param featureIndex - Feature item index within section
 * @returns CSS transition delay string
 */
export function getFeatureDelay(sectionIndex: number, featureIndex: number): string {
  return `${sectionIndex * 150 + featureIndex * 50}ms`;
}
