"use client";

import * as React from "react";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FormDialogLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
  showCloseButton?: boolean;
  /** If true, dialog height auto-fits content. If false, uses fixed 90vh height for long content. Default: true */
  autoHeight?: boolean;
}

const maxWidthClasses = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[500px]",
  lg: "sm:max-w-[600px]",
  xl: "sm:max-w-[700px]",
  "2xl": "sm:max-w-[900px]",
  "3xl": "sm:max-w-[1024px]",
  "4xl": "sm:max-w-[1280px]",
  "5xl": "sm:max-w-[1536px]",
  full: "sm:max-w-full",
};

/**
 * Standardized form dialog layout with sticky header and footer
 * - Header (title + description) always visible at top
 * - Scrollable content area in the middle
 * - Footer (action buttons) always visible at bottom
 */
export function FormDialogLayout({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  maxWidth = "md",
  showCloseButton = true,
  autoHeight = true,
}: FormDialogLayoutProps) {
  return (
    <DialogContent
      className={cn(
        "flex flex-col overflow-hidden p-0",
        autoHeight ? "max-h-[90vh]" : "h-[90vh] max-h-[90vh]",
        maxWidthClasses[maxWidth],
        className
      )}
      showCloseButton={showCloseButton}
    >
      {/* Fixed Header - Always visible */}
      <DialogHeader className="border-border shrink-0 border-b px-4 py-3 pr-10 sm:px-6 sm:py-4 sm:pr-6">
        <DialogTitle className="text-lg font-bold sm:text-xl md:text-2xl">{title}</DialogTitle>
        {description && (
          <DialogDescription className="text-xs sm:text-sm md:text-base">
            {description}
          </DialogDescription>
        )}
      </DialogHeader>

      {/* Scrollable Form Content */}
      <div
        className={cn(
          "scrollbar-thin flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4",
          contentClassName
        )}
      >
        {children}
      </div>

      {/* Fixed Footer with Actions - Always visible */}
      {footer && (
        <DialogFooter className="border-border shrink-0 border-t px-4 py-3 sm:px-6 sm:py-4">
          {footer}
        </DialogFooter>
      )}
    </DialogContent>
  );
}
