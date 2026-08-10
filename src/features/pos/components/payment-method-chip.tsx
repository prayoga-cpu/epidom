"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";

// Shared button-style radio option for payment-method pickers (POS checkout,
// Mark Paid) — a native <label> wrapping the radio so the whole chip, not
// just the dot, toggles the selection.
export function PaymentMethodChip({
  value,
  label,
  selected,
  idPrefix,
}: {
  value: string;
  label: string;
  selected: boolean;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${value}`;
  return (
    <Label
      htmlFor={id}
      className={cn(
        "min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal",
        selected ? "border-primary bg-primary/5" : "hover:border-foreground/40"
      )}
    >
      <RadioGroupItem value={value} id={id} />
      {label}
    </Label>
  );
}
