"use client";

import * as React from "react";
import PhoneInputWithCountry, { parsePhoneNumber } from "react-phone-number-input";
import type { Country } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { cn } from "@/lib/utils";
import "./phone-input.css";

/**
 * Normalize a loosely-formatted phone string into strict E.164 (no spaces/
 * punctuation), which is the only format react-phone-number-input accepts as
 * an initial `value` — it throws otherwise. Handles values that predate
 * stricter write-side validation (e.g. "+33 3 88 45 12 67" saved before the
 * supplier-phone schema enforced E.164). Falls back to `undefined` (renders
 * empty) for anything unparseable, rather than crashing the app.
 */
function normalizeToE164(value: string | undefined, defaultCountry: string): string | undefined {
  if (!value) return undefined;

  const stripped = value.replace(/[\s\-().]/g, "");
  if (/^\+[1-9]\d{1,14}$/.test(stripped)) return stripped;

  try {
    const parsed = parsePhoneNumber(value, defaultCountry as Country);
    return parsed?.isValid() ? parsed.number : undefined;
  } catch {
    return undefined;
  }
}

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string | undefined) => void;
  defaultCountry?: string;
}

// Define InputComponent outside to prevent re-creation on every render
const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-base",
      "file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium",
      "placeholder:text-muted-foreground",
      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "md:text-sm",
      className
    )}
    {...props}
  />
));

InputComponent.displayName = "InputComponent";

/**
 * PhoneInput Component
 *
 * A phone number input with country code selector.
 * Uses react-phone-number-input library for international phone number formatting.
 *
 * @example
 * ```tsx
 * <PhoneInput
 *   value={phone}
 *   onChange={setPhone}
 *   defaultCountry="FR"
 *   placeholder="Enter phone number"
 * />
 * ```
 */
export function PhoneInput({
  className,
  value,
  onChange,
  defaultCountry = "FR",
  disabled,
  ...props
}: PhoneInputProps) {
  const normalizedValue = React.useMemo(
    () => normalizeToE164(value, defaultCountry),
    [value, defaultCountry]
  );

  return (
    <PhoneInputWithCountry
      flags={flags}
      /**
       * Type assertion needed because react-phone-number-input types don't match exactly
       * Actual type: CountryCode
       * TODO: Update react-phone-number-input types or create type adapter
       */
      defaultCountry={defaultCountry as any}
      /**
       * Type assertion needed because react-phone-number-input types don't match exactly
       * Actual type: E164Number | undefined
       * TODO: Update react-phone-number-input types or create type adapter
       */
      value={normalizedValue as any}
      /**
       * Type assertion needed because react-phone-number-input types don't match exactly
       * Actual type: (value: E164Number | undefined) => void
       * TODO: Update react-phone-number-input types or create type adapter
       */
      onChange={onChange as any}
      international
      countryCallingCodeEditable={false}
      disabled={disabled}
      className={cn("phone-input-wrapper", className)}
      inputComponent={InputComponent}
    />
  );
}
