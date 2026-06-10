/**
 * Lottie Loader Component
 *
 * A reusable loading animation using Lottie.
 * Replaces the traditional Loader2 spinner with a smooth, animated loader.
 *
 * @example
 * // Small inline loader
 * <LottieLoader size="sm" className="mr-2" />
 *
 * // Large centered loader
 * <LottieLoader size="lg" />
 *
 * // Custom size
 * <LottieLoader width={100} height={100} />
 */

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

// Size presets for common use cases
const sizePresets = {
  xs: { width: 16, height: 16 },
  sm: { width: 20, height: 20 },
  md: { width: 32, height: 32 },
  lg: { width: 48, height: 48 },
  xl: { width: 64, height: 64 },
} as const;

interface LottieLoaderProps {
  /** Preset size (xs, sm, md, lg, xl) */
  size?: keyof typeof sizePresets;
  /** Custom width in pixels */
  width?: number;
  /** Custom height in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Animation speed (default: 1) */
  speed?: number;
  /** Custom style object */
  style?: CSSProperties;
}

/**
 * Simple Lottie animation data for a circular loader
 * This is a minimalist, smooth spinning loader
 */
const loaderAnimationData = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 60,
  w: 100,
  h: 100,
  nm: "Loader",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Circle",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [360] },
            { t: 60, s: [360] },
          ],
        },
        p: { a: 0, k: [50, 50, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "rc",
              d: 1,
              s: { a: 0, k: [60, 60] },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 30 },
              nm: "Rectangle",
            },
            {
              ty: "st",
              c: {
                a: 0,
                k: [0.5, 0.5, 0.5, 1],
              },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 8 },
              lc: 2,
              lj: 1,
              ml: 4,
              nm: "Stroke",
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: "Transform",
            },
          ],
          nm: "Circle",
          np: 2,
          cix: 2,
          ix: 1,
        },
        {
          ty: "tm",
          s: { a: 0, k: 0 },
          e: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [100] },
              { t: 30, s: [100], e: [100] },
              { t: 60, s: [0], e: [0] },
            ],
          },
          o: { a: 0, k: 0 },
          m: 1,
          ix: 2,
          nm: "Trim Paths",
        },
      ],
      ip: 0,
      op: 300,
      st: 0,
      bm: 0,
    },
  ],
  markers: [],
};

export function LottieLoader({
  size = "md",
  width: customWidth,
  height: customHeight,
  className,
  speed = 1,
  style,
}: LottieLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<any>(null);
  const [useFallback, setUseFallback] = useState(false);

  // Determine dimensions
  const dimensions = customWidth && customHeight
    ? { width: customWidth, height: customHeight }
    : sizePresets[size];

  useEffect(() => {
    // Dynamically import lottie-web to avoid SSR issues
    let isMounted = true;

    const loadLottie = async () => {
      try {
        // Try to load lottie-web
        const lottie = (await import("lottie-web")).default;

        if (!containerRef.current || !isMounted) return;

        // Use the hardcoded minimalist loader animation data
        animationRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: loaderAnimationData,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
            className: "lottie-loader-svg",
          },
        });

        // Set speed
        if (animationRef.current) {
          animationRef.current.setSpeed(speed);
        }
      } catch (error) {
        // If lottie-web is not installed or animation fails, use fallback
        console.warn("Lottie animation unavailable, using fallback spinner:", error);
        setUseFallback(true);
      }
    };

    loadLottie();

    return () => {
      isMounted = false;
      if (animationRef.current) {
        animationRef.current.destroy();
      }
    };
  }, [speed]);

  // Fallback SVG spinner when Lottie is not available
  if (useFallback) {
    return (
      <svg
        className={cn("animate-spin", className)}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          ...style,
        }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-label="Loading..."
        role="status"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("inline-block", className)}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        ...style,
      }}
      aria-label="Loading..."
      role="status"
    />
  );
}

/**
 * Centered Lottie loader for full-page or section loading states
 */
export function LottieLoaderCentered({
  size = "lg",
  className,
  message,
}: {
  size?: keyof typeof sizePresets;
  className?: string;
  message?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-8", className)}>
      <LottieLoader size={size} />
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
