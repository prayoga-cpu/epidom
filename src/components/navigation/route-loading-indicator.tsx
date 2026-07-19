"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Route Loading Indicator
 *
 * Shows a minimal top loading bar during navigation.
 * Non-blocking - doesn't prevent content from rendering.
 * Provides visual feedback that navigation is happening.
 */
export function RouteLoadingIndicator() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start loading animation when pathname changes
    setLoading(true);
    setProgress(20);

    // Simulate progress
    const timer1 = setTimeout(() => setProgress(40), 100);
    const timer2 = setTimeout(() => setProgress(60), 200);
    const timer3 = setTimeout(() => setProgress(80), 300);

    // Complete loading
    const timer4 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
    }, 400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [pathname]);

  if (!loading) return null;

  return (
    <div
      className="bg-primary fixed top-0 right-0 left-0 z-[9999] h-1 transition-all duration-200 ease-out"
      style={{
        width: `${progress}%`,
        opacity: progress === 100 ? 0 : 1,
      }}
    />
  );
}
