"use client";

import type { ReactElement } from "react";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { MarketFlag } from "@/components/market-flag";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WHATSAPP_NUMBERS, whatsappHref } from "@/lib/constants/contact";
import { cn } from "@/lib/utils";

type Market = keyof typeof WHATSAPP_NUMBERS;

/**
 * The green "online" light: a solid dot with a ring that swells and fades
 * every 2s (it stays still with reduced motion). Decorative; the label next to
 * it says it in words. `onGold` darkens it to read on the gold button.
 * vertical-align: middle centres it on the line's capitals.
 */
export function OnlineDot({ onGold = false, className }: { onGold?: boolean; className?: string }) {
  const color = onGold ? "bg-emerald-600" : "bg-emerald-400";
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex size-2 shrink-0 align-middle", className)}
    >
      <span
        className={cn(
          "absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping",
          color
        )}
        style={{ animationDuration: "2s" }}
      />
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          color,
          onGold
            ? "shadow-[0_0_0_2px_rgba(255,255,255,0.35)]"
            : "shadow-[0_0_8px_rgba(52,211,153,0.6)]"
        )}
      />
    </span>
  );
}

/**
 * "24h online support": the trigger (the child) opens a short menu of both
 * markets' WhatsApp numbers, the visitor's own first, each opening a chat in a
 * new tab. Shared by the home hero's support fact and the Contact page's one
 * gold button, so the two never drift apart.
 *
 * The menu sits above the site's floating header (z-index 60), and keeps 112px
 * clear at the top (where the header ends) so it flips rather than open under it.
 */
export function WhatsAppSupportMenu({
  children,
  message,
  onPick,
  side = "top",
  align = "end",
}: {
  /** The button that opens the menu (passed to the trigger with asChild). */
  children: ReactElement;
  /** Prefilled chat text, if any. */
  message?: string;
  /** Called with the picked market, before the chat opens (analytics). */
  onPick?: (market: Market) => void;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const { t, locale } = useI18n();
  const markets: readonly Market[] = locale === "id" ? ["id", "fr"] : ["fr", "id"];

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={10}
        collisionPadding={{ top: 112 }}
        className="bg-epi-navy-900 text-epi-cream-50 z-[70] w-64 rounded-2xl border-white/10 p-2"
      >
        <p className="text-epi-cream-50/55 m-0 px-3 pt-2 pb-1 text-[11px] tracking-[0.16em] uppercase">
          {t("redesign.landing.hero.supportPopoverTitle")}
        </p>
        <ul className="m-0 list-none p-0">
          {markets.map((market) => (
            <li key={market}>
              <a
                href={whatsappHref(WHATSAPP_NUMBERS[market].number, message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onPick?.(market)}
                className="text-epi-cream-50 hover:text-epi-gold-300 focus-visible:outline-epi-gold-300 flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-[15px] hover:bg-white/[0.06] focus-visible:outline-2"
              >
                <span className="inline-flex items-center gap-3">
                  <MarketFlag market={market} decorative className="size-6" />
                  {t(
                    `redesign.landing.hero.${market === "fr" ? "supportFrance" : "supportIndonesia"}`
                  )}
                </span>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
