"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Monitor, UtensilsCrossed, ChefHat, Grid2X2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { useKdsSettings } from "@/features/pos/hooks/use-kds-settings";

interface PosModeTabBarProps {
  storeId: string;
}

/** The POS System screen: these four routes, switched by this bar. */
export const POS_TABS = [
  { href: "/pos", labelKey: "nav.pos", icon: Monitor },
  { href: "/pos/orders", labelKey: "nav.posOrders", icon: UtensilsCrossed },
  { href: "/pos/kds", labelKey: "nav.posKds", icon: ChefHat, kdsOnly: true },
  { href: "/tables", labelKey: "nav.posTables", icon: Grid2X2 },
] as const;

export type PosTab = (typeof POS_TABS)[number];

/** Whether `pathname` is one of the POS System's tab routes (null-safe). */
export function isPosTabPath(pathname: string | null, storeId: string): boolean {
  if (!pathname) return false;
  return POS_TABS.some((tab) => pathname === `/store/${storeId}${tab.href}`);
}

/**
 * The tabs this device's persona sees — shared by the bar and the More
 * drawer's POS System row, so the row always leads to a tab the bar would
 * show. Kitchen & Bar hides when the store has its kitchen display off; a
 * staff PIN persona with restricted page access sees only what it's granted
 * (sidebar.tsx filters the Back Office rail the same way).
 */
export function usePosTabs(storeId: string): PosTab[] {
  const posSession = usePosSession();
  const { data: kdsSettings } = useKdsSettings(storeId);
  const kitchenDisplayEnabled = kdsSettings?.kitchenDisplayEnabled ?? true;

  const staffAllowedPages =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER"
      ? posSession.allowedPages
      : null;

  return POS_TABS.filter((tab) => {
    if ("kdsOnly" in tab && tab.kdsOnly && !kitchenDisplayEnabled) return false;
    if (staffAllowedPages && !staffAllowedPages.includes(tab.href)) return false;
    return true;
  });
}

/**
 * Bottom tab bar — a cashier's thumb reaches the bottom of a tablet screen;
 * a left rail costs 230px this shell doesn't have to sacrifice (see
 * docs/dashboard-revamp.md). Dapur hides entirely when the store has
 * kitchenDisplayEnabled off, mirroring sidebar.tsx's own allowedPages
 * filtering for a staff PIN persona with restricted page access. The "More"
 * menu lives in the status bar (PosModeStatusBar), not here.
 *
 * Shown on the POS System routes only — PosModeShell leaves it off the
 * Operational page (Shift, My Schedule, Clock In / Out), which the drawer
 * links to instead.
 */
export function PosModeTabBar({ storeId }: PosModeTabBarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const visibleTabs = usePosTabs(storeId);

  return (
    <nav
      className="bg-background flex h-14 shrink-0 items-stretch border-t pb-[env(safe-area-inset-bottom)]"
      aria-label={t("nav.posSystem")}
    >
      {visibleTabs.map((tab) => {
        const fullHref = `/store/${storeId}${tab.href}`;
        const active = pathname === fullHref;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={fullHref}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition active:scale-[0.97]",
              active ? "text-primary" : "text-muted-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-5" aria-hidden />
            <span className="truncate px-1">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
