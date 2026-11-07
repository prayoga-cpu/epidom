"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON } from "./landing-ui";

/**
 * Where the bar steps aside: the two sections that already carry the trial
 * button, and the footer (whose last lines the bar would otherwise cover).
 */
const OWN_CTA_SECTIONS = [
  '[aria-labelledby="hero-title"]',
  '[aria-labelledby="final-cta-title"]',
  "footer",
];

/**
 * The home page's sticky "Start the 14-day POS trial · No card needed" bar, on
 * phones and tablets only (below `lg`: the header keeps its own button on a
 * wide screen). It shows once the hero has scrolled away and hides while the
 * hero, the closing call to action or the footer is on screen, so it never
 * doubles a button that is already in view or covers the footer's links.
 * Under the cookie bar (z-40 vs z-50), with room for the phone's home
 * indicator.
 */
export function MobileTrialBar() {
  const { t } = useI18n();
  const trialHref = usePosTrialHref();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = OWN_CTA_SECTIONS.map((selector) => document.querySelector(selector)).filter(
      (el): el is Element => el !== null
    );
    if (targets.length === 0) return;
    const onScreen = new Set<Element>(targets);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setVisible(onScreen.size === 0);
    });
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "bg-epi-navy-950/90 fixed inset-x-0 bottom-0 z-40 border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 ease-[var(--epi-ease-out)] motion-reduce:transition-none lg:hidden",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <Link
          href={trialHref}
          onClick={() =>
            trackEvent("cta_click", { event_category: "engagement", event_label: "sticky_trial" })
          }
          className={cn(PRIMARY_BUTTON, "min-h-12 flex-1 px-4 text-sm")}
        >
          {t("redesign.landing.hero.trialCta")}
        </Link>
        <span className="text-epi-cream-50/70 w-20 shrink-0 text-xs leading-tight">
          {t("redesign.landing.hero.noCard")}
        </span>
      </div>
    </div>
  );
}
