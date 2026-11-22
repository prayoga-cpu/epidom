/**
 * Client-side catalog for messages the SERVER wrote in English.
 *
 * API routes, services and zod schemas answer with English sentences
 * (`throw new AppError("…")`, `createErrorResponse(code, "…")`, zod
 * `message: "…"`), and the client shows them verbatim in toasts and under form
 * fields. The UI language lives only in the browser (localStorage +
 * `<html lang>`, set by I18nProvider), so the server cannot translate them.
 *
 * Instead the exact English sentence is turned into a deterministic key
 * (`serverMessageKey`) and looked up under the `serverMessages` namespace of
 * the active dictionary. A sentence with no entry is returned unchanged, so
 * wrapping any string in `localizeServerMessage()` is always safe — including
 * a string that is already translated, or one that never came from the server.
 *
 * Adding a message: nothing to do here. Add `serverMessages.<key>` to the four
 * dictionaries, where `<key>` is `serverMessageKey("<the English sentence>")`.
 * Messages with a value inside them (a name, a count) need a row in
 * `SERVER_MESSAGE_PATTERNS` below instead.
 *
 * This module must stay free of React and of the i18n provider: the shared API
 * client imports it, and a provider import here creates an import cycle that
 * deadlocks tests which mock the provider (the hook lives in
 * use-localize-server-message.ts for that reason).
 */

import { getLocaleMessages, type Lang } from "@/locales";

const NAMESPACE = "serverMessages";
const MAX_KEY_LENGTH = 80;

/** FNV-1a, base 36 — only used to keep truncated keys distinct. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * The dictionary key of an English server message: lowercase, every run of
 * non-alphanumerics becomes one "_", trimmed. Long sentences are cut at 80
 * characters and get a short hash of the full text, so two long messages that
 * start alike still get different keys. The same sentence always gives the
 * same key.
 */
export function serverMessageKey(message: string): string {
  const slug = message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (slug.length === 0) return `m_${shortHash(message)}`;
  // A key is an object property written as an identifier: no leading digit.
  const safe = /^[0-9]/.test(slug) ? `n_${slug}` : slug;
  if (safe.length <= MAX_KEY_LENGTH) return safe;
  return `${safe.slice(0, MAX_KEY_LENGTH).replace(/_+$/, "")}_${shortHash(message)}`;
}

/**
 * Server messages that carry a value. `key` names the translated template
 * under `serverMessages`; captured groups replace `{0}`, `{1}`… in it. A
 * captured group that is itself a known message (a resource name such as
 * "Customer", or a nested error sentence) is translated too.
 *
 * Order matters: the first match wins, so specific sentences come before the
 * generic "X not found" / "X is required" shapes at the bottom.
 */
