/**
 * Master admin configuration.
 * Accounts in this list are always admins regardless of DB flag.
 * Additional admins can be granted via the admin panel (stored in User.isAdmin).
 */
export const HARDCODED_ADMIN_EMAILS = [
  "prayogadevelopment@gmail.com",
  "mrcaoevan@gmail.com",
  "darwin.prayoga13@gmail.com",
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (HARDCODED_ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase().trim());
}

/** Check admin status by combining hardcoded list + DB flag. Use in server contexts. */
export function isAdminUser(email: string | null | undefined, isAdminFlag: boolean): boolean {
  return isAdminFlag || isAdminEmail(email);
}
