"use client";

import { Minus, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";

/** Matches `guestCount`'s Zod bounds in pos.schemas.ts — the stepper must not
 * be able to produce a value the server would reject. */
export const GUEST_COUNT_MIN = 1;
export const GUEST_COUNT_MAX = 99;

interface GuestCountStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Prefix for the −/+ button ids, so checkout and hold can both render one
   * without colliding when a dialog stacks over another. */
  idPrefix: string;
}

/**
 * Pax ("how many guests at this table") stepper for DINE_IN orders — feeds
 * Order.guestCount, which powers the shift/daily report's guest block.
 *
 * Same 44px touch-target sizing as PosCartItem's quantity stepper: iPad is the
 * primary cashier device, and AGENTS.md's touch rules put the floor at ~40px
 * for anything actually tappable.
 */
export function GuestCountStepper({ value, onChange, idPrefix }: GuestCountStepperProps) {
  const { t } = useI18n();
  const clamp = (n: number) => Math.min(GUEST_COUNT_MAX, Math.max(GUEST_COUNT_MIN, n));

  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted/50 flex items-center gap-1 rounded-md border p-0.5">
        <Button
          id={`${idPrefix}-guest-decrease`}
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 touch-manipulation rounded-sm"
          disabled={value <= GUEST_COUNT_MIN}
          onClick={() => onChange(clamp(value - 1))}
        >
          <Minus className="h-4 w-4" />
          <span className="sr-only">{t("pos.checkout.guestCountDecrease")}</span>
        </Button>
        <span className="w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button
          id={`${idPrefix}-guest-increase`}
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 touch-manipulation rounded-sm"
          disabled={value >= GUEST_COUNT_MAX}
          onClick={() => onChange(clamp(value + 1))}
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">{t("pos.checkout.guestCountIncrease")}</span>
        </Button>
      </div>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Users className="h-3.5 w-3.5 shrink-0" />
        {t("pos.checkout.guestCountHint")}
      </p>
    </div>
  );
}
