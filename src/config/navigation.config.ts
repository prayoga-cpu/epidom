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
  Building2,
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
  /** i18n key for a locked item's second line — the business EVENT that earns
   * this tier, not a generic "Upgrade to X" (STRATEGY.md §5: "upgrade prompts
   * should explain the event... rather than the feature"). Rendered as a
   * visible line under the label, not a hover title — a title is invisible
   * on the mobile drawer, the device this shell's own spec names for "a solo
   * owner checking in." See sidebar.tsx. */
  lockedHintKey?: string;
}

export interface NavSection {
  title?: string; // Optional section title
  items: NavItem[];
}

/**
 * Dashboard navigation items — grouped by job-to-be-done within the plan-tier
 * skeleton (docs/back-office-revamp.md): General (always-visible product
 * surfaces), Operations (run the back-of-house, all OPERATIONS-tier),
 * Reports (pure reporting/rollup, all ENTERPRISE-tier), Account (your
 * relationship with Epidom as a platform — billing, support, profile).
 *
 * /menu and POS Mode's own routes are deliberately absent — see
 * grantableOnlyNavItems and posModeNavItems below for why.
 */
export const dashboardNavigation: NavSection[] = [
  {
    title: "General",
    items: [
      {
        href: "/dashboard",
        labelKey: "nav.dashboard",
        icon: LayoutDashboard,
        showBadge: false,
      },
      {
        href: "/storefront",
        labelKey: "nav.storefront",
        icon: Store,
        showBadge: false,
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
        lockedHintKey: "nav.lockedHint.data",
      },
      {
        href: "/management",
        labelKey: "nav.management",
        icon: Boxes,
        showBadge: false,
        requiredPlan: "OPERATIONS",
        lockedHintKey: "nav.lockedHint.management",
      },
      {
        href: "/production",
        labelKey: "nav.production",
        icon: Factory,
        showBadge: false,
        requiredPlan: "OPERATIONS",
        lockedHintKey: "nav.lockedHint.production",
      },
      {
        href: "/alerts",
        labelKey: "nav.alerts",
        icon: AlertTriangle,
        showBadge: true,
        badgeKey: "alerts",
        requiredPlan: "OPERATIONS",
        lockedHintKey: "nav.lockedHint.alerts",
      },
      {
        href: "/staff",
        labelKey: "nav.staff",
        icon: Users,
        showBadge: false,
        requiredPlan: "OPERATIONS",
        lockedHintKey: "nav.lockedHint.staff",
      },
      {
        href: "/schedule",
        labelKey: "nav.schedule",
        icon: CalendarDays,
        showBadge: false,
        requiredPlan: "OPERATIONS",
        lockedHintKey: "nav.lockedHint.schedule",
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        href: "/finance",
        labelKey: "nav.finance",
        icon: BarChart3,
        showBadge: false,
        requiredPlan: "ENTERPRISE",
        lockedHintKey: "nav.lockedHint.finance",
      },
      {
        href: "/owner",
        labelKey: "nav.owner",
        icon: Building2,
        showBadge: false,
        requiredPlan: "ENTERPRISE",
        lockedHintKey: "nav.lockedHint.owner",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        href: "/profile",
        labelKey: "nav.profile",
        icon: UserRound,
        showBadge: false,
      },
      {
        href: "/billing",
        labelKey: "nav.billing",
        icon: CreditCard,
        showBadge: false,
      },
      {
        href: "/custom-development",
        labelKey: "nav.customDevelopment",
        icon: Wrench,
        showBadge: false,
        requiredPlan: "ENTERPRISE",
        lockedHintKey: "nav.lockedHint.customDevelopment",
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
 * Grantable pages with no dashboardNavigation entry, deliberately — not
 * because they're POS Mode routes (see posModeNavItems below), but because
 * two different pages used to grant the exact same functionality and one
 * (the standalone /menu page) was retired in favor of the other (Storefront's
 * Menu tab, /storefront?tab=menu — see docs/back-office-revamp.md). A staff
 * member could already be granted "/menu" without "/storefront" (Storefront
 * also exposes WhatsApp number, hours, and other business settings /menu
 * doesn't) — keeping /menu grantable-but-not-rail preserves that narrower
 * permission with no StaffMember.allowedPages migration needed.
 */
export const grantableOnlyNavItems: NavItem[] = [
  { href: "/menu", labelKey: "nav.menu", icon: MenuSquare, requiredPlan: "POS" },
];

/**
 * Every page in the app a staff member could be granted access to —
 * dashboardNavigation's items, POS Mode's own routes, and grantable-only
 * pages together. Callers that mean "every grantable/launchable page"
 * (permission validation, the account-access summary dialog, the feedback
 * page-picker, the /go/* store launcher) should use this, not
 * getAllDashboardNavItems() alone — that one is scoped to the Back Office
 * rail specifically and silently excludes both POS Mode's routes and
 * grantable-only pages by design.
 */
export function getAllAppNavItems(): NavItem[] {
  return [...getAllDashboardNavItems(), ...posModeNavItems, ...grantableOnlyNavItems];
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
