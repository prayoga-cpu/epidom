"use client";

import { memo } from "react";

interface PrionationMarkProps {
  size?: number;
}

export const PrionationMark = memo(function PrionationMark({ size = 20 }: PrionationMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M5 4 L5 20 M5 4 L14 4 C17.5 4 20 6.5 20 10 C20 13.5 17.5 16 14 16 L5 16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
        fill="none"
      />
      <circle cx="14" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
});
