"use client";

import { Card } from "@/components/ui/card";
import { responsive } from "@/lib/utils/responsive";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * SectionCard Component
 *
 * Consistent card wrapper for data sections (Materials, Recipes, Products, Suppliers).
 * Follows DRY principle by centralizing the card styling pattern.
 */
export function SectionCard({ children, className }: SectionCardProps) {
  return <Card className={cn(responsive.cardWrapper, className)}>{children}</Card>;
}