export const SERVER_MESSAGE_PATTERNS: ReadonlyArray<{ pattern: RegExp; key: string }> = [
  // --- src/lib/errors ---
  { pattern: /^(.{1,60}?) with id '(.+)' not found$/, key: "p_not_found_with_id" },
  { pattern: /^(.{1,60}?) with (\w+) '(.+)' already exists$/, key: "p_duplicate_field" },
  {
    pattern: /^Store limit exceeded\. You have (\d+)\/(\d+) stores\. Please upgrade your plan\.$/,
    key: "p_store_limit_exceeded",
  },
  {
    pattern: /^Product limit exceeded\. You have (\d+)\/(\d+) products\.$/,
    key: "p_product_limit_exceeded",
  },
  {
    pattern: /^Insufficient stock for material '(.+)'\. Required: (.+), Available: (.+?)\.$/,
    key: "p_insufficient_stock",
  },
  {
    pattern: /^Insufficient stock for '(.+)'\. Required: (.+), Available: (.+)$/,
    key: "p_insufficient_stock",
  },
  { pattern: /^Active subscription required to access (.+)$/, key: "p_subscription_required_for" },
  {
    pattern: /^Rate limit exceeded\. Please try again in (\d+) seconds\.$/,
    key: "p_rate_limit_seconds",
  },

  // --- catalog: products, recipes, suppliers, tables, customers ---
  {
    pattern: /^Product with SKU "(.+)" already exists in this store$/,
    key: "p_product_sku_exists",
  },
  {
    pattern: /^Product with name "(.+)" already exists in this store$/,
    key: "p_product_name_exists",
  },
  { pattern: /^Recipe with name "(.+)" already exists$/, key: "p_recipe_name_exists" },
  {
    pattern: /^Supplier with name "(.+)" already exists in this store$/,
    key: "p_supplier_name_exists",
  },
  { pattern: /^Table "(.+)" already exists$/, key: "p_table_exists" },
  {
    pattern: /^Barcode "(.+)" is already used by another product in this store$/,
    key: "p_barcode_used_in_store",
  },
  { pattern: /^Barcode "(.+)" is already used by another product$/, key: "p_barcode_used" },
  { pattern: /^Barcode must be at most (\d+) characters$/, key: "p_barcode_max_length" },
  {
    pattern: /^A customer with this phone number already exists \((.+)\)$/,
    key: "p_customer_phone_exists",
  },
  {
    pattern: /^This customer only has (\d+) points?, so (\d+) can't be removed$/,
    key: "p_customer_points_short",
  },
  { pattern: /^Adjust at most ([\d,]+) points at a time$/, key: "p_adjust_points_max" },
  {
    pattern:
      /^A price of (.+) is too large to store on the linked product \(the limit is (.+) in the base currency\)\.$/,
    key: "p_linked_price_too_large",
  },
  { pattern: /^(Material|Product|Supplier|Recipe) import failed: (.+)$/, key: "p_import_failed" },

  // --- production ---
  { pattern: /^Insufficient materials: (.+)$/, key: "p_insufficient_materials" },
  {
    pattern:
      /^Cannot start production: Material '(.+)' not found\. Please check your recipe ingredients\.$/,
    key: "p_production_material_missing",
  },

  // --- POS, orders, shifts ---
  {
    pattern:
      /^The choices for "(.+)" have changed\. Remove it from your cart and add it again\.$/,
    key: "p_choices_changed",
  },
  { pattern: /^No longer available, remove from cart: (.+)$/, key: "p_no_longer_available" },
  { pattern: /^This order has already been sent (\d+) times$/, key: "p_receipt_sent_times" },
  {
    pattern: /^Only (.+) can end this shift\. The owner can close it from the Store Dashboard\.$/,
    key: "p_only_opener_can_end_shift",
  },

  // --- plans, transfers, invitations ---
  {
    pattern:
      /^You have reached your plan's product limit \((\d+)\/(\d+)\)\. Upgrade to the Operations plan to add more products\.$/,
    key: "p_plan_product_limit",
  },
  { pattern: /^Finance reports requires the (.+) plan\.$/, key: "p_finance_requires_plan" },
  {
    pattern:
      /^Your plan includes (\d+) stores?\. Upgrade to the (.+) plan to take over this store\.$/,
    key: "p_plan_store_limit_transfer",
  },
  {
    pattern: /^This invitation is for (.+)\. Sign in with that address to accept it\.$/,
    key: "p_invitation_for_email",
  },

  // --- zod built-in messages (schemas without a custom message) ---
  {
    pattern: /^String must contain at least (\d+) character\(s\)$/,
    key: "p_zod_string_min",
  },
  { pattern: /^String must contain at most (\d+) character\(s\)$/, key: "p_zod_string_max" },
  { pattern: /^String must contain exactly (\d+) character\(s\)$/, key: "p_zod_string_exact" },
  {
    pattern: /^Number must be greater than or equal to (-?[\d.]+)$/,
    key: "p_zod_number_gte",
  },
  { pattern: /^Number must be greater than (-?[\d.]+)$/, key: "p_zod_number_gt" },
  { pattern: /^Number must be less than or equal to (-?[\d.]+)$/, key: "p_zod_number_lte" },
  { pattern: /^Number must be less than (-?[\d.]+)$/, key: "p_zod_number_lt" },
  { pattern: /^Number must be a multiple of ([\d.]+)$/, key: "p_zod_number_multiple" },
  { pattern: /^Array must contain at least (\d+) element\(s\)$/, key: "p_zod_array_min" },
  { pattern: /^Array must contain at most (\d+) element\(s\)$/, key: "p_zod_array_max" },
  { pattern: /^Expected [\w ]+, received [\w ]+$/, key: "p_zod_invalid_type" },
  { pattern: /^Invalid enum value\. .+$/, key: "p_zod_invalid_option" },

  // --- generic shapes (keep last) ---
  {
    pattern: /^(.{1,60}?) not found or does not belong to this store$/,
    key: "p_not_found_or_not_in_store",
  },
  { pattern: /^(.{1,60}?) does not belong to this store$/, key: "p_not_in_store" },
  { pattern: /^(.{1,60}?) not found$/, key: "p_not_found" },
  { pattern: /^(.{1,80}?) already exists$/, key: "p_already_exists" },
  { pattern: /^(.{1,60}?) must be at least (\d+) characters$/, key: "p_min_characters" },
  {
    pattern: /^(.{1,60}?) must (?:be at most|not exceed) (\d+) characters$/,
    key: "p_max_characters",
  },
  { pattern: /^(.{1,60}?) is required$/, key: "p_is_required" },
  { pattern: /^(.{1,60}?) is too long$/, key: "p_is_too_long" },
];

