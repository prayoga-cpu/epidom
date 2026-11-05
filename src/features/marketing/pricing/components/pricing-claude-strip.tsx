"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { LANDING_GROUPS } from "@/features/marketing/landing/registry";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/lib/i18n-routing";

/**
 * One line under the pricing hero (and on the Features page): the Claude connector is a reason to pick
 * Operations, and the connector page explains it. A plain link, no state.
 */
export function PricingClaudeStrip({ surface = "pricing" }: { surface?: "pricing" | "services" | "home" }) {
  const { t, locale } = useI18n();
  const slug = LANDING_GROUPS["claude-connector"][locale];
  if (!slug) return null;

  return (
    <div className="epi-container" style={{ textAlign: "center", paddingBottom: 24 }}>
      <p
        style={{
          margin: "0 auto",
          maxWidth: 720,
          fontSize: 15,
          lineHeight: 1.6,
          color: "rgba(251,249,228,0.78)",
        }}
      >
        {t("redesign.pricingPage.claudeStrip")}{" "}
        <Link
          href={getLocalizedPath(`/${slug}`, locale)}
          onClick={() =>
            trackEvent("claude_promo_click", {
              event_category: "claude_connector",
              surface,
            })
          }
          style={{ color: "var(--epi-gold-500)", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {t("redesign.pricingPage.claudeStripLink")}
        </Link>
      </p>
    </div>
  );
}
