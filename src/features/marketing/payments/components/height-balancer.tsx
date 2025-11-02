"use client";

/**
 * Height Balancer Component
 *
 * Utility component to balance heights between two containers.
 * Used for payment page layout to ensure form and summary match.
 * Only active on desktop (lg+ breakpoint).
 *
 * @component
 */

import { useEffect, useRef } from "react";

export function HeightBalancer() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const balanceHeights = () => {
      if (!leftRef.current || !rightRef.current) return;

      const leftHeight = leftRef.current.offsetHeight;
      const rightHeight = rightRef.current.offsetHeight;

      // Set the taller height to both containers
      const maxHeight = Math.max(leftHeight, rightHeight);

      if (window.innerWidth >= 1024) {
        // Only on desktop
        leftRef.current.style.minHeight = `${maxHeight}px`;
        rightRef.current.style.minHeight = `${maxHeight}px`;
      }
    };

    // Balance on mount and resize
    balanceHeights();
    window.addEventListener("resize", balanceHeights);

    // Also balance after a short delay to ensure content is loaded
    const timeout = setTimeout(balanceHeights, 100);

    return () => {
      window.removeEventListener("resize", balanceHeights);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <div ref={leftRef} id="payment-form-container" className="order-2 lg:order-1 lg:col-span-2">
        {/* This will be replaced by the actual content */}
      </div>
      <div
        ref={rightRef}
        id="payment-sidebar-container"
        className="order-1 lg:order-2 lg:col-span-1"
      >
        {/* This will be replaced by the actual content */}
      </div>
    </>
  );
}
