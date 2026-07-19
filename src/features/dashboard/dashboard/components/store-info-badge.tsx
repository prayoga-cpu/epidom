"use client";

import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";

/**
 * Store Info Badge Component
 *
 * Displays the current store name and location (if available) as a badge.
 * Used in page headers to provide visual context about which store is being viewed.
 *
 * Features:
 * - Shows store name
 * - Shows city with location icon (if available)
 * - Loading skeleton state
 * - Returns null if no store selected (graceful degradation)
 *
 * @example
 * <PageHeader>
 *   <h1>Dashboard</h1>
 *   <StoreInfoBadge />
 * </PageHeader>
 */
export function StoreInfoBadge() {
  const { store, isLoading } = useCurrentStore();

  // Loading state
  if (isLoading) {
    return <Skeleton className="h-6 w-32" />;
  }

  // No store selected
  if (!store) {
    return null;
  }

  return (
    <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm font-normal">
      <span className="font-medium">{store.name}</span>
      {store.city && (
        <>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {store.city}
          </span>
        </>
      )}
    </Badge>
  );
}
