"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import type { DiscountKindDto } from "@/types/api/cashier";

interface DiscountTypeToggleProps
  // `onChange` is omitted too: the root <div>'s own onChange is a FormEventHandler,
  // and this control's onChange takes the chosen kind instead.
  extends Omit<
    React.ComponentProps<typeof RadioGroupPrimitive.Root>,
    "value" | "onValueChange" | "onChange"
  > {
  value: DiscountKindDto;
  onChange: (value: DiscountKindDto) => void;
  labels: Record<DiscountKindDto, string>;
}

/**
 * Two-way segmented control for "percentage" vs "fixed amount".
 *
 * A Radix radio group rather than two loose buttons, so screen readers announce
 * a single choice and the arrow keys move between the options. Each segment is
 * 40px tall — this is used on phones and tablets.
 */
export function DiscountTypeToggle({
  value,
  onChange,
  labels,
  className,
  ...props
}: DiscountTypeToggleProps) {
  return (
    <RadioGroupPrimitive.Root
      {...props}
      value={value}
      onValueChange={(next) => onChange(next as DiscountKindDto)}
      className={cn("bg-muted grid grid-cols-2 gap-1 rounded-lg p-1", className)}
    >
      {(["PERCENT", "FIXED"] as const).map((kind) => (
        <RadioGroupPrimitive.Item
          key={kind}
          value={kind}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 data-[state=checked]:bg-background data-[state=checked]:text-foreground inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:shadow-sm"
        >
          {labels[kind]}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
