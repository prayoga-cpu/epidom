/**
 * The admin panel's pages, and who may open each one.
 *
 * - A full admin (`User.isAdmin`, or an address in HARDCODED_ADMIN_EMAILS)
 *   opens everything.
 * - Any other account can be given some GRANTABLE pages (`User.adminSections`,
 *   set by a full admin from the users table) and then opens only those.
 * - `my-referrals` is a partner's own page: open to an account with a Partner
 *   row, no grant needed.
 *
 * This list drives the admin nav, the page and API guards and the grant
 * dialog, so a new admin page is one entry here plus its guard.
 */

/** Where a partner lands: their own page (also the my-referrals section's href). */
export const PARTNER_PAGE_PATH = "/admin/my-referrals";

export const ADMIN_SECTION_KEYS = [
  "users",
  "activity",
  "revenue",
  "capacity",
  "sales-pages",
  "pixel",
  "partners",
  "feedback",
  "custom-development",
  "my-referrals",
  "newsletter",
] as const;

export type AdminSectionKey = (typeof ADMIN_SECTION_KEYS)[number];

/** Who may open a section. */
export type AdminSectionAccess = "full" | "grantable" | "partner";

/** Nav grouping for dropdown menus. */
export type AdminSectionGroup = "finance" | "marketing" | "community";

export interface AdminSection {
  key: AdminSectionKey;
  href: string;
  label: string;
  /** lucide-react icon name, resolved by the nav. */
  icon:
    | "Users"
    | "Activity"
    | "TrendingUp"
    | "Gauge"
    | "Megaphone"
    | "Radar"
    | "Handshake"
    | "Bug"
    | "Wrench"
    | "Link"
    | "Mail";
  access: AdminSectionAccess;
  group?: AdminSectionGroup;
  /** Shown in the grant dialog when what the page exposes deserves a second thought. */
  grantWarning?: string;
}

export const ADMIN_NAV_GROUPS: { key: AdminSectionGroup; label: string }[] = [
  { key: "finance", label: "Finance" },
  { key: "marketing", label: "Marketing" },
  { key: "community", label: "Community" },
];

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  // Plans, deletes, passwords and admin grants: never grantable.
  { key: "users", href: "/admin", label: "Users", icon: "Users", access: "full" },
  // Every actor's email, plus revert/restore of any logged action.
  { key: "activity", href: "/admin/activity", label: "Activity", icon: "Activity", access: "full" },
  {
    key: "revenue",
    href: "/admin/revenue",
    label: "Revenue",
    icon: "TrendingUp",
    access: "grantable",
    group: "finance",
    grantWarning: "Shows every customer's payments and the revenue split.",
  },
  {
    key: "capacity",
    href: "/admin/capacity",
    label: "Capacity & Usage",
    icon: "Gauge",
    access: "grantable",
    group: "finance",
    grantWarning: "Includes running a full database backup.",
  },
  {
    key: "sales-pages",
    href: "/admin/sales-pages",
    label: "Sales Pages",
    icon: "Megaphone",
    access: "grantable",
    group: "marketing",
  },
  {
    key: "pixel",
    href: "/admin/pixel",
    label: "Meta Pixel",
    icon: "Radar",
    access: "grantable",
    group: "marketing",
  },
  {
    key: "newsletter",
    href: "/admin/newsletter",
    label: "Newsletter",
    icon: "Mail",
    access: "grantable",
    group: "marketing",
  },
  {
    key: "partners",
    href: "/admin/partners",
    label: "Referrals",
    icon: "Handshake",
    access: "grantable",
    group: "community",
    grantWarning:
      "Can create referral partners and change their deals. Payouts still need a full admin.",
  },
  {
    key: "feedback",
    href: "/admin/feedback",
    label: "Feedback",
    icon: "Bug",
    access: "grantable",
    group: "community",
  },
  {
    key: "custom-development",
    href: "/admin/custom-development",
    label: "Custom Development",
    icon: "Wrench",
    access: "grantable",
    group: "community",
  },
  {
    key: "my-referrals",
    href: "/admin/my-referrals",
    label: "My referrals",
    icon: "Link",
    access: "partner",
  },
];

export const GRANTABLE_ADMIN_SECTIONS = ADMIN_SECTIONS.filter((s) => s.access === "grantable");

export type GrantableAdminSectionKey =
  | "revenue"
  | "capacity"
  | "sales-pages"
  | "pixel"
  | "partners"
  | "feedback"
  | "custom-development"
  | "newsletter";

export const GRANTABLE_ADMIN_SECTION_KEYS = GRANTABLE_ADMIN_SECTIONS.map(
  (s) => s.key
) as GrantableAdminSectionKey[];

export function isGrantableAdminSection(key: unknown): key is GrantableAdminSectionKey {
  return typeof key === "string" && (GRANTABLE_ADMIN_SECTION_KEYS as string[]).includes(key);
}

/** The grantable keys among a stored list (retired or unknown keys are dropped). */
export function grantedSections(
  stored: readonly string[] | null | undefined
): GrantableAdminSectionKey[] {
  return (stored ?? []).filter(isGrantableAdminSection);
}

export interface AdminAccessSummary {
  /** isAdmin or a hardcoded email: everything. */
  full: boolean;
  /** Grantable pages this account was given (empty for a full admin: they have them all). */
  sections: GrantableAdminSectionKey[];
  /** Has a Partner row, so may open my-referrals. */
  partner: boolean;
}

export function canOpenSection(access: AdminAccessSummary, key: AdminSectionKey): boolean {
  const section = ADMIN_SECTIONS.find((s) => s.key === key);
  if (!section) return false;
  if (section.access === "partner") return access.partner;
  if (access.full) return true;
  return section.access === "grantable" && (access.sections as string[]).includes(key);
}

/** The sections an account may open, in nav order. */
export function visibleSections(access: AdminAccessSummary): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => canOpenSection(access, s.key));
}

/** Whether the account may open any admin page at all. */
export function hasAnyAdminAccess(access: AdminAccessSummary): boolean {
  return visibleSections(access).length > 0;
}

export function sectionsForGroup(
  sections: Pick<AdminSection, "key" | "group">[],
  group: AdminSectionGroup
): Pick<AdminSection, "key" | "group">[] {
  return sections.filter((s) => s.group === group);
}
