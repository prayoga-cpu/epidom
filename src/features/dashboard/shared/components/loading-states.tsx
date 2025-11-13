"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { responsive, responsiveText } from "@/lib/utils/responsive";
import { cn } from "@/lib/utils";

/**
 * PageLoadingSkeleton Component
 *
 * Full page loading skeleton for pages like Profile, Dashboard, etc.
 * Provides consistent loading experience across the app.
 */
export function PageLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("min-h-[calc(100vh-150px)] w-full space-y-4 sm:space-y-6", className)}>
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6 md:px-8 md:py-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-2">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

interface SectionLoadingStateProps {
  title: string;
  exportLabel?: string;
  addLabel?: string;
  selectLabel?: string;
  description?: string;
  className?: string;
}

/**
 * SectionLoadingSkeleton Component
 *
 * Loading state for data sections (Materials, Products, Recipes, Suppliers).
 * Displays a card with disabled header buttons and a centered spinner.
 * Follows DRY principle by centralizing the loading state pattern.
 */
export function SectionLoadingSkeleton({
  title,
  exportLabel,
  addLabel,
  selectLabel,
  description,
  className,
}: SectionLoadingStateProps) {
  return (
    <Card className={cn(responsive.cardWrapper, className)}>
      <CardHeader className={responsive.cardHeader}>
        <div className={responsive.header}>
          <div>
            <CardTitle className={responsiveText.title}>{title}</CardTitle>
            {description && (
              <p className={cn("text-muted-foreground mt-1", responsiveText.description)}>
                {description}
              </p>
            )}
          </div>
          {(exportLabel || addLabel || selectLabel) && (
            <div className={responsive.buttonGroup}>
              {exportLabel && (
                <Skeleton className="h-9 w-24 md:w-auto md:min-w-[100px]" />
              )}
              {addLabel && (
                <Skeleton className="h-9 w-24 md:w-auto md:min-w-[100px]" />
              )}
              {selectLabel && (
                <Skeleton className="h-9 w-24 md:w-auto md:min-w-[100px]" />
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface TableLoadingSkeletonProps {
  columns?: number;
  rows?: number;
  className?: string;
}

/**
 * TableLoadingSkeleton Component
 *
 * Loading state for table views.
 * Displays skeleton rows matching the table structure.
 */
export function TableLoadingSkeleton({
  columns = 5,
  rows = 5,
  className,
}: TableLoadingSkeletonProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-md border">
        {/* Table Header */}
        <div className="border-b bg-muted/50 p-4">
          <div className="flex gap-4">
            {[...Array(columns)].map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {/* Table Rows */}
        <div className="divide-y">
          {[...Array(rows)].map((_, rowIndex) => (
            <div key={rowIndex} className="p-4">
              <div className="flex gap-4">
                {[...Array(columns)].map((_, colIndex) => (
                  <Skeleton key={colIndex} className="h-4 flex-1" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CardLoadingSkeletonProps {
  count?: number;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
}

/**
 * CardLoadingSkeleton Component
 *
 * Loading state for card grids (item lists).
 * Displays skeleton cards matching the grid layout.
 */
export function CardLoadingSkeleton({
  count = 6,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  className,
}: CardLoadingSkeletonProps) {
  const gridClasses = cn(
    "grid gap-3",
    columns.mobile === 1 && "grid-cols-1",
    columns.tablet === 2 && "md:grid-cols-2",
    columns.tablet === 3 && "md:grid-cols-3",
    columns.tablet === 4 && "md:grid-cols-4",
    columns.desktop === 2 && "lg:grid-cols-2",
    columns.desktop === 3 && "lg:grid-cols-3",
    columns.desktop === 4 && "lg:grid-cols-4",
    className
  );

  return (
    <div className={gridClasses}>
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="border">
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * SimpleLoadingSpinner Component
 *
 * Simple centered loading spinner for inline use.
 * Used in components that don't need full skeleton structure.
 */
export function SimpleLoadingSpinner({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <Loader2 className="text-muted-foreground mb-4 h-8 w-8 animate-spin" />
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}

