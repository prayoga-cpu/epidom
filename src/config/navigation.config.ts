import {
  LayoutDashboard,
  UserRound,
  Boxes,
  PackageSearch,
  Database,
  Bell,
  Home,
  Briefcase,
  CreditCard,
  Mail,
  Store,
  Monitor,
  UtensilsCrossed,
  ChefHat,
  Grid2X2,
  Users,
  Clock,
  BarChart3,
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
    items: [
      {
        href: "/profile",
        labelKey: "nav.profile",
        icon: UserRound,
        showBadge: false,
      },
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
      // POS tier
      {
        href: "/pos",
        labelKey: "nav.pos",
        icon: Monitor,
        showBadge: false,
        requiredPlan: "POS",
      },
      {
        href: "/pos/orders",
        labelKey: "nav.posOrders",
        icon: UtensilsCrossed,
        showBadge: false,
        requiredPlan: "POS",
      },
      {
        href: "/pos/kds",
        labelKey: "nav.posKds",
        icon: ChefHat,
        showBadge: false,
        requiredPlan: "POS",
      },
      {
        href: "/tables",
        labelKey: "nav.posTables",
        icon: Grid2X2,
        showBadge: false,
        requiredPlan: "POS",
      },
      // Operations tier
      {
        href: "/management",
        labelKey: "nav.management",
        icon: Boxes,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/tracking",
        labelKey: "nav.tracking",
        icon: PackageSearch,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/data",
        labelKey: "nav.data",
        icon: Database,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      {
        href: "/alerts",
        labelKey: "nav.alerts",
        icon: Bell,
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
        href: "/shifts",
        labelKey: "nav.shifts",
        icon: Clock,
        showBadge: false,
        requiredPlan: "OPERATIONS",
      },
      // Enterprise tier
      {
        href: "/finance",
        labelKey: "nav.finance",
        icon: BarChart3,
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
 */
export const authenticatedNavigation: NavItem[] = [
  {
    href: "/stores",
    labelKey: "common.nav.stores", // Will use "My Stores" as fallback
    icon: Store,
  },
  {
    href: "/profile",
    labelKey: "common.nav.profile",
    icon: UserRound,
  },
];

/**
 * Get all navigation items flattened
 */
export function getAllDashboardNavItems(): NavItem[] {
  return dashboardNavigation.flatMap((section) => section.items);
}

/**
 * Get navigation items by variant
 */
export function getNavigationByVariant(variant: "landing" | "authenticated"): NavItem[] {
  return variant === "landing" ? landingNavigation : authenticatedNavigation;
}
