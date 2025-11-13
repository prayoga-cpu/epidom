"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type DialogSize = "small" | "medium" | "large" | "full";

interface DialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
  size?: DialogSize;
  scrollable?: boolean;
  className?: string;
}

const sizeClasses: Record<DialogSize, string> = {
  small: "sm:max-w-[425px]",
  medium: "sm:max-w-[600px]",
  large: "sm:max-w-[700px]",
  full: "sm:max-w-[95vw]",
};

/**
 * DialogWrapper Component
 *
 * Standardized dialog wrapper with consistent structure:
 * - Fixed header with title and description
 * - Scrollable content area
 * - Fixed footer (optional)
 *
 * Follows DRY principle by centralizing dialog patterns.
 */
export function DialogWrapper({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  size = "medium",
  scrollable = true,
  className,
}: DialogWrapperProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          "flex flex-col overflow-hidden p-0",
          sizeClasses[size],
          scrollable ? "h-[90vh] max-h-[90vh]" : "max-h-[90vh]",
          className
        )}
      >
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-lg font-bold sm:text-xl">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs sm:text-sm">{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Scrollable Content */}
        <div
          className={cn(
            "flex-1 overflow-y-auto px-6 py-4",
            scrollable && "scrollbar-thin"
          )}
        >
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

