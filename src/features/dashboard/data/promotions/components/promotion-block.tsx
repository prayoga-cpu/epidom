"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PromotionBlockProps {
  title: string;
  description?: string;
  /** Primary action, right-aligned from `sm:` and full-width on a phone. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * One titled block of the Promotions page (presets, coupons, loyalty).
 *
 * Padding is `p-4` at every size on purpose: the coupon table's mobile wrapper
 * bleeds out with `-mx-4` (the app's table idiom), which only reaches the block's
 * edge when the block's own gutter is exactly 16px.
 */
export function PromotionBlock({
  title,
  description,
  action,
  children,
  className,
}: PromotionBlockProps) {
  return (
    <section className={cn("space-y-4 rounded-xl border p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* min-w-0 so the title column yields to the action instead of colliding. */}
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Loading / error placeholder inside a section — centered, same footprint as an empty list. */
export function PromotionBlockState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-center">
      {children}
    </div>
  );
}
