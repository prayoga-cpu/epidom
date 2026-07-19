import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Reusable EmptyState component
 *
 * Follows DRY principle by centralizing empty state pattern
 * used across Materials, Products, Recipes, and Suppliers sections
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`col-span-full flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center ${className || ""}`}
    >
      <Icon className="text-muted-foreground/50 mb-4 h-12 w-12" />
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{description}</p>
      {action}
    </div>
  );
}
