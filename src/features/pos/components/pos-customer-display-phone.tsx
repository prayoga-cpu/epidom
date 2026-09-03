"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Delete, MessageCircle, Search, X } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumber,
  type Country,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import countryNames from "react-phone-number-input/locale/en.json";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * Keyboard-free phone entry for the customer-facing screen.
 *
 * Deliberately NOT the app's `PhoneInput` / Radix `Dialog`: this renders on a
 * screen the customer touches, on the store's own brand colour, and it must
 * never summon the operating system keyboard — a second-screen till usually
 * has no keyboard attached, and on a touch monitor the OS keyboard would
 * cover the very field it is filling. Every digit comes from the on-screen
 * pad below, and the number field is `readOnly` so tapping it does nothing.
 *
 * Styled with the display's own `--cfd-*` variables so it sits on the brand
 * ground rather than the dashboard's dark theme.
 */

/** The one truly interactive control on the display. Everything else is read-only. */
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

interface PosCustomerDisplayPhoneProps {
  open: boolean;
  onClose: () => void;
  /** ISO-2 for the store's own country, so the common case needs no picking. */
  defaultCountry: string;
  /** Receives a validated E.164 number, or null when the customer clears it. */
  onSubmit: (phone: string | null) => void;
  /** Already-submitted number, so reopening shows what was sent. */
  submitted: string | null;
}

function FlagFor({ country }: { country: string }) {
  const Flag = (flags as Record<string, React.ComponentType<{ title?: string }>>)[country];
  if (!Flag) return <span className="text-base">🏳️</span>;
  return (
    <span className="inline-block h-4 w-6 overflow-hidden rounded-[2px]">
      <Flag title={country} />
    </span>
  );
}

