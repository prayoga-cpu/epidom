"use client";

import type * as React from "react";
import {
  ChefHat,
  Coffee,
  Croissant,
  Ellipsis,
  House,
  Sandwich,
  Truck,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/onboarding/markets";

export const BUSINESS_TYPE_ICONS: Record<BusinessType, LucideIcon> = {
  cafe: Coffee,
  restaurant: UtensilsCrossed,
  bakery: Croissant,
  bar: Wine,
  fastFood: Sandwich,
  foodTruck: Truck,
  homeKitchen: House,
  catering: ChefHat,
  other: Ellipsis,
};

export interface BusinessTypePickerProps {
  value?: BusinessType | null;
  /** The tapped type, or undefined when the selected chip is tapped again (clears it). */
  onChange: (value: BusinessType | undefined) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  onBlur?: () => void;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * Single-select chip grid of BUSINESS_TYPES. Each chip is a toggle button
 * (aria-pressed); tapping the selected one clears the choice, since the field
 * is optional. 2 columns on phones, 3 from sm.
 */
export function BusinessTypePicker({
  value,
  onChange,
  disabled,
  id,
  className,
  onBlur,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: BusinessTypePickerProps) {
  const { t } = useI18n();

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}
      onBlur={(event: React.FocusEvent<HTMLDivElement>) => {
        // Only when focus leaves the whole group, not when it moves between chips.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
      }}
    >
      {BUSINESS_TYPES.map((type) => {
        const Icon = BUSINESS_TYPE_ICONS[type];
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? undefined : type)}
            className={cn(
              "flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "text-foreground border-[var(--epi-gold-500)] bg-[var(--epi-gold-500)]/10"
                : "border-input bg-background text-foreground hover:bg-accent"
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "size-4 shrink-0",
                selected ? "text-[var(--epi-gold-600)]" : "text-muted-foreground"
              )}
            />
            <span className="min-w-0 flex-1 leading-tight break-words">
              {t(`storeEssentials.businessTypes.${type}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
