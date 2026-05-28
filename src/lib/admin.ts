/**
 * Master admin configuration.
 * Accounts in this list bypass subscription management and can manage all users.
 */
export const ADMIN_EMAILS = [
  "prayogadevelopment@gmail.com",
  "mrcaoevan@gmail.com",
  "darwin.prayoga13@gmail.com",
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase().trim());
}
