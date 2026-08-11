import type { StaffRole } from "@prisma/client";

/**
 * Role → i18n key for the role's default job title. The owner can override
 * the displayed title per staff member with `StaffMember.customRoleLabel`
 * (free text, deliberately not translated) — always render through
 * `staffRoleLabel` so that override is honoured consistently.
 */
export const STAFF_ROLE_LABEL_KEYS: Record<StaffRole, string> = {
  OWNER: "pages.staffRoleOwner",
  MANAGER: "pages.staffRoleManager",
  CASHIER: "pages.staffRoleCashier",
  KITCHEN: "pages.staffRoleKitchen",
};

/** The owner-authored `customRoleLabel` when set, else the role's translated title. */
export function staffRoleLabel(
  member: { role: StaffRole; customRoleLabel?: string | null },
  t: (key: string) => string
): string {
  return member.customRoleLabel?.trim() || t(STAFF_ROLE_LABEL_KEYS[member.role]);
}
