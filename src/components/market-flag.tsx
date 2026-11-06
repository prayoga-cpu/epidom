"use client";

import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

export type Market = "fr" | "id";

const INTL: Record<Locale, string> = { fr: "fr-FR", id: "id-ID", en: "en-US" };

const REGION: Record<Market, string> = { fr: "FR", id: "ID" };

/** The market's country name in the page's language ("France", "Indonésie", "Prancis"). */
export function marketName(market: Market, locale: Locale): string {
  try {
    return (
      new Intl.DisplayNames([INTL[locale]], { type: "region" }).of(REGION[market]) ?? REGION[market]
    );
  } catch {
    return REGION[market];
  }
}

/**
 * A market's flag (Twemoji-style rounded flags), used in place of a "(France)" /
 * "(Indonesia)" suffix. It stays in the accessible name: the flag is hidden from
 * screen readers and the country name is read out instead.
 */
export function MarketFlag({
  market,
  className,
  decorative = false,
}: {
  market: Market;
  className?: string;
  /** The country name is written out beside the flag, so the flag adds nothing to read. */
  decorative?: boolean;
}) {
  const { locale } = useI18n();
  return (
    <>
      <svg
        viewBox="0 0 36 36"
        aria-hidden="true"
        focusable="false"
        className={cn("inline-block size-[1.1em] shrink-0 align-[-0.2em]", className)}
      >
        {market === "fr" ? (
          <>
            <path fill="#ED2939" d="M36 27a4 4 0 0 1-4 4h-8V5h8a4 4 0 0 1 4 4v18z" />
            <path fill="#002495" d="M4 5a4 4 0 0 0-4 4v18a4 4 0 0 0 4 4h8V5H4z" />
            <path fill="#EEE" d="M12 5h12v26H12z" />
          </>
        ) : (
          <>
            <path fill="#DC1F26" d="M32 5H4a4 4 0 0 0-4 4v9h36V9a4 4 0 0 0-4-4z" />
            <path fill="#EEE" d="M36 27a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4v-9h36v9z" />
          </>
        )}
      </svg>
      {decorative ? null : <span className="sr-only">{marketName(market, locale)}</span>}
    </>
  );
}
