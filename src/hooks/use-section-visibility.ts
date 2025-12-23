/**
 * useSectionVisibility Hook
 *
 * Custom hook for handling section visibility animations with
 * IntersectionObserver and hydration-safe mounting.
 *
 * Features:
 * - Prevents hydration mismatch with mounted state
 * - Uses IntersectionObserver for scroll-triggered animations
 *
 * @module
 */

import { useState, useEffect, useRef, RefObject } from "react";
import { INTERSECTION_OPTIONS } from "@/lib/constants/animations";

interface UseSectionVisibilityOptions {
  /** IntersectionObserver threshold (0-1) */
  threshold?: number;
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
  const { threshold = INTERSECTION_OPTIONS.threshold } = options;

  const ref = useRef<T>(null!);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

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

