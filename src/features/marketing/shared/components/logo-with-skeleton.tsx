"use client";

import { useState } from "react";
import Image from "next/image";

interface LogoWithSkeletonProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  filter?: string;
  sizes?: string;
  wrapperClassName?: string;
}

export function LogoWithSkeleton({
  src,
  alt,
  width = 120,
  height = 32,
  className = "h-8 w-auto",
  filter,
  sizes,
  wrapperClassName,
}: LogoWithSkeletonProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className={wrapperClassName || "relative h-8 w-[120px] flex items-center justify-center"}>
      {isLoading && (
        <div className="absolute inset-0 animate-pulse rounded bg-gray-200" />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`relative ${className}`}
        style={{
          width: "auto",
          height: "auto",
          ...(filter && { filter }),
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-in-out",
        }}
        sizes={sizes}
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />
    </div>
  );
}
