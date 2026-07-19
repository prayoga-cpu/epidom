"use client";

import { Button } from "@/components/ui/button";
import { responsive } from "@/lib/utils/responsive";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

interface ActionButtonsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ActionButtons Component
 *
 * Wrapper for action button groups with consistent responsive layout.
 * Mobile: vertical stack, full-width buttons
 * Tablet+: horizontal layout, auto-width buttons
 */
export function ActionButtons({ children, className }: ActionButtonsProps) {
  return <div className={cn(responsive.buttonGroup, className)}>{children}</div>;
}

/**
 * ActionButton Component
 *
 * Button with consistent responsive width behavior.
 * Mobile: full-width, Tablet+: auto-width
 */
export function ActionButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button className={cn(responsive.button, className)} {...props} />;
}
