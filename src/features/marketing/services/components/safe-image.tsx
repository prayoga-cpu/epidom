"use client";

/**
 * Safe Image Component
 *
 * Next.js Image wrapper with error handling and graceful fallback.
 * Shows gradient placeholder on error to prevent broken images.
 *
 * @component
 */

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Props for SafeImage component
 */
interface SafeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  placeholderText?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  style?: React.CSSProperties;
}

export function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  fill = false,
  placeholderText,
  priority = false,
  quality = 75,
  sizes,
  style,
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  // Jika ada error, tampilkan placeholder inline
  if (hasError) {
    if (fill) {
      // Untuk fill=true, placeholder harus mengisi seluruh container
      return (
        <div className={cn("absolute inset-0 rounded-lg bg-gray-100", className)} style={style}>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300"></div>
        </div>
      );
    } else {
      // Untuk width/height yang ditentukan
      return (
        <div
          className={cn("rounded-lg bg-gray-100", className)}
          style={{ width, height, ...style }}
        >
          <div className="h-full w-full rounded-lg bg-gradient-to-br from-gray-200 to-gray-300"></div>
        </div>
      );
    }
  }

  // Render Next.js Image component
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        priority={priority}
        quality={quality}
        sizes={sizes}
        style={style}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      quality={quality}
      sizes={sizes}
      style={style}
      onError={handleError}
    />
  );
}
