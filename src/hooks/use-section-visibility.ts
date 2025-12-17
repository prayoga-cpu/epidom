/**
 * useSectionVisibility Hook
 *
 * Custom hook for handling section visibility animations with
 * IntersectionObserver and hydration-safe mounting.
 *
 * Features:
 * - Prevents hydration mismatch with mounted state
 * - Uses IntersectionObserver for scroll-triggered animations
 * - Includes fallback timer in case observer fails
 *
 * @module
 */

import { useState, useEffect, useRef, RefObject } from "react";
import { ANIMATION_TIMING, INTERSECTION_OPTIONS } from "@/lib/constants/animations";

interface UseSectionVisibilityOptions {
  /** IntersectionObserver threshold (0-1) */
  threshold?: number;
  /** Fallback delay in ms to ensure visibility */
  fallbackDelay?: number;
}

interface UseSectionVisibilityReturn<T extends HTMLElement> {
  /** Ref to attach to the section element */
  ref: RefObject<T>;
  /** Whether component is mounted (client-side) */
  mounted: boolean;
  /** Whether section should animate in (visible) */
  isVisible: boolean;
}

/**
 * Hook for handling section visibility with hydration safety
 *
 * @example
 * ```tsx
 * function MySection() {
 *   const { ref, mounted, isVisible } = useSectionVisibility<HTMLElement>();
 *
 *   if (!mounted) return <Placeholder />;
 *
 *   return (
 *     <section ref={ref} className={isVisible ? "opacity-100" : "opacity-0"}>
 *       Content
 *     </section>
 *   );
 * }
 * ```
 */
export function useSectionVisibility<T extends HTMLElement>(
  options: UseSectionVisibilityOptions = {}
): UseSectionVisibilityReturn<T> {
  const {
    threshold = INTERSECTION_OPTIONS.threshold,
    fallbackDelay = ANIMATION_TIMING.VISIBILITY_FALLBACK,
  } = options;

  const ref = useRef<T>(null!);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle mounting with fallback visibility timer
  useEffect(() => {
    setMounted(true);
    // Safety fallback: ensure content becomes visible even if observer fails
    const timer = setTimeout(() => setIsVisible(true), fallbackDelay);
    return () => clearTimeout(timer);
  }, [fallbackDelay]);

  // Setup IntersectionObserver after mount
  useEffect(() => {
    if (!mounted) return;

    const currentRef = ref.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
    };
  }, [mounted, threshold]);

  return { ref, mounted, isVisible };
}
