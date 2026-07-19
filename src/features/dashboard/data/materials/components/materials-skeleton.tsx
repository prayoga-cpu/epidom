"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemCardGrid } from "../../components/base-item-card";

/**
 * Pixel-perfect skeleton for Materials Card Grid
 * Mimics the exact structure of BaseItemCard to prevent layout shift
 */
export function MaterialsCardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
      {/* Header Skeleton - matches CardHeader structure */}
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Skeleton className="h-7 w-32" />
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Section Skeleton */}
        <FilterSectionSkeleton />

        {/* Results Count Skeleton */}
        <div className="flex items-center border-b pb-2">
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Card Grid - using ItemCardGrid for consistency */}
        <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}>
          {Array.from({ length: cards }).map((_, i) => (
            <Card
              key={i}
              className="group bg-card relative rounded-lg border px-0 py-4 shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="!px-4">
                {/* Header - matches material card header structure */}
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <Skeleton className="mb-1 h-4 w-[85px]" />{" "}
                    {/* Name - matches w-[85px] truncate */}
                    <Skeleton className="h-3 w-20" /> {/* SKU */}
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" /> {/* Status Badge */}
                </div>

                {/* Separator */}
                <div className="bg-border my-2 h-px" />

                {/* Material Info - matches exact structure */}
                <div className="my-2 space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>

                {/* Hover Actions - matches 3 button grid */}
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <Skeleton className="h-8 w-full rounded" />
                  <Skeleton className="h-8 w-full rounded" />
                  <Skeleton className="h-8 w-full rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </ItemCardGrid>
      </CardContent>
    </Card>
  );
}

/**
 * Reusable filter section skeleton
 */
function FilterSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-10 w-full sm:w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
