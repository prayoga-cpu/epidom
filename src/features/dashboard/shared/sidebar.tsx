/**
 * Dashboard Sidebar Component
 *
 * Renders navigation sidebar with navigation links, store switcher, and language selector.
 * Supports both desktop and mobile layouts.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/lang/i18n-provider";
import { useAlertsCount } from "@/features/dashboard/alerts/hooks/use-alerts-count";
import { useCurrentStore } from "./hooks/use-current-store";
import { dashboardNavigation, type NavSection, type PlanTier } from "@/config/navigation.config";
import LangSwitcher from "@/components/lang/lang-switcher";
import { StoreSwitcher } from "./store-switcher";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";

const PLAN_ORDER: PlanTier[] = ["FREE", "POS", "OPERATIONS", "ENTERPRISE"];

function planRank(plan: PlanTier): number {
  return PLAN_ORDER.indexOf(plan);
}

const PLAN_LABELS: Record<PlanTier, string> = {
  FREE: "Free",
  POS: "POS",
  OPERATIONS: "Operations",
  ENTERPRISE: "Enterprise",
};

interface SidebarProps {
  mode?: "desktop" | "mobile";
  navigation?: NavSection[];
}

export function Sidebar({ mode = "desktop", navigation = dashboardNavigation }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  const alertsCount = useAlertsCount();
  const { data: subData } = useSubscriptionStatus();

  const currentPlan: PlanTier = (subData?.subscription?.plan as PlanTier) ?? "FREE";

  function hasAccess(requiredPlan?: PlanTier): boolean {
    if (!requiredPlan) return true;
    return planRank(currentPlan) >= planRank(requiredPlan);
  }

  const getBadgeCount = (badgeKey?: string): number | null => {
    if (!badgeKey) return null;
    return badgeKey === "alerts" ? alertsCount : null;
  };

  return (
    <aside
      className={cn(
        mode === "desktop"
          ? "hidden h-full w-[230px] shrink-0 md:block"
          : "mt-12 flex h-full md:hidden"
      )}
    >
      <div className="scrollbar-thin bg-card flex h-full w-full flex-col overflow-y-auto rounded-xl border shadow-sm">
        {mode === "mobile" && (
          <div className="border-b p-3">
            <div className="relative">
              <Search className="text-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder={t("actions.searchPlaceholder")}
                aria-label={t("actions.searchPlaceholder")}
                className="h-9 rounded-full pl-9"
              />
            </div>
          </div>
        )}
        <nav className="flex-1 p-3">
          {navigation.map((section, sectionIndex) => (
            <div key={sectionIndex} className={sectionIndex > 0 ? "mt-4" : ""}>
              {section.title && (
                <h3 className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-1.5">
                {section.items.map((item) => {
                  const fullHref = storeId ? `/store/${storeId}${item.href}` : item.href;
                  const active = pathname === fullHref;
                  const label = t(item.labelKey);
                  const Icon = item.icon;
                  const badge = getBadgeCount(item.badgeKey);
                  const locked = !hasAccess(item.requiredPlan);
                  const upgradeLabel = item.requiredPlan
                    ? `Upgrade to ${PLAN_LABELS[item.requiredPlan]}`
                    : undefined;

                  if (locked) {
                    return (
                      <li key={item.href}>
                        <Link
                          href="/pricing#plans"
                          title={upgradeLabel}
                          className="group flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition text-muted-foreground/40 hover:bg-amber-500/8 hover:text-amber-500/70 cursor-pointer"
                        >
                          <span className="flex items-center gap-3">
                            <Icon className="size-4" aria-hidden />
                            <span>{label}</span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500/50 group-hover:text-amber-500 transition-colors whitespace-nowrap">
                            <Lock className="size-3" />
                            {item.requiredPlan && PLAN_LABELS[item.requiredPlan]}
                          </span>
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={item.href}>
                      <Link
                        href={fullHref}
                        prefetch={true}
                        className={cn(
                          "group flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition",
                          active
                            ? "bg-muted/60 text-foreground shadow-inner"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="size-4" aria-hidden />
                          {label}
                        </span>
                        {badge !== null && badge > 0 && (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white shadow-sm animate-in fade-in"
                            aria-label={`${badge} ${item.badgeKey}`}
                          >
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        {mode === "mobile" && (
          <div className="border-t space-y-3 p-3">
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                {t("dashboard.storeSelector.label")}
              </span>
              <div className="[&_button]:w-full [&_button]:min-w-0 [&_button]:max-w-none">
                <StoreSwitcher />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                {t("language.label")}
              </span>
              <LangSwitcher className="w-full" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
