"use client";

import * as React from "react";
import PhoneInputWithCountry from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { cn } from "@/lib/utils";
import "./phone-input.css";

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string | undefined) => void;
  defaultCountry?: string;
}

// Define InputComponent outside to prevent re-creation on every render
const InputComponent = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
);

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
export function PhoneInput({ className, value, onChange, defaultCountry = "FR", disabled, ...props }: PhoneInputProps) {
  return (
    <PhoneInputWithCountry
      flags={flags}
      defaultCountry={defaultCountry as any}
      value={value as any}
      onChange={onChange as any}
      international
      countryCallingCodeEditable={false}
      disabled={disabled}
      className={cn("phone-input-wrapper", className)}
      inputComponent={InputComponent}
    />
  );
}
