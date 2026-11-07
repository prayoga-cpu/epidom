"use client";

import { useEffect, useState } from "react";
import type { CustomerDisplayBanner } from "@/lib/validation/customer-display.schemas";
import { cn } from "@/lib/utils";

interface CustomerDisplaySlideshowProps {
  banners: CustomerDisplayBanner[];
  /** Seconds each banner stays up. */
  seconds: number;
  className?: string;
}

/**
 * Promo banners crossfading in a panel. Every banner stays mounted (stacked,
 * only the current one opaque) so each image is loaded once, up front, and a
 * banner never fades in half-drawn. A banner is shown whole (contain) over a
 * blurred copy of itself, so a photo of any shape fills the panel without
 * being cropped or letterboxed in a flat colour.
 */
export function CustomerDisplaySlideshow({
  banners,
  seconds,
  className,
}: CustomerDisplaySlideshowProps) {
  const [index, setIndex] = useState(0);
  const count = banners.length;
  // A schedule can take banners out of rotation between ticks.
  const current = count > 0 ? index % count : 0;

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), seconds * 1000);
    return () => clearInterval(timer);
  }, [count, seconds]);

  if (count === 0) return null;
  const shown = banners[current];

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`backdrop-${shown.id}`}
        src={shown.imageUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
      />
      {banners.map((banner, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={banner.id}
          src={banner.imageUrl}
          alt={banner.label}
          aria-hidden={i !== current}
          className={cn(
            "absolute inset-0 h-full w-full object-contain transition-opacity duration-700",
            i === current ? "opacity-100" : "opacity-0"
          )}
        />
      ))}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {banners.map((banner, i) => (
            <span
              key={banner.id}
              className={cn(
                "h-1.5 rounded-full bg-white shadow transition-all duration-500",
                i === current ? "w-5 opacity-90" : "w-1.5 opacity-50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
