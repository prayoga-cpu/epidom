"use client";

import { useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { GuestCountStepper } from "./guest-count-stepper";

/** The number row covers ordinary tables; a bigger party keeps going with +. */
export const GUEST_QUICK_PICK_MAX = 30;

interface GuestCountPickerProps {
  value: number;
  onChange: (value: number) => void;
  /** Prefix for element ids, so two pickers can't collide when dialogs stack. */
  idPrefix: string;
}

/**
 * Pax for a dine-in sale: the "− 3 +" stepper, centered, and under it a row of
 * number boxes (1 … 30) to scroll and tap, the way table-service tills do it.
 * Both edit the same value — a tap on 6 and two taps on + land in the same place.
 */
export function GuestCountPicker({ value, onChange, idPrefix }: GuestCountPickerProps) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  const numbers = Array.from({ length: GUEST_QUICK_PICK_MAX }, (_, i) => i + 1);

  // Keep the current count's box in view — on open (a table of 14 is
  // off-screen otherwise) and as the stepper moves it. Scrolls the row only,
  // never the dialog around it.
  useEffect(() => {
    const row = rowRef.current;
    const box = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !box) return;
    const r = row.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (b.left < r.left || b.right > r.right) {
      row.scrollBy?.({ left: b.left - r.left - (r.width - b.width) / 2, behavior: "smooth" });
    }
  }, [value]);

  return (
    <div className="min-w-0 space-y-3">
      <p id={`${idPrefix}-guest-count-label`} className="text-sm leading-none font-medium">
        {t("pos.checkout.guestCount")}
      </p>

      <div className="flex justify-center">
        <GuestCountStepper idPrefix={idPrefix} value={value} onChange={onChange} />
      </div>

      {/* nowrap + overflow-x-auto: the row scrolls sideways inside the dialog
          instead of wrapping into a tall block or widening the dialog. */}
      <div
        ref={rowRef}
        role="radiogroup"
        aria-labelledby={`${idPrefix}-guest-count-label`}
        className="flex min-w-0 snap-x flex-nowrap gap-2 overflow-x-auto pb-1"
      >
        {numbers.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(n)}
              className={cn(
                "h-11 w-11 shrink-0 touch-manipulation snap-start rounded-md border text-sm font-semibold tabular-nums transition-colors",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background text-foreground"
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <Users className="h-3.5 w-3.5 shrink-0" />
        {t("pos.checkout.guestCountHint")}
      </p>
    </div>
  );
}
