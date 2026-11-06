"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { HeroSearchModal } from "./hero-search-modal";
import { PRIMARY_BUTTON } from "./landing-ui";

/**
 * The hero's "find your store" card. It looks like a search field but is the
 * way in to one: a tap opens the search (a centred modal on desktop, a drawer
 * that rises from the bottom on a phone) with the keyboard already up, so the
 * hero itself never has to carry the results.
 */
export function HeroStoreSearch({ registerHref }: { registerHref: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 w-full max-w-lg sm:mt-[clamp(1.5rem,4svh,2.5rem)]">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          trackEvent("hero_store_search", { cta: "open_search" });
        }}
        className="focus-visible:border-epi-gold-400 flex min-h-[4.25rem] w-full cursor-text items-center gap-2.5 rounded-full border border-white/30 bg-white/[0.12] py-2 pr-2 pl-6 text-left shadow-[0_0_0_4px_rgba(217,174,59,0.12),0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur transition-colors hover:border-white/35 focus-visible:outline-none"
      >
        <Search aria-hidden="true" className="text-epi-cream-50/70 size-6 shrink-0" />
        <span className="sr-only">{t("redesign.landing.hero.searchLabel")}</span>
        {/* On a phone only "@": the domain left the placeholder no room ("yo…"). */}
        <span aria-hidden="true" className="text-epi-cream-50/70 text-lg select-none">
          <span className="hidden sm:inline">epidom.fr/</span>@
        </span>
        <span aria-hidden="true" className="text-epi-cream-50/45 min-w-0 flex-1 truncate text-lg">
          {t("redesign.landing.hero.searchPlaceholder")}
        </span>
        <span aria-hidden="true" className={cn(PRIMARY_BUTTON, "min-h-12 px-6")}>
          {t("redesign.landing.hero.searchButton")}
        </span>
      </button>

      <HeroSearchModal open={open} onOpenChange={setOpen} registerHref={registerHref} />
    </div>
  );
}
