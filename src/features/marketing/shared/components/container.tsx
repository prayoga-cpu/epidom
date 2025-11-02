/**
 * Container Component
 *
 * Reusable container wrapper with consistent padding and max-width.
 * Used to standardize page layouts across marketing pages.
 *
 * @component
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Props for Container component
 */
interface ContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "7xl" | "6xl" | "5xl" | "4xl" | "3xl" | "2xl" | "xl";
}

const maxWidthClasses = {
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export function Container({ children, className = "", maxWidth = "7xl" }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 md:px-8 lg:px-8",
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}
