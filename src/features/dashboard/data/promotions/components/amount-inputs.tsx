"use client";

import * as React from "react";
import { DecimalInput, type DecimalInputProps } from "@/components/shared/decimal-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AmountInputProps extends Omit<DecimalInputProps, "type"> {
  /** "%" or the store's currency symbol. Shown as a fixed cap on the input. */
  adornment: string;
  adornmentPosition?: "start" | "end";
}

/**
 * A decimal input with a unit cap: the currency symbol in front of an amount,
 * "%" after a percentage.
 *
 * The cap is a sibling flex item, not absolutely-positioned text over the input,
 * so it can be any width ("€", "Rp", "CHF") without a hardcoded left padding on
 * the input. Extra props (the id / aria-invalid that <FormControl> injects) go
 * to the INPUT, not the wrapper, so labels and error states still target it.
 *
 * Built on DecimalInput, which accepts "," or "." and reports a parsed number —
 * a French keyboard types "2,50" and gets 2.5.
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput({ adornment, adornmentPosition = "start", className, ...props }, ref) {
    const isStart = adornmentPosition === "start";
    const cap = (
      <span
        className={cn(
          "border-input bg-muted text-muted-foreground inline-flex h-10 min-w-10 shrink-0 items-center justify-center border px-3 text-sm font-medium select-none",
          isStart ? "rounded-l-md border-r-0" : "rounded-r-md border-l-0"
        )}
      >
        {adornment}
      </span>
    );

    return (
      <div className="flex w-full items-stretch">
        {isStart && cap}
        <DecimalInput
          ref={ref}
          className={cn("h-10 flex-1", isStart ? "rounded-l-none" : "rounded-r-none", className)}
          {...props}
        />
        {!isStart && cap}
      </div>
    );
  }
);

interface IntegerInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "ref"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

/**
 * Whole-number input (max uses, minimum redeem points). Keeps only digits as
 * they are typed, so there is no "-" / "." / "e" to reject afterwards, and
 * reports `undefined` for an empty field — the form maps that to "unlimited" or
 * "none" instead of a 0 the owner never typed.
 */
export const IntegerInput = React.forwardRef<HTMLInputElement, IntegerInputProps>(
  function IntegerInput({ value, onChange, className, ...props }, ref) {
    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        className={cn("h-10", className)}
        value={value === undefined ? "" : String(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange(digits === "" ? undefined : Number(digits));
        }}
      />
    );
  }
);
