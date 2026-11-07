"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import { useAlertsCount } from "@/features/dashboard/alerts/hooks/use-alerts-count";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { planRank, PLAN_LABELS, upgradeHrefFor } from "@/lib/plans/entitlements";
import type { NavItem, PlanTier } from "@/config/navigation.config";
import { useCurrentStore } from "./hooks/use-current-store";

/**
 * What every nav row needs to decide how to render: where the store is, which
 * page is open, what the plan covers and what a staff persona may see. Shared
 * by the phone drawer and the desktop sidebar so the two never disagree.
 */
export function useNavContext() {
  const pathname = usePathname();
  const { storeId } = useCurrentStore();
  const alertsCount = useAlertsCount();
  const { data: subData } = useSubscriptionStatus();
  const posSession = usePosSession();

  const currentPlan: PlanTier = (subData?.subscription?.plan as PlanTier) ?? "FREE";

  // Role-based, not ID-based: a StaffMember row can itself have role "OWNER"
  // (e.g. seeded accounts) and is functionally unrestricted, same as the
  // synthetic "owner" bypass login.
  const staffAllowedPages =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER"
      ? posSession.allowedPages
      : null;

  function hasAccess(requiredPlan: PlanTier | undefined, href: string): boolean {
    if (requiredPlan && planRank(currentPlan) < planRank(requiredPlan)) return false;
    if (staffAllowedPages && !staffAllowedPages.includes(href)) return false;
    return true;
  }

  return { pathname, storeId, alertsCount, currentPlan, staffAllowedPages, hasAccess };
}
export type NavContext = ReturnType<typeof useNavContext>;

/**
 * `storeId` comes from `useParams()`, so it's only populated while the sidebar
 * is mounted under `/store/[storeId]/…`: an error/not-found boundary leaves it
 * undefined. `/go/*` is the store launcher: it resolves the signed-in user's
 * store server-side and redirects to `/store/{storeId}{item.href}`, so the
 * fallback always lands on a real page (a bare `/dashboard` would 404).
 */
export function navItemHref(item: NavItem, storeId: string | undefined): string {
  return storeId ? `/store/${storeId}${item.route ?? item.href}` : `/go${item.href}`;
}

/** One row of a section's list. Renders nothing for a page a staff persona may not open. */
export function NavItemLink({ item, ctx }: { item: NavItem; ctx: NavContext }) {
  const { t } = useI18n();
  const { storeId, pathname, alertsCount, staffAllowedPages, hasAccess } = ctx;

  const fullHref = navItemHref(item, storeId);
  const active = pathname === fullHref;
  const label = t(item.labelKey);
  const Icon = item.icon;
  const badge = item.badgeKey === "alerts" ? alertsCount : null;

  // A staff persona without access to this page just never sees it: unlike a
  // plan-tier lock, there's no upgrade path to show.
  if (staffAllowedPages !== null && !staffAllowedPages.includes(item.href)) return null;

  if (!hasAccess(item.requiredPlan, item.href)) {
    // Locked items route to the pricing/upgrade flow (POS → trial promo),
    // consistent with the requirePlan redirect and the upgrade modal.
    const lockedHref = item.requiredPlan ? upgradeHrefFor(item.requiredPlan) : "/pricing#plans";
    const upgradeLabel = item.requiredPlan
      ? `Upgrade to ${PLAN_LABELS[item.requiredPlan]}`
      : undefined;
    // Event/benefit-framed copy (STRATEGY.md §5: "upgrade prompts should explain
    // the event... rather than the feature"): an always-visible second line, not
    // a hover title, which a phone never shows. See docs/back-office-revamp.md.
    const lockedHint = item.lockedHintKey ? t(item.lockedHintKey) : undefined;
    return (
      <li>
        <Link
          href={lockedHref}
          title={upgradeLabel}
          className="group text-muted-foreground/40 flex cursor-pointer items-start justify-between gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-amber-500/8 hover:text-amber-500/70 active:scale-[0.98]"
        >
          <span className="flex min-w-0 items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{label}</span>
              {lockedHint && (
                <span className="text-muted-foreground/50 truncate text-[11px] font-normal">
                  {lockedHint}
                </span>
              )}
            </span>
          </span>
          <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[10px] font-medium whitespace-nowrap text-amber-500/50 transition-colors group-hover:text-amber-500">
            <Lock className="size-3 shrink-0" />
            {item.requiredPlan && PLAN_LABELS[item.requiredPlan]}
          </span>
        </Link>
      </li>
    );
  }

  // No explicit `prefetch`: Next's default stops at the nearest `loading.tsx`, so
  // each in-viewport link prefetches the shared shell and the skeleton rather
  // than the page's own server work (the Finance aggregation, the Data page's
  // parallel reads), which would otherwise run a dozen at a time against a
  // serverless Postgres pool. If that load ever needs to drop further, the next
  // lever is `prefetch={false}` on the non-primary items.
  return (
    <li>
      <Link
        href={fullHref}
        className={cn(
          "group flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition active:scale-[0.98]",
          active
            ? "bg-muted/60 text-foreground shadow-inner"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        )}
        aria-current={active ? "page" : undefined}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        {badge !== null && badge > 0 && (
          <span
            className="animate-in fade-in flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white shadow-sm"
            aria-label={`${badge} ${item.badgeKey}`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    </li>
  );
}
