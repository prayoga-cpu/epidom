import {
  LayoutDashboard,
  UserRound,
  Boxes,
  Database,
  AlertTriangle,
  Home,
  Briefcase,
  CreditCard,
  Mail,
  Store,
  Monitor,
  UtensilsCrossed,
  ChefHat,
  Factory,
  Grid2X2,
  Users,
  BarChart3,
  MenuSquare,
  Wrench,
  CalendarDays,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation Configuration
 *
 * Centralized navigation structure following Open/Closed Principle.
 * To add new navigation items, simply add them to this config.
 */

export type PlanTier = "FREE" | "POS" | "OPERATIONS" | "ENTERPRISE";

export interface NavItem {
  href: string;
  labelKey: string; // i18n translation key
  icon: LucideIcon;
  showBadge?: boolean;
  badgeKey?: string; // Optional key for badge count (e.g., "alerts")
  requiredPlan?: PlanTier; // Minimum plan needed; undefined = always accessible
}

export interface NavSection {
  title?: string; // Optional section title
  items: NavItem[];
}

/**
 * Dashboard navigation items
 */
export const dashboardNavigation: NavSection[] = [
  {
    title: "General",
    items: [
      {
        href: "/profile",
        labelKey: "nav.profile",
        icon: UserRound,
        showBadge: false,
      },
      {
        href: "/storefront",
        labelKey: "nav.storefront",
        icon: Store,
        showBadge: false,
      },
      {
        href: "/dashboard",
        labelKey: "nav.dashboard",
        icon: LayoutDashboard,
        showBadge: false,
      },
      {
        href: "/billing",
        labelKey: "nav.billing",
        icon: CreditCard,
        showBadge: false,
      },
    ],
  },
  {
    // /pos, /pos/orders, /pos/kds, /pos/display and /tables deliberately
    // don't appear here — they live in the (pos-mode) shell now, its own
    // bottom tab bar, not this rail (docs/dashboard-revamp.md). /menu stays:
    // it's Back Office (menu *management*, not the live cashier screen).
    title: "Point of Sale",
    items: [
      {
        href: "/menu",
        labelKey: "nav.menu",
        icon: MenuSquare,
        showBadge: false,
        requiredPlan: "POS",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/data",
        labelKey: "nav.data",
        icon: Database,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/management",
        labelKey: "nav.management",
        icon: Boxes,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/production",
        labelKey: "nav.production",
        icon: Factory,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/alerts",
        labelKey: "nav.alerts",
        icon: AlertTriangle,
        showBadge: true,
        badgeKey: "alerts",
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/staff",
        labelKey: "nav.staff",
        icon: Users,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/schedule",
        labelKey: "nav.schedule",
        icon: CalendarDays,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
    ],
  },
  {
    title: "Enterprise",
    items: [
      {
        href: "/finance",
        labelKey: "nav.finance",
        icon: BarChart3,
        showBadge: false,
        requiredPlan: "ENTERPRISE",
      },
      {
        href: "/custom-development",
        labelKey: "nav.customDevelopment",
        icon: Wrench,
        showBadge: false,
        requiredPlan: "ENTERPRISE",
      },
    ],
  },
];

/**
 * Landing page navigation items (for marketing/public pages)
 */
export const landingNavigation: NavItem[] = [
  {
    href: "/",
    labelKey: "common.nav.home",
    icon: Home,
  },
  {
    href: "/services",
    labelKey: "common.nav.features",
    icon: Briefcase,
  },
  {
    href: "/pricing",
    labelKey: "common.nav.pricing",
    icon: CreditCard,
  },
  {
    href: "/contact",
    labelKey: "common.nav.contact",
    icon: Mail,
  },
];

/**
 * Authenticated navigation items (for logged-in users)
 *
 * Profile is deliberately absent here — it's account/business/billing detail
 * that only belongs inside a specific store's own dashboard (see
 * dashboardNavigation's "General" section), never on the top-level shell
 * shown before a store is picked.
 */
export const authenticatedNavigation: NavItem[] = [
  {
    href: "/stores",
    labelKey: "common.nav.stores", // Will use "My Stores" as fallback
    icon: Store,
  },
];

/**
 * Get all navigation items flattened
 */
export function getAllDashboardNavItems(): NavItem[] {
  return dashboardNavigation.flatMap((section) => section.items);
}

/**
 * Every page in the app a staff member could be granted access to —
 * dashboardNavigation's items plus posModeNavItems. Callers that mean "every
 * grantable/launchable page" (permission validation, the account-access
 * summary dialog, the feedback page-picker, the /go/* store launcher) should
 * use this, not getAllDashboardNavItems() alone — that one is scoped to the
 * Back Office rail specifically and silently excludes POS Mode's routes by
 * design (see posModeNavItems' own doc comment).
 */
export function getAllAppNavItems(): NavItem[] {
  return [...getAllDashboardNavItems(), ...posModeNavItems];
}

/**
 * POS Mode's own routes — deliberately NOT part of dashboardNavigation (they
 * render in the (pos-mode) shell's bottom tab bar, not the Back Office rail;
 * see docs/dashboard-revamp.md). Exported separately so callers that need
 * the full grantable-page universe (staff-permissions.config.ts's
 * ALL_STAFF_PAGES) or an owner-facing permission checklist
 * (page-access-checklist.tsx) can still list them without adding them back
 * to the rail.
 */
export const posModeNavItems: NavItem[] = [
  { href: "/pos", labelKey: "nav.pos", icon: Monitor, requiredPlan: "POS" },
  { href: "/pos/orders", labelKey: "nav.posOrders", icon: UtensilsCrossed, requiredPlan: "POS" },
  { href: "/pos/kds", labelKey: "nav.posKds", icon: ChefHat, requiredPlan: "POS" },
  { href: "/tables", labelKey: "nav.posTables", icon: Grid2X2, requiredPlan: "POS" },
  {
    href: "/pos/schedule",
    labelKey: "pages.scheduleMyScheduleTitle",
    icon: CalendarClock,
    requiredPlan: "POS",
  },
];

/**
 * Get navigation items by variant
 */
export function getNavigationByVariant(variant: "landing" | "authenticated"): NavItem[] {
  return variant === "landing" ? landingNavigation : authenticatedNavigation;
}
