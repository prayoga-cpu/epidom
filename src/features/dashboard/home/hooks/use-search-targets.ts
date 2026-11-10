"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  ChartNoAxesCombined,
  MonitorSmartphone,
  Package,
  Settings,
  ShoppingCart,
  Smartphone,
  TicketPercent,
  BookOpen,
  FileText,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getAllAppNavItems, type NavItem, type PlanTier } from "@/config/navigation.config";
import { customerDisplayPath } from "@/features/pos/lib/customer-display";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { planRank, upgradeHrefFor } from "@/lib/plans/entitlements";
import { SETTINGS_SECTIONS } from "../lib/settings-sections";
import { FEATURE_INDEX } from "../lib/feature-index";
import type { AiMatch } from "./use-ai-search";
import { RECENT_VISITS_EVENT, readRecentVisits, type RecentVisit } from "@/lib/recent-visits";
import { todayLocalISO } from "@/lib/utils/date-range";

/** Something the search can open: an action, a page, or a suggested phrase. */
export interface SearchTarget {
  id: string;
  label: string;
  keywords: string;
  icon: LucideIcon;
  /** In-store path (with query), or the already-absolute customer display path. */
  href: string;
  /** Grant key a staff persona needs (the nav href), and the plan that unlocks it. */
  gate: string;
  plan?: PlanTier;
  newWindow?: boolean;
}

export interface RecentCard {
  visit: RecentVisit;
  item: NavItem;
}

const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Everything the Home search and the ⌘K search share: the quick actions, the
 * suggested phrases, every page, this device's recently visited pages, and what
 * a plan or a staff persona may open. One place, so the two searches never
 * disagree about what is locked or hidden.
 */