export function PosCustomerDisplayPhone({
  open,
  onClose,
  defaultCountry,
  onSubmit,
  submitted,
}: PosCustomerDisplayPhoneProps) {
  const { t } = useI18n();
  const [country, setCountry] = useState<string>(defaultCountry);
  const [digits, setDigits] = useState("");
  const [pickingCountry, setPickingCountry] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  // Reset to a clean slate each time it opens, so one customer's half-typed
  // number is never shown to the next.
  useEffect(() => {
    if (!open) return;
    setPickingCountry(false);
    setCountryQuery("");
    if (submitted) {
      try {
        const parsed = parsePhoneNumber(submitted);
        if (parsed?.country) setCountry(parsed.country);
        setDigits(parsed?.nationalNumber ? String(parsed.nationalNumber) : "");
        return;
      } catch {
        // Fall through to an empty field rather than showing something odd.
      }
    }
    setCountry(defaultCountry);
    setDigits("");
  }, [open, submitted, defaultCountry]);

  const countries = useMemo(() => {
    const names = countryNames as Record<string, string>;
    return getCountries()
      .map((c) => ({
        code: c as string,
        name: names[c] ?? (c as string),
        dial: getCountryCallingCode(c as Country),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase() === q
    );
  }, [countries, countryQuery]);

  const dial = (() => {
    try {
      return getCountryCallingCode(country as Country);
    } catch {
      return "";
    }
  })();

  const e164 = digits ? `+${dial}${digits}` : "";
  const isValid = (() => {
    if (!digits) return false;
    try {
      return parsePhoneNumber(e164)?.isValid() ?? false;
    } catch {
      return false;
    }
  })();

  if (!open) return null;

  const handleKey = (key: string) => {
    if (key === "del") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    // A national number never sensibly exceeds 15 digits (E.164's own cap
    // includes the country code), so this stops a stuck finger, not a user.
    setDigits((d) => (d.length >= 15 ? d : d + key));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("pos.customerDisplay.phoneTitle")}
      // `fixed`, not `absolute`: on a narrow display the themed root scrolls,
      // and an absolutely-positioned overlay would be centred inside that
      // taller box and could sit off-screen. CSS custom properties inherit
      // through the DOM, not the containing block, so --cfd-* still apply.
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel-strong)] shadow-2xl backdrop-blur-md">
        {pickingCountry ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--cfd-border)] p-4">
              <button
                type="button"
                onClick={() => setPickingCountry(false)}
                aria-label={t("common.actions.back")}
                className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full hover:bg-[color:var(--cfd-panel)]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="relative min-w-0 flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 opacity-50" />
                {/* The one place a keyboard IS acceptable: searching 245
                    countries by tapping through them would be worse. It is
                    optional — the list below is fully scrollable without it. */}
                <input
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  placeholder={t("pos.customerDisplay.phoneSearchCountry")}
                  className="h-11 w-full rounded-full border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] pr-4 pl-9 text-base text-[color:var(--cfd-ink)] placeholder:opacity-50 focus:outline-none"
                />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredCountries.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setCountry(c.code);
                      setPickingCountry(false);
                    }}
                    className={cn(
                      "flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2 text-left",
                      c.code === country ? "bg-[color:var(--cfd-panel)]" : "hover:bg-[color:var(--cfd-panel)]"
                    )}
                  >
                    <FlagFor country={c.code} />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    <span className="shrink-0 text-sm tabular-nums opacity-70">+{c.dial}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--cfd-border)] p-5 sm:p-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  <h2 className="text-lg font-semibold sm:text-xl">
                    {t("pos.customerDisplay.phoneTitle")}
                  </h2>
                </div>
                <p className="mt-1.5 text-sm opacity-70 sm:text-base">
                  {t("pos.customerDisplay.phoneDesc")}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.actions.close")}
                className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full hover:bg-[color:var(--cfd-panel)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {/* Country + number. readOnly, and no `inputMode`, so tapping it
                  never raises the OS keyboard — the pad below is the input. */}
              <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] p-2">
                <button
                  type="button"
                  onClick={() => setPickingCountry(true)}
                  aria-label={t("pos.customerDisplay.phoneCountry")}
                  className="flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl px-3 py-2 hover:bg-[color:var(--cfd-panel-strong)]"
                >
                  <FlagFor country={country} />
                  <span className="text-base font-semibold tabular-nums">+{dial}</span>
                </button>
                <div className="min-w-0 flex-1 truncate py-2 text-2xl font-semibold tabular-nums sm:text-3xl">
                  {digits || (
                    <span className="opacity-40">{t("pos.customerDisplay.phonePlaceholder")}</span>
                  )}
                </div>
              </div>

              <div className="mx-auto mt-5 grid w-full max-w-[260px] grid-cols-3 gap-2 sm:gap-3">
                {PAD_KEYS.map((key, idx) =>
                  key === "" ? (
                    <div key={idx} />
                  ) : (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleKey(key)}
                      aria-label={key === "del" ? t("common.actions.delete") : key}
                      className="flex h-14 touch-manipulation items-center justify-center rounded-2xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] text-xl font-semibold tabular-nums transition-opacity active:opacity-60 sm:h-16 sm:text-2xl"
                    >
                      {key === "del" ? <Delete className="h-6 w-6" /> : key}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-[color:var(--cfd-border)] p-4 sm:p-5">
              {submitted && (
                <button
                  type="button"
                  onClick={() => {
                    onSubmit(null);
                    onClose();
                  }}
                  className="min-h-12 shrink-0 touch-manipulation rounded-2xl border border-[color:var(--cfd-border)] px-4 text-sm font-medium opacity-80 hover:opacity-100"
                >
                  {t("pos.customerDisplay.phoneRemove")}
                </button>
              )}
              <button
                type="button"
                disabled={!isValid}
                onClick={() => {
                  onSubmit(e164);
                  onClose();
                }}
                className="flex min-h-12 flex-1 touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[color:var(--cfd-ink)] px-4 text-base font-semibold text-[color:var(--cfd-on-ink)] transition-opacity disabled:opacity-35"
              >
                <Check className="h-5 w-5" />
                {t("pos.customerDisplay.phoneConfirm")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
