"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { responsive, responsiveText } from "@/lib/utils/responsive";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  actions?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

/**
 * SectionHeader Component
 *
 * Reusable header component for data sections with consistent responsive layout.
 * Follows DRY principle by centralizing the header pattern used across Materials, Recipes, Products, and Suppliers.
 */
export function SectionHeader({ title, actions, description, className }: SectionHeaderProps) {
  return (
    <CardHeader className={cn(responsive.cardHeader, className)}>
      <div className={responsive.header}>
        <div>
          <CardTitle className={responsiveText.title}>{title}</CardTitle>
          {description && (
            <p className={cn("text-muted-foreground", responsiveText.description)}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className={responsive.buttonGroup}>{actions}</div>}
      </div>
    </CardHeader>
  );
}

// Re-export ActionButtons and ActionButton from action-buttons
export { ActionButtons, ActionButton } from "./action-buttons";

// Re-export SectionCard from section-card
export { SectionCard } from "./section-card";

