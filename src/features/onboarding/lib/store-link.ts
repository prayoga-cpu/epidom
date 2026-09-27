/**
 * The store link ("epidom.fr/@creperie-du-port") as the setup wizard previews
 * and edits it, client-side.
 *
 * `slugifyStoreLink` applies exactly the rule the server's `slugify()` in
 * src/lib/services/onboarding.service.ts uses (that module pulls in Prisma, so
 * it can't be imported into the browser bundle). The preview therefore shows
 * the same link the server derives from the name; the slug-check endpoint
 * then confirms it is free.
 */

export const STORE_SLUG_MIN_LENGTH = 3;
export const STORE_SLUG_MAX_LENGTH = 50;

const COMBINING_MARKS = /[̀-ͯ]/g;

function transliterate(text: string): string {
  return text
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase();
}

/**
 * Store link from a name: accents stripped ("Crêperie du Port" ->
 * "creperie-du-port"), ligatures spelled out ("Cœur" -> "coeur"), anything
 * else that isn't [a-z0-9] becomes a dash, dashes collapsed and trimmed, at
 * most 50 characters. A result shorter than 3 characters is returned as is;
 * callers treat it as "no link yet".
 */
export function slugifyStoreLink(text: string): string {
  return transliterate(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, STORE_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * What the link field keeps while the owner types: the same transliteration,
 * but a trailing dash survives (so "mon-" can become "mon-cafe") and nothing
 * is trimmed until the value is checked or saved.
 */
export function normalizeSlugInput(text: string): string {
  return transliterate(text)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/g, "")
    .slice(0, STORE_SLUG_MAX_LENGTH);
}

/** Same rule as storefrontSlugSchema: 3-50 lowercase letters, digits or dashes. */
export function isValidStoreSlug(slug: string): boolean {
  return (
    slug.length >= STORE_SLUG_MIN_LENGTH &&
    slug.length <= STORE_SLUG_MAX_LENGTH &&
    /^[a-z0-9-]+$/.test(slug)
  );
}

const DEFAULT_HOST = "epidom.fr";

/** The public host storefront links live on ("epidom.fr"), from NEXT_PUBLIC_APP_URL. */
export function storeLinkHost(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return DEFAULT_HOST;
  try {
    return new URL(base).host || DEFAULT_HOST;
  } catch {
    return DEFAULT_HOST;
  }
}

/** "epidom.fr/@slug", as shown to the owner (no protocol). */
export function storeLinkLabel(slug: string): string {
  return `${storeLinkHost()}/@${slug}`;
}
