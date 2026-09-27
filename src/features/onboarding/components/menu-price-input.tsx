"use client";

import * as React from "react";
import { DecimalInput, type DecimalInputProps } from "@/components/shared/decimal-input";
import { Input } from "@/components/ui/input";

/** "25.000", "25,000", "25 000" → 25000; nothing typed → undefined. */
export function parseWholeAmount(text: string): number | undefined {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}

/**
 * Step 2's price field. With decimals (EUR, USD…) it is the shared
 * DecimalInput. A zero-decimal currency (IDR, XOF, XPF) has no fraction, so a
 * "." "," or space can only group thousands: "25.000" is 25000, the way the
 * placeholder shows it and the way Indonesian prices are written.
 * DecimalInput would read that "." as a decimal point and keep 25.
 */
export const MenuPriceInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  function MenuPriceInput(props, ref) {
    if ((props.decimals ?? 3) > 0) return <DecimalInput ref={ref} {...props} />;
    return <WholeAmountInput ref={ref} {...props} />;
  }
);

/**
 * A whole-number amount: keeps the text as typed (grouping included) and
 * reports its digits as a number. Same external contract and focus-aware
 * syncing as DecimalInput.
 */
const WholeAmountInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  function WholeAmountInput(
    // decimals and min are fixed here (0 and never negative).
    { value, onChange, decimals: _decimals, min: _min, onFocus, onBlur, ...props },
    ref
  ) {
    const [rawText, setRawText] = React.useState<string>(value === undefined ? "" : String(value));
    const previousValueRef = React.useRef<number | undefined>(value);
    const isFocusedRef = React.useRef(false);

    // Follow outside changes (a form reset), never while the owner types.
    React.useEffect(() => {
      if (value !== previousValueRef.current) {
        previousValueRef.current = value;
        if (!isFocusedRef.current) {
          setRawText(value === undefined ? "" : String(value));
        }
      }
    }, [value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      // Digits, plus the characters people group thousands with.
      const next = event.target.value.replace(/[^0-9.,\s]/g, "");
      const parsed = parseWholeAmount(next);
      setRawText(next);
      previousValueRef.current = parsed;
      onChange(parsed);
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      if (parseWholeAmount(rawText) !== value) {
        setRawText(value === undefined ? "" : String(value));
      }
      onBlur?.(event);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={rawText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }
);
