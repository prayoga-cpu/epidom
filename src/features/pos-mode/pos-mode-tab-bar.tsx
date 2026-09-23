"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Monitor, UtensilsCrossed, ChefHat, Grid2X2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { useKdsSettings } from "@/features/pos/hooks/use-kds-settings";

interface PosModeTabBarProps {
  storeId: string;
  onOverflowClick: () => void;
}

const TABS = [
  { href: "/pos", labelKey: "nav.pos", icon: Monitor },
  { href: "/pos/orders", labelKey: "nav.posOrders", icon: UtensilsCrossed },
  { href: "/pos/kds", labelKey: "nav.posKds", icon: ChefHat, kdsOnly: true },
  { href: "/tables", labelKey: "nav.posTables", icon: Grid2X2 },
] as const;

/**
 * Bottom tab bar — a cashier's thumb reaches the bottom of a tablet screen;
 * a left rail costs 230px this shell doesn't have to sacrifice (see
 * docs/dashboard-revamp.md). Dapur hides entirely when the store has
 * kitchenDisplayEnabled off, mirroring sidebar.tsx's own allowedPages
 * filtering for a staff PIN persona with restricted page access.
 */
export function PosModeTabBar({ storeId, onOverflowClick }: PosModeTabBarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const posSession = usePosSession();
  const { data: kdsSettings } = useKdsSettings(storeId);
  const kitchenDisplayEnabled = kdsSettings?.kitchenDisplayEnabled ?? true;

  const staffAllowedPages =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER"
      ? posSession.allowedPages
      : null;

  const visibleTabs = TABS.filter((tab) => {
    if ("kdsOnly" in tab && tab.kdsOnly && !kitchenDisplayEnabled) return false;
    if (staffAllowedPages && !staffAllowedPages.includes(tab.href)) return false;
    return true;
  });

  return (
    <nav
      className="bg-background flex h-14 shrink-0 items-stretch border-t pb-[env(safe-area-inset-bottom)]"
      aria-label={t("nav.pos")}
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
      <button
        type="button"
        onClick={onOverflowClick}
        className="text-muted-foreground flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition active:scale-[0.97]"
        aria-label={t("common.actions.more")}
      >
        <MoreHorizontal className="size-5" aria-hidden />
        <span className="truncate px-1">{t("common.actions.more")}</span>
      </button>
    </nav>
  );
}