export function useSearchTargets(storeId: string) {
  const { t, intlLocale, locale } = useI18n();
  const router = useRouter();
  const posSession = usePosSession();
  const { data: subData } = useSubscriptionStatus();
  const plan: PlanTier = (subData?.subscription?.plan as PlanTier) ?? "FREE";
  const [recent, setRecent] = useState<RecentVisit[]>([]);

  // Recents are device-local: read after mount so the server render and the
  // first client render agree, and follow every visit.
  useEffect(() => {
    const load = () => setRecent(readRecentVisits(storeId));
    load();
    window.addEventListener(RECENT_VISITS_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(RECENT_VISITS_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [storeId]);

  const staffAllowed =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER"
      ? posSession.allowedPages
      : null;

  const base = `/store/${storeId}`;
  const A = useCallback(
    (key: string, field: "label" | "keywords") => t(`home.actions.${key}.${field}`),
    [t]
  );

  const actions: SearchTarget[] = useMemo(
    () => [
      {
        id: "newOrder",
        label: A("newOrder", "label"),
        keywords: A("newOrder", "keywords"),
        icon: ShoppingCart,
        href: `${base}/pos`,
        gate: "/pos",
        plan: "POS",
      },
      {
        id: "phoneOrders",
        label: t("nav.storefront"),
        keywords: A("phoneOrders", "keywords"),
        icon: Smartphone,
        href: `${base}/storefront`,
        gate: "/storefront",
      },
      {
        id: "products",
        label: A("products", "label"),
        keywords: A("products", "keywords"),
        icon: Package,
        href: `${base}/storefront?tab=menu`,
        gate: "/storefront",
      },
      {
        id: "reports",
        label: A("reports", "label"),
        keywords: A("reports", "keywords"),
        icon: BarChart3,
        href: `${base}/finance`,
        gate: "/finance",
        plan: "OPERATIONS",
      },
      {
        id: "import",
        label: A("import", "label"),
        keywords: A("import", "keywords"),
        icon: Upload,
        href: `${base}/data`,
        gate: "/data",
        plan: "OPERATIONS",
      },
      {
        id: "staff",
        label: t("nav.staff"),
        keywords: A("staff", "keywords"),
        icon: Users,
        href: `${base}/staff`,
        gate: "/staff",
        plan: "OPERATIONS",
      },
      {
        id: "customerScreen",
        label: A("customerScreen", "label"),
        keywords: A("customerScreen", "keywords"),
        icon: MonitorSmartphone,
        href: customerDisplayPath(storeId),
        gate: "/pos",
        plan: "POS",
        newWindow: true,
      },
      {
        id: "analytics",
        label: t("nav.dashboard"),
        keywords: A("analytics", "keywords"),
        icon: ChartNoAxesCombined,
        // The page is /analytics; its permission key is still "/dashboard".
        href: `${base}/analytics`,
        gate: "/dashboard",
      },
      {
        id: "alerts",
        label: t("nav.alerts"),
        keywords: A("alerts", "keywords"),
        icon: AlertTriangle,
        href: `${base}/alerts`,
        gate: "/alerts",
        plan: "OPERATIONS",
      },
      {
        id: "settings",
        label: A("settings", "label"),
        keywords: A("settings", "keywords"),
        icon: Settings,
        href: `${base}/profile`,
        gate: "/profile",
      },
    ],
    [t, A, base, storeId]
  );

  // Phrases the search suggests; they reuse an action's destination.
  const examples: SearchTarget[] = useMemo(() => {
    const today = todayLocalISO();
    const by = (id: string) => actions.find((a) => a.id === id)!;
    return [
      { ...by("newOrder"), id: "ex-new", label: A("newOrder", "label") },
      {
        ...by("reports"),
        id: "ex-profit",
        label: A("todaysProfit", "label"),
        keywords: A("todaysProfit", "keywords"),
        href: `${base}/finance?from=${today}&to=${today}`,
      },
      {
        ...by("products"),
        id: "ex-add",
        label: A("addProduct", "label"),
        keywords: A("addProduct", "keywords"),
      },
      {
        ...by("import"),
        id: "ex-csv",
        label: A("importCsv", "label"),
        keywords: A("importCsv", "keywords"),
      },
    ];
  }, [actions, A, base]);

  const pages: SearchTarget[] = useMemo(
    () => [
      ...getAllAppNavItems().map((item) => ({
        id: `page-${item.href}`,
        label: t(item.labelKey),
        keywords: "",
        icon: item.icon,
        href: `${base}${item.route ?? item.href}`,
        gate: item.href,
        plan: item.requiredPlan,
      })),
      // Two tabs people look for by name (they have no page of their own).
      {
        id: "page-supplier-orders",
        label: t("management.supplierOrders.title"),
        keywords: t("management.supplierOrders.description"),
        icon: FileText,
        href: `${base}/management?tab=delivery`,
        gate: "/management",
        plan: "OPERATIONS" as PlanTier,
      },
      {
        id: "page-promotions",
        label: t("promotions.tab"),
        keywords: t("promotions.searchDescription"),
        icon: TicketPercent,
        href: `${base}/data?tab=promotions`,
        gate: "/data",
        plan: "OPERATIONS" as PlanTier,
      },
      // Every card on the Settings page, so "tax", "wifi" or "pajak" lands on the right one.
      ...SETTINGS_SECTIONS.map((s) => ({
        id: `settings-${s.id}`,
        label: `${t("home.actions.settings.label")} · ${t(s.labelKey)}`,
        keywords: s.keywords,
        icon: s.icon,
        href: `${base}/profile#${s.anchor}`,
        gate: "/profile",
      })),
      // Tabs, buttons and how-tos that live inside a page ("import my menu", "split the bill").
      ...FEATURE_INDEX.map((f) => ({
        id: `feat-${f.id}`,
        label: f.label[(locale as "en" | "id" | "fr") ?? "en"] ?? f.label.en,
        keywords: `${f.label.en} ${f.label.id} ${f.label.fr} ${f.keywords}`,
        icon: f.icon,
        href: `${base}${f.href}`,
        gate: f.gate,
        plan: f.plan,
      })),
    ],
    [t, base, locale]
  );

  const visible = useCallback(
    (x: SearchTarget) => !staffAllowed || !x.gate || staffAllowed.includes(x.gate),
    [staffAllowed]
  );
  const locked = useCallback(
    (x: SearchTarget) => !!x.plan && planRank(plan) < planRank(x.plan),
    [plan]
  );
  const hrefOf = useCallback(
    (x: SearchTarget) => (locked(x) ? upgradeHrefFor(x.plan!) : x.href),
    [locked]
  );

  /** Actions and pages matching `query` (label or keywords, accent- and case-insensitive); null for an empty query. */
  const search = useCallback(
    (query: string) => {
      const q = fold(query.trim());
      if (!q) return null;
      const hit = (x: SearchTarget) => visible(x) && fold(`${x.label} ${x.keywords}`).includes(q);
      return {
        actions: [...actions, ...examples.filter((e) => e.id !== "ex-new")].filter(hit),
        pages: pages.filter(hit),
      };
    },
    [actions, examples, pages, visible]
  );

  /** The assistant's picks as targets: our own entry when it has one, else a guide link. Hidden/locked rules apply. */
  const resolveAi = useCallback(
    (matches: AiMatch[]): SearchTarget[] =>
      matches
        .map((m) => {
          const own = pages.find((p) => p.id === m.id);
          if (own) return own;
          if (!m.id.startsWith("guide-")) return null;
          return {
            id: m.id,
            label: m.label.replace(/^Guide:\s*/, ""),
            keywords: "",
            icon: BookOpen,
            href: `${base}${m.href}`,
            gate: "",
          } satisfies SearchTarget;
        })
        .filter((x): x is SearchTarget => x !== null && visible(x)),
    [pages, base, visible]
  );

  const open = useCallback(
    (x: SearchTarget) => {
      const href = hrefOf(x);
      if (x.newWindow && !locked(x)) window.open(href, "_blank", "noopener");
      else router.push(href);
    },
    [hrefOf, locked, router]
  );

  const recentCards: RecentCard[] = useMemo(
    () =>
      recent
        .map((visit) => {
          const item = getAllAppNavItems().find((n) => (n.route ?? n.href) === visit.section);
          return item ? { visit, item } : null;
        })
        .filter(
          (c): c is RecentCard =>
            c !== null && (!staffAllowed || staffAllowed.includes(c.item.href))
        ),
    [recent, staffAllowed]
  );

  const when = useCallback(
    (at: number) => {
      const d = new Date(at);
      if (Date.now() - at < 60_000) return t("home.recent.justNow");
      return d.toDateString() === new Date().toDateString()
        ? d.toLocaleTimeString(intlLocale, { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString(intlLocale, { month: "short", day: "numeric" });
    },
    [t, intlLocale]
  );

  return {
    actions,
    examples,
    pages,
    staffAllowed,
    visible,
    locked,
    hrefOf,
    search,
    resolveAi,
    locale,
    open,
    recentCards,
    when,
  };
}
