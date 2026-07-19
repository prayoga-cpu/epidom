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
        !isExpanded && "max-w-[120px] truncate sm:max-w-[150px]",
        isExpanded && "break-all whitespace-normal",
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
