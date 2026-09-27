"use client";

import * as React from "react";
import { Check, Pipette } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getContrastingInk } from "@/lib/utils/color";
import { cn } from "@/lib/utils";
import { EPIDOM_GOLD_HEX } from "../lib/storefront-step-schema";

/**
 * Storefront theme colours offered as one-tap swatches. These are the
 * storefront's own data (it stores a hex), not app UI colours.
 */
export const THEME_SWATCHES = [
  { id: "gold", hex: EPIDOM_GOLD_HEX },
  { id: "tomato", hex: "#D9480F" },
  { id: "basil", hex: "#2F9E44" },
  { id: "ocean", hex: "#1C7ED6" },
  { id: "berry", hex: "#A61E4D" },
  { id: "charcoal", hex: "#212529" },
] as const;

export interface ThemeColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  "aria-labelledby"?: string;
}

/** Six swatches (the Epidom gold first) and a custom colour. */
export function ThemeColorPicker({
  value,
  onChange,
  disabled,
  "aria-labelledby": labelledBy,
}: ThemeColorPickerProps) {
  const { t } = useI18n();
  const customId = React.useId();
  const current = value.toUpperCase();
  const isCustom = !THEME_SWATCHES.some((swatch) => swatch.hex === current);

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-wrap items-center gap-2"
    >
      {THEME_SWATCHES.map((swatch) => {
        const selected = swatch.hex === current;
        return (
          <button
            key={swatch.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`onboarding.storefront.theme.swatches.${swatch.id}`)}
            title={t(`onboarding.storefront.theme.swatches.${swatch.id}`)}
            disabled={disabled}
            onClick={() => onChange(swatch.hex)}
            className={cn(
              "focus-visible:ring-ring flex size-11 items-center justify-center rounded-full border-2 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
              selected ? "border-foreground scale-105" : "border-transparent"
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-[var(--swatch)] text-[var(--swatch-ink)]"
              style={
                {
                  "--swatch": swatch.hex,
                  "--swatch-ink": getContrastingInk(swatch.hex),
                } as React.CSSProperties
              }
            >
              {selected ? <Check className="size-4" /> : null}
            </span>
          </button>
        );
      })}

      <label
        htmlFor={customId}
        className={cn(
          "focus-within:ring-ring relative flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 pr-3 pl-1 text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-2",
          isCustom ? "border-foreground" : "border-border",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full border bg-[var(--swatch)] text-[var(--swatch-ink)]"
          style={
            {
              "--swatch": isCustom ? current : "transparent",
              "--swatch-ink": isCustom ? getContrastingInk(current) : "currentColor",
            } as React.CSSProperties
          }
        >
          <Pipette className="size-4" />
        </span>
        <span>{t("onboarding.storefront.theme.custom")}</span>
        <input
          id={customId}
          type="color"
          value={current.toLowerCase()}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
