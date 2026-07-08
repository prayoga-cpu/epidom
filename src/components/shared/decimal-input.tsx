"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { parseLocaleDecimal } from "@/lib/utils/number-input";

export interface DecimalInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "min"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Max fractional digits allowed. Default 3 (matches Decimal(10,3) quantity fields). */
  decimals?: number;
  /**
   * When set to a value >= 0, blocks typing a leading "-" (quantity/stock
   * fields are never negative). Does not otherwise enforce a floor — pair
   * with a Zod `.min()`/`.positive()` for real validation on submit.
   */
  min?: number;
}

/**
 * Locale-aware decimal input — drop-in replacement for
 * `<Input type="number" step="0.01" />` + `createNumberInputHandler`.
 *
 * Renders as `type="text" inputMode="decimal"` instead of a native
 * `type="number"` input: native number inputs only accept "." as the decimal
 * separator and enforce `step` at the browser level, which silently rejects
 * comma-decimal entry (French locale) and precision beyond the configured
 * step. This keeps the raw text the user is typing (so an in-progress value
 * like "0," isn't clobbered mid-keystroke) and reports a parsed number via
 * `onChange`, accepting either "," or "." as the decimal point.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  function DecimalInput({ value, onChange, decimals = 3, min, onFocus, onBlur, ...props }, ref) {
    const [rawText, setRawText] = React.useState<string>(value === undefined ? "" : String(value));
    const previousValueRef = React.useRef<number | undefined>(value);
    // Tracked in a ref (not state) so focus changes don't re-run the sync effect.
    const isFocusedRef = React.useRef(false);

    // Sync from external value changes (e.g. form reset) — but NEVER while the
    // user is typing. In-progress text like "0," or "0,0" parses to 0; if the
    // form echoes that 0 back as the `value` prop, rewriting the text from it
    // would collapse "0,0" to "0" mid-keystroke. While focused, the user's
    // text owns the display; we resync on blur if it drifted.
    React.useEffect(() => {
      if (value !== previousValueRef.current) {
        previousValueRef.current = value;
        if (!isFocusedRef.current) {
          setRawText(value === undefined ? "" : String(value));
        }
      }
    }, [value]);

    const allowNegative = min === undefined || min < 0;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let next = e.target.value;

      // Allow only digits and one decimal separator (comma or period); a
      // leading minus too, unless `min` rules out negative values.
      next = next.replace(allowNegative ? /[^0-9,.-]/g : /[^0-9,.]/g, "");

      // Cap fractional digits to `decimals`, keeping whichever separator was
      // typed last so backspacing/re-typing the separator behaves naturally.
      const lastSeparatorIndex = Math.max(next.lastIndexOf(","), next.lastIndexOf("."));
      if (lastSeparatorIndex !== -1) {
        const fractional = next.slice(lastSeparatorIndex + 1).replace(/[,.-]/g, "");
        next = next.slice(0, lastSeparatorIndex + 1) + fractional.slice(0, decimals);
      }

      setRawText(next);
      const parsed = parseLocaleDecimal(next);
      previousValueRef.current = parsed;
      onChange(parsed);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      // If the text no longer represents the external value (e.g. the parent
      // coerced undefined to 0 while we showed ""), resync the display now.
      if (parseLocaleDecimal(rawText) !== value) {
        setRawText(value === undefined ? "" : String(value));
      }
      onBlur?.(e);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={rawText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  }
);
