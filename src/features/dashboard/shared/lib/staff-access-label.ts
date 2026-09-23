import { posModeNavItems } from "@/config/navigation.config";

/** Every href posModeNavItems grants — anything on a staff member's
 * allowedPages that ISN'T one of these counts as Back Office access, same
 * "POS vs. everything else" split used by src/lib/last-visited.ts. */
const POS_HREFS = new Set(posModeNavItems.map((item) => item.href));

/**
 * i18n key for "which shell(s) can this staff member reach" — shown on the
 * StoreAccessGate staff picker so an owner glancing at "who's using this
 * device" can tell a Cashier apart from a Manager who also has Back Office
 * pages, without opening each one's permissions individually.
 */
export function staffAccessLabelKey(allowedPages: string[] | null | undefined): string | null {
  const pages = allowedPages ?? [];
  const hasPos = pages.some((p) => POS_HREFS.has(p));
  const hasBackOffice = pages.some((p) => !POS_HREFS.has(p));
  if (hasBackOffice && hasPos) return "pages.staffAccessBoth";
  if (hasBackOffice) return "pages.staffAccessBackOffice";
  if (hasPos) return "pages.staffAccessPos";
  return null;
}
