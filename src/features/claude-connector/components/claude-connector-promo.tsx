"use client";

import { useContext, useEffect, useRef } from "react";
import Link from "next/link";
import { QueryClientContext } from "@tanstack/react-query";
import { MessageSquareText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useGuideState } from "@/features/guide/hooks/use-guide-state";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { LANDING_GROUPS } from "@/features/marketing/landing/registry";
import { planHasFeature, upgradeHrefFor } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";
import { useConnectedApps } from "../hooks/use-connected-apps";

/** Where the promo sits: picks the example question and tags the analytics. */
export type ClaudePromoSurface = "dashboard" | "finance" | "stock" | "schedule" | "billing";

const EXAMPLE_KEYS: Record<ClaudePromoSurface, string> = {
  dashboard: "claudeConnector.promo.exampleDashboard",
  finance: "claudeConnector.promo.exampleFinance",
  stock: "claudeConnector.promo.exampleStock",
  schedule: "claudeConnector.promo.exampleSchedule",
  billing: "claudeConnector.promo.exampleBilling",
};

interface ClaudeConnectorPromoProps {
  surface: ClaudePromoSurface;
  storeId: string;
  /** The caller's own role check (owner or manager): the promo never decides who may see money screens. */
  canView?: boolean;
  className?: string;
}

/**
 * A one-line "Ask Claude" invitation. On Operations and above it leads to the
 * connector card on the Profile page; on the POS plan it leads to the
 * Operations plan (the connector's reading tier). Free stores, and anyone who
 * has already connected Claude, don't see it. "Dismiss" is saved to the
 * viewer's guide state, so it stays gone on every device (and "Show page tips
 * again" in Help brings it back).
 *
 * A plain static import is on purpose: a lazy chunk here would reload the
 * page on first use after a deploy, and this strip sits next to screens a
 * cashier may be mid-sale on.
 */
export function ClaudeConnectorPromo(props: ClaudeConnectorPromoProps) {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient || props.canView === false) return null;
  return <PromoGate {...props} />;
}

function PromoGate(props: ClaudeConnectorPromoProps) {
  const { data } = useSubscriptionStatus();
  const subscription = data?.subscription;
  if (!subscription || subscription.status !== "ACTIVE") return null;
  const canRead = planHasFeature(subscription.plan, "claudeConnector");
  // The POS plan is the upgrade audience; Free has no counter to run yet.
  if (!canRead && subscription.plan !== "POS") return null;
  return canRead ? <ConnectedAware {...props} canRead /> : <PromoCard {...props} canRead={false} />;
}

/** Reads the connections only for plans that can have one. */
function ConnectedAware(props: ClaudeConnectorPromoProps & { canRead: true }) {
  const { data } = useConnectedApps();
  // Not loaded yet reads as "show nothing", so it never flashes in and out.
  if (!data || data.apps.length > 0) return null;
  return <PromoCard {...props} />;
}

function PromoCard({
  surface,
  storeId,
  canRead,
  className,
}: ClaudeConnectorPromoProps & { canRead: boolean }) {
  const { t, locale } = useI18n();
  const guide = useGuideState();
  const viewed = useRef(false);

  const visible = guide.isReady && guide.isAvailable && !guide.isTipDismissed("claudeConnector");

  useEffect(() => {
    if (!visible || viewed.current) return;
    viewed.current = true;
    trackEvent("claude_promo_view", { event_category: "claude_connector", surface, canRead });
  }, [visible, surface, canRead]);

  if (!visible) return null;

  const example = t(EXAMPLE_KEYS[surface]);
  const body = t(canRead ? "claudeConnector.promo.bodyTry" : "claudeConnector.promo.bodyUpgrade");
  const slug = LANDING_GROUPS["claude-connector"][locale];
  const ctaHref = canRead ? `/store/${storeId}/profile#claude` : upgradeHrefFor("OPERATIONS");

  return (
    <section
      aria-label={t("claudeConnector.promo.title")}
      className={cn(
        "border-epi-gold-500/30 bg-epi-gold-500/5 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:p-4",
        className
      )}
    >
      <MessageSquareText
        className="text-epi-gold-600 dark:text-epi-gold-400 hidden size-5 shrink-0 sm:block"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <span className="text-foreground font-semibold">{t("claudeConnector.promo.title")}</span>{" "}
        <Badge variant="outline" className="align-middle text-[10px] font-semibold">
          {t("claudeConnector.beta.label")}
        </Badge>{" "}
        <span className="text-muted-foreground">{body.replace("{example}", example)}</span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Button asChild size="sm" className="h-10 px-4">
          <Link
            href={ctaHref}
            onClick={() =>
              trackEvent("claude_promo_click", {
                event_category: "claude_connector",
                surface,
                canRead,
              })
            }
          >
            {t(canRead ? "claudeConnector.promo.ctaTry" : "claudeConnector.promo.ctaUpgrade")}
          </Link>
        </Button>
        {slug && (
          <Button asChild variant="ghost" size="sm" className="h-10 px-3">
            <Link href={getLocalizedPath(`/${slug}`, locale)} target="_blank" rel="noopener">
              {t("claudeConnector.promo.learnMore")}
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label={t("claudeConnector.promo.dismiss")}
          onClick={() => {
            trackEvent("claude_promo_dismiss", { event_category: "claude_connector", surface });
            guide.dismissTip("claudeConnector");
          }}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
