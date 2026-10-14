"use client";

import dynamic from "next/dynamic";
import type { PhoneInputProps } from "./phone-input";

/**
 * `PhoneInput`, loaded on first render instead of with the page.
 *
 * react-phone-number-input ships libphonenumber metadata plus a flag icon per
 * country, which is a lot to put in the initial bundle of a page where the
 * field only exists inside a dialog the visitor has to open first (the public
 * storefront's checkout and reservation forms). Back-office forms keep the
 * plain `PhoneInput` import.
 */

const loadPhoneInput = () => import("./phone-input").then((m) => m.PhoneInput);

/** Start fetching the chunk early, e.g. once a visitor shows intent to check out. */
export function preloadPhoneInput() {
  void loadPhoneInput();
}

export const LazyPhoneInput = dynamic<PhoneInputProps>(loadPhoneInput, {
  ssr: false,
  // Same footprint as the rendered field (an h-10 input), so the form doesn't
  // shift when the chunk lands.
  loading: () => (
    <div aria-hidden className="border-input bg-background h-10 w-full rounded-md border" />
  ),
});