const KNOWN_LOCALES: readonly string[] = ["en", "fr", "id", "th"];

/** `fr-FR` → `fr`; anything that is not one of our languages → null. */
function normalizeLocale(locale: string | null | undefined): Lang | null {
  if (typeof locale !== "string") return null;
  const short = locale.trim().toLowerCase().slice(0, 2);
  return KNOWN_LOCALES.includes(short) ? (short as Lang) : null;
}

function activeLocale(explicit?: string): Lang {
  const given = normalizeLocale(explicit);
  if (given) return given;
  if (typeof document !== "undefined") {
    const fromDocument = normalizeLocale(document.documentElement?.lang);
    if (fromDocument) return fromDocument;
  }
  return "en";
}

/** The `serverMessages` table of a loaded dictionary, or null. */
function catalogFor(locale: Lang): Record<string, unknown> | null {
  const dictionary = getLocaleMessages(locale) as Record<string, unknown> | undefined;
  const table = dictionary?.[NAMESPACE];
  return table && typeof table === "object" ? (table as Record<string, unknown>) : null;
}

function lookup(catalog: Record<string, unknown>, key: string): string | null {
  const value = Object.prototype.hasOwnProperty.call(catalog, key) ? catalog[key] : undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function translate(message: string, catalog: Record<string, unknown>, depth: number): string {
  const exact = lookup(catalog, serverMessageKey(message));
  if (exact) return exact;

  for (const { pattern, key } of SERVER_MESSAGE_PATTERNS) {
    const match = pattern.exec(message);
    if (!match) continue;
    const template = lookup(catalog, key);
    // No translated template: try the next shape rather than give up, so a
    // sentence can still fall through to a generic one.
    if (!template) continue;
    return template.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
      const captured = match[Number(index) + 1];
      if (captured === undefined) return placeholder;
      // One level of nesting is enough for "X import failed: <message>".
      return depth < 1 ? translate(captured, catalog, depth + 1) : captured;
    });
  }

  return message;
}

/**
 * Translates an English server message into the UI language.
 *
 * Returns the message unchanged when the language is English, when its
 * dictionary has not loaded yet, or when the catalog has no entry for it.
 * `null` / `undefined` give "" so `localizeServerMessage(x) || fallback` keeps
 * working. Works outside React: with no `locale` it reads `<html lang>`.
 * Never throws.
 */
export function localizeServerMessage(message: string | null | undefined, locale?: string): string {
  if (message === null || message === undefined) return "";
  if (typeof message !== "string") return message as unknown as string;
  if (message.length === 0) return message;
  try {
    const lang = activeLocale(locale);
    if (lang === "en") return message;
    const catalog = catalogFor(lang);
    if (!catalog) return message;
    return translate(message, catalog, 0);
  } catch {
    return message;
  }
}
