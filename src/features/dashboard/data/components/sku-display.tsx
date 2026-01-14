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
        "text-muted-foreground text-xs cursor-pointer transition-colors hover:text-foreground",
        !isExpanded && "truncate max-w-[120px] sm:max-w-[150px]",
        isExpanded && "whitespace-normal break-all",
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
