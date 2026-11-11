import {
  ChartNoAxesCombined,
  CircleUser,
  LayoutGrid,
  Workflow,
  Settings,
  Boxes,
  Database,
  AlertTriangle,
  Home,
  Briefcase,
  CreditCard,
  Store,
  Smartphone,
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
  ContactRound,
  Wallet,
  BookOpen,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { LandingGroup } from "@/features/marketing/landing/registry";

/**
 * Navigation Configuration
 *
 * Centralized navigation structure following Open/Closed Principle.
 * To add new navigation items, simply add them to this config.
 */

export type PlanTier = "FREE" | "POS" | "OPERATIONS" | "ENTERPRISE";

export interface NavItem {
  /** Permission key (what StaffMember.allowedPages stores) AND, unless `route` is set, the in-store path. */
  href: string;
  /** In-store path when it differs from the permission key: Analytics lives at
   * /analytics but is still granted as "/dashboard", so no stored grant needs a migration. */
  route?: string;
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
  /** Stable id: the desktop sidebar's category rail keys on it. */
  id: string;
  title?: string; // Optional section title (the phone drawer's heading)
  /** i18n key and icon for the category rail on desktop (the left strip of the sidebar). */
  labelKey: string;
  icon: LucideIcon;
  items: NavItem[];
}

/**
 * Dashboard navigation items — grouped by job-to-be-done within the plan-tier
 * skeleton (docs/back-office-revamp.md): General (always-visible product
 * surfaces), Operations (run the back-of-house, all OPERATIONS-tier),
 * Reports (Shifts, and Finance with its All outlets roll-up — also
 * OPERATIONS-tier). Settings, Billing and Custom Development (your relationship
 * with Epidom as a platform) sit at the end of General since 3.45.0: there is no
 * separate Account category.
 *
 * /menu and POS Mode's own routes are deliberately absent — see
 * grantableOnlyNavItems and posModeNavItems below for why.
 */
export const dashboardNavigation: NavSection[] = [
  {
    id: "general",
    labelKey: "nav.sections.general",
    icon: LayoutGrid,
    title: "General",
    items: [
      {
        // Analytics (3.44.0; "Overview" before). Home is the start page now.
        href: "/dashboard",
        route: "/analytics",
        labelKey: "nav.dashboard",
        icon: ChartNoAxesCombined,
        showBadge: false,
      },
      {
        // Phone Orders (3.44.0; "Storefront" before): the public menu page
        // customers open and order from on their phone. The route and the
        // grant keep the old /storefront name so no allowedPages migration.
        href: "/storefront",
        labelKey: "nav.storefront",
        icon: Smartphone,
        showBadge: false,
      },
      // Customer records captured at POS (name / phone / e-mail, plus loyalty
      // points when the store runs the program). Capturing a customer is POS-tier;
      // only the promotion mechanics (presets, coupons, points) are OPERATIONS —
      // see FEATURE_MIN_PLAN.loyaltyAndPromotions.
      {
        href: "/customers",
        labelKey: "nav.customers",
        icon: ContactRound,
        showBadge: false,
        requiredPlan: "POS",
        lockedHintKey: "nav.lockedHint.customers",
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
        requiredPlan: "POS",
        lockedHintKey: "nav.lockedHint.customDevelopment",
      },
      // Settings (the old Profile page) is last: the desktop sidebar pins it to the
      // bottom of its panel, and the phone drawer lists it at the end of General.
      {
        href: "/profile",
        labelKey: "nav.profile",
        icon: Settings,
        showBadge: false,
      },
    ],
  },
  {
    id: "operations",
    labelKey: "nav.sections.operations",
    icon: Workflow,
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
    id: "reports",
    labelKey: "nav.sections.reports",
    icon: BarChart3,
    title: "Reports",
    items: [
      {
        // The manager's read-back of every till session — a report, so it sits
        // beside Finance, whose by-shift and cash tabs read the same sessions.
        // Attendance stays under Schedule; opening and finishing a shift is
        // POS Mode's Operational page.
        href: "/shifts",
        labelKey: "nav.shifts",
        icon: Wallet,
        showBadge: false,
        requiredPlan: "OPERATIONS",
        lockedHintKey: "nav.lockedHint.shifts",
      },
      {
        // Also the All outlets roll-up (the retired /owner page, now a
        // redirect into Finance's ?scope=all) — see FEATURE_MIN_PLAN.finance.
        href: "/finance",
        labelKey: "nav.finance",
        icon: BarChart3,
        showBadge: false,
        requiredPlan: "OPERATIONS",
        lockedHintKey: "nav.lockedHint.finance",
      },
      {
        // The till's signed sales journal (src/lib/fiscal): the record the
        // French anti-fraud VAT law asks for, kept six years. No plan gate: the
        // records must stay reachable whatever plan the store is on later.
        href: "/fiscal",
        labelKey: "nav.fiscal",
        icon: ShieldCheck,
        showBadge: false,
      },
    ],
  },
];

/**
 * Home — the Store Dashboard's start page (greeting, "What do you want to
 * do?", quick actions, recently visited, setup progress) and the default
 * landing page since 3.44.0.
 *
 * Deliberately NOT in dashboardNavigation: that list is also the universe of
 * staff page grants (getAllAppNavItems → ALL_STAFF_PAGES, the permission
 * checklist), and Home is not a permission — like Help, every member of the
 * store may open it, and each tile on it is gated by its own page. The
 * sidebar renders it as its own first row.
 */
export const homeNavItem: NavItem = {
  href: "/home",
  labelKey: "nav.home",
  icon: Home,
  showBadge: false,
};

/**
 * One link inside a marketing dropdown. A landing page is named by its group
 * (src/features/marketing/landing/registry.ts) because its slug depends on the
 * language: the link is the page in the visitor's language, and is left out
 * where the page has no version in it.
 */
export interface LandingMenuLink {
  /** A site path ("/blog", "/products#pos"); omitted when `landing` names the page. */
  href?: string;
  landing?: LandingGroup;
  labelKey: string;
  /** A second line under the label (the Products menu). */
  descKey?: string;
  /** The plan that includes it, shown as a small badge. */
  plan?: "FREE" | "POS" | "OPERATIONS";
}

export interface LandingMenu {
  /** One or more groups of links; a group may have a small heading. */
  sections: { headingKey?: string; links: LandingMenuLink[] }[];
  /** A closing link, e.g. "See all products". */
  footer?: { href: string; labelKey: string };
}

/** A top-level entry of the marketing header: a plain link, or a dropdown (with or without a page of its own). */
export interface LandingNavEntry {
  id: string;
  /** The entry's own page. A dropdown without one is just a button that opens its menu. */
  href?: string;
  labelKey: string;
  icon: LucideIcon;
  menu?: LandingMenu;
}

/**
 * The marketing header (for marketing/public pages): Products and Resources
 * open a menu, Pricing is a plain link. There is no "Home" (the logo is it) and
 * no "Contact" (it lives under Resources, with Compare). Products' three spaces
 * link to their cards on /products; the Claude connector to its own page.
 */
export const landingNavigation: LandingNavEntry[] = [
  {
    id: "products",
    href: "/products",
    labelKey: "common.nav.products",
    icon: Briefcase,
    menu: {
      sections: [
        {
          links: [
            {
              href: "/products#storefront",
              labelKey: "redesign.landing.spaces.storefrontName",
              descKey: "redesign.landing.spaces.storefrontShort",
              plan: "FREE",
            },
            {
              href: "/products#pos",
              labelKey: "redesign.landing.spaces.posName",
              descKey: "redesign.landing.spaces.posShort",
              plan: "POS",
            },
            {
              href: "/products#dashboard",
              labelKey: "redesign.landing.spaces.backOfficeName",
              descKey: "redesign.landing.spaces.backOfficeShort",
              plan: "OPERATIONS",
            },
            {
              landing: "claude-connector",
              labelKey: "common.nav.claudeConnector",
              descKey: "common.nav.claudeConnectorDesc",
            },
          ],
        },
      ],
      footer: { href: "/products", labelKey: "common.nav.viewAllProducts" },
    },
  },
  {
    id: "pricing",
    href: "/pricing",
    labelKey: "common.nav.pricing",
    icon: CreditCard,
  },
  {
    id: "resources",
    labelKey: "common.nav.resources",
    icon: BookOpen,
    menu: {
      sections: [
        {
          headingKey: "common.nav.toolsHeading",
          links: [
            { landing: "commission", labelKey: "common.nav.toolCommission" },
            { landing: "recipe-cost", labelKey: "common.nav.toolRecipeCost" },
            { landing: "qr-menu", labelKey: "common.nav.toolQrMenu" },
          ],
        },
        {
          headingKey: "common.nav.learnHeading",
          links: [
            { href: "/blog", labelKey: "footer.linkBlog" },
            { href: "/docs", labelKey: "footer.linkDocs" },
            { href: "/compare", labelKey: "footer.linkCompare" },
            { href: "/changelog", labelKey: "footer.linkChangelog" },
            { href: "/contact", labelKey: "footer.linkContact" },
          ],
        },
      ],
    },
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
 * The header's top-level entries for a variant. The in-app shell's flat items
 * become plain-link entries, so the header renders both the same way.
 */
export function getNavigationByVariant(variant: "landing" | "authenticated"): LandingNavEntry[] {
  return variant === "landing"
    ? landingNavigation
    : authenticatedNavigation.map((item) => ({
        id: item.href,
        href: item.href,
        labelKey: item.labelKey,
        icon: item.icon,
      }));
}
