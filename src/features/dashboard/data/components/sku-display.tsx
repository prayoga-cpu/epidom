"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface SKUDisplayProps {
  sku: string;
  className?: string;
}

export function SKUDisplay({ sku, className }: SKUDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <p
      className={cn(
        "text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors",
        // Truncates to whatever the parent column actually offers rather than a
        // fixed 120/150px, which clipped the SKU even on a wide desktop card.
        // Requires the parent to carry `min-w-0` (see the card headers) — a
        // flex child won't shrink below its content without it.
        !isExpanded && "truncate",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
      }}
      title={!isExpanded ? sku : undefined}
    >
      SKU: {sku}
    </p>
  );
}
