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
 * The same table holds field and resource nouns ("Name", "Current stock",
 * "Production batch"). They fill the generic shapes ("X is required",
 * "X not found") and name the field in a validation summary
 * (`localizeServerField`). The key is a lowercase slug, so "Nickname",
 * "nickname" and the field path `nickname` all find the same entry.
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
 * `raw` marks a row whose captured values are data somebody typed (a product
 * name, a referral code, an email): they are inserted as they came, so a
 * product called "Table" or a code "EMAIL" is not mistaken for a noun.
 *
 * Order matters: the first match wins, so specific sentences come before the
 * generic "X not found" / "X is required" shapes at the bottom.
 */
export const SERVER_MESSAGE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  key: string;
  /** Captured values are inserted untranslated (names, codes, emails). */
  raw?: boolean;
  /**
   * Zero-based capture groups that ARE translated (a nested sentence); every
   * other group is inserted as it came. Takes precedence over `raw`.
   */
  translatable?: readonly number[];
}> = [
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
    raw: true,
  },
  {
    pattern: /^Insufficient stock for '(.+)'\. Required: (.+), Available: (.+)$/,
    key: "p_insufficient_stock",
    raw: true,
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
    raw: true,
  },
  {
    pattern: /^Product with name "(.+)" already exists in this store$/,
    key: "p_product_name_exists",
    raw: true,
  },
  { pattern: /^Recipe with name "(.+)" already exists$/, key: "p_recipe_name_exists", raw: true },
  {
    pattern: /^Supplier with name "(.+)" already exists in this store$/,
    key: "p_supplier_name_exists",
    raw: true,
  },
  { pattern: /^Table "(.+)" already exists$/, key: "p_table_exists", raw: true },
  {
    pattern: /^Barcode "(.+)" is already used by another product in this store$/,
    key: "p_barcode_used_in_store",
    raw: true,
  },
  {
    pattern: /^Barcode "(.+)" is already used by another product$/,
    key: "p_barcode_used",
    raw: true,
  },
  { pattern: /^Barcode must be at most (\d+) characters$/, key: "p_barcode_max_length" },
  {
    pattern: /^A customer with this phone number already exists \((.+)\)$/,
    key: "p_customer_phone_exists",
    raw: true,
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
  { pattern: /^Insufficient materials: (.+)$/, key: "p_insufficient_materials", raw: true },
  {
    pattern:
      /^Cannot start production: Material '(.+)' not found\. Please check your recipe ingredients\.$/,
    key: "p_production_material_missing",
    raw: true,
  },

  // --- POS, orders, shifts ---
  {
    pattern: /^The choices for "(.+)" have changed\. Remove it from your cart and add it again\.$/,
    key: "p_choices_changed",
    raw: true,
  },
  {
    pattern: /^No longer available, remove from cart: (.+)$/,
    key: "p_no_longer_available",
    raw: true,
  },
  { pattern: /^This order has already been sent (\d+) times$/, key: "p_receipt_sent_times" },
  {
    pattern: /^Only (.+) can end this shift\. The owner can close it from the Store Dashboard\.$/,
    key: "p_only_opener_can_end_shift",
    raw: true,
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
    raw: true,
  },

  // --- partners (admin) ---
  {
    pattern: /^The code (.+) is already used by another partner$/,
    key: "p_partner_code_used",
    raw: true,
  },
  // One sales page per sentence; several are joined with "; " (see translate).
  {
    pattern: /^([^;]+?) already belongs to ([^;]+)$/,
    key: "p_sales_page_belongs_to",
    raw: true,
  },
  { pattern: /^Nothing is ready to pay in ([A-Z]{3})$/, key: "p_nothing_ready_to_pay", raw: true },

  // --- success and status texts ---
  { pattern: /^Successfully deleted (\d+) material\(s\)$/, key: "p_deleted_materials" },
  { pattern: /^Successfully deleted (\d+) recipe\(s\)$/, key: "p_deleted_recipes" },
  {
    pattern: /^Deleted (\d+) material\(s\) in this category$/,
    key: "p_deleted_materials_in_category",
  },
  {
    pattern: /^Deleted (\d+) product\(s\) in this category$/,
    key: "p_deleted_products_in_category",
  },
  {
    pattern: /^Deleted (\d+) recipe\(s\) in this category$/,
    key: "p_deleted_recipes_in_category",
  },
  {
    pattern: /^Category removed from (\d+) material\(s\)$/,
    key: "p_category_removed_from_materials",
  },
  {
    pattern: /^Category removed from (\d+) product\(s\)$/,
    key: "p_category_removed_from_products",
  },
  {
    pattern: /^Category removed from (\d+) recipe\(s\)$/,
    key: "p_category_removed_from_recipes",
  },
  {
    pattern: /^Imported (\d+) items successfully, (\d+) failed$/,
    key: "p_imported_items_some_failed",
  },
  { pattern: /^Imported (\d+) items successfully$/, key: "p_imported_items" },
  {
    pattern: /^Found and canceled (\d+) duplicate subscription\(s\)$/,
    key: "p_duplicate_subscriptions_canceled",
  },
  {
    pattern: /^Successfully cleaned up (\d+) duplicate subscriptions$/,
    key: "p_duplicate_subscriptions_cleaned",
  },

  // --- import rows, POS warnings ---
  { pattern: /^Already used by another item: (.+)$/, key: "p_import_already_used" },
  { pattern: /^Coupon not applied \((.+)\)$/, key: "p_coupon_not_applied" },
  { pattern: /^Points not redeemed \((.+)\)$/, key: "p_points_not_redeemed" },
  {
    pattern: /^"(.+)" was no longer on the menu; recorded at the price charged$/,
    key: "p_item_off_menu",
    raw: true,
  },
  // A supplier order names the missing material by its id.
  { pattern: /^Material ([a-z0-9]{16,}) not found$/, key: "p_material_id_not_found", raw: true },

  // --- outside services (exchange rates, email, hosting) ---
  { pattern: /^Exchange rate API returned status (\d+)$/, key: "p_exchange_rate_api_status" },
  { pattern: /^Exchange rate API error: (.+)$/, key: "p_exchange_rate_api_error", raw: true },
  { pattern: /^Vercel billing API returned (\d+)$/, key: "p_vercel_api_returned" },
  { pattern: /^Neon API returned (\d+)$/, key: "p_neon_api_returned" },
  { pattern: /^Resend batch failed: (.+)$/, key: "p_resend_batch_failed" },
  {
    pattern: /^Failed to send password reset email: (.+)$/,
    key: "p_password_reset_email_failed",
  },
  { pattern: /^Failed to send verification email: (.+)$/, key: "p_verification_email_failed" },

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

  // --- audit log (src/lib/audit): revert panel, restore planner, labels ---
  {
    pattern: /^This action is in state (\w+) and cannot be reverted\.$/,
    key: "p_audit_action_in_state",
  },
  { pattern: /^Already reverted on (.+)\.$/, key: "p_audit_already_reverted_on", raw: true },
  {
    pattern: /^No catalogue entry for (.+); this action predates the current catalogue\.$/,
    key: "p_audit_no_catalogue_entry",
    raw: true,
  },
  {
    pattern:
      /^This action is (\d+) days old; reversal is limited to (\d+) days because downstream state has almost certainly been derived from it since\.$/,
    key: "p_audit_too_old",
  },
  { pattern: /^Restores the previous value for (.+)\.$/, key: "p_audit_restores_previous_value" },
  {
    pattern: /^Reversal failed and was rolled back: (.+)$/,
    key: "p_audit_reversal_failed",
    raw: true,
  },
  {
    pattern:
      /^Cannot restore: (\S+) (.+) is already used by an existing record \((\S+)\)\. Restoring would violate a unique constraint\.$/,
    key: "p_audit_unique_collision",
    raw: true,
  },
  {
    pattern:
      /^This order falls inside a till session closed on (.+?)\. Its cash count was written once and is never recomputed, so reverting would leave the cash reconciliation permanently wrong\. Post a correcting transaction instead\.$/,
    key: "p_audit_closed_till_session",
    raw: true,
  },
  {
    pattern: /^This snapshot is (\w+) — its contents are no longer available\.$/,
    key: "p_audit_snapshot_status",
  },
  {
    pattern:
      /^Captured under migration (\S+); the database is now at (\S+)\. Columns added since will take their defaults; a dropped or renamed column will cause the restore to refuse mid-run\.$/,
    key: "p_audit_captured_under_migration",
    raw: true,
  },
  {
    pattern: /^(\d+) of (\d+) rows in (\S+) already exist\. Restoring would duplicate live data\.$/,
    key: "p_audit_rows_already_exist",
    raw: true,
  },
  {
    pattern:
      /^(\d+) rows exceeds the (\d+)-row atomic limit, so the restore runs in batches and is not all-or-nothing\. The account is held deactivated until it completes, so a partial restore leaves an invisible tenant rather than a live broken one\.$/,
    key: "p_audit_atomic_limit",
  },
  {
    pattern:
      /^Cannot restore (\S+): (.+) is already used by live row (\S+)\. This is the classic case of an email being reused after the account was deleted\.$/,
    key: "p_audit_unique_in_snapshot",
    raw: true,
  },
  {
    pattern:
      /^([^.\s]+)\.(\S+) references (\d+) row\(s\) in (\S+) that no longer exist\. Those must be restored first\.$/,
    key: "p_audit_missing_external_rows",
    raw: true,
  },
  {
    pattern:
      /^\[audit\] snapshot exceeds (\d+) rows; refusing to delete without a complete, restorable capture\.$/,
    key: "p_audit_snapshot_too_large",
  },
  {
    pattern: /^"(.+)" no longer exists on the menu, so this change can't be undone cleanly\.$/,
    key: "p_audit_menu_item_gone",
    raw: true,
  },
  {
    pattern:
      /^"(.+)" has been changed since\. Undoing would overwrite that newer edit: change it back by hand, or undo the newer change first\.$/,
    key: "p_audit_menu_item_changed",
    raw: true,
  },
  {
    pattern: /^The product "(.+)" no longer exists, so its price can't be restored\.$/,
    key: "p_audit_product_price_gone",
    raw: true,
  },
  {
    pattern:
      /^The price of the product "(.+)" has been changed since\. Undoing would overwrite that newer edit: change it back by hand, or undo the newer change first\.$/,
    key: "p_audit_product_price_changed",
    raw: true,
  },
  { pattern: /^The category "(.+)" no longer exists\.$/, key: "p_audit_category_gone", raw: true },
  {
    pattern:
      /^The category "(.+)" has been renamed or moved since\. Undoing would overwrite that newer change\.$/,
    key: "p_audit_category_changed",
    raw: true,
  },
  {
    pattern: /^The category "(.+)" is already back, so there is nothing to restore\.$/,
    key: "p_audit_category_already_back",
    raw: true,
  },
  { pattern: /^The product "(.+)" no longer exists\.$/, key: "p_audit_product_gone", raw: true },
  {
    pattern:
      /^The options of "(.+)" have been changed since\. Undoing would overwrite that newer edit\.$/,
    key: "p_audit_options_changed",
    raw: true,
  },
  {
    pattern:
      /^The subscription is now (\S+), not the (\S+) this action set\. A newer change would be silently overwritten\.$/,
    key: "p_audit_subscription_now",
    raw: true,
  },
  {
    pattern: /^The custom price is now unset, not (.+)\. A newer change would be overwritten\.$/,
    key: "p_audit_custom_price_unset",
    raw: true,
  },
  {
    pattern: /^The custom price is now (.+), not (.+)\. A newer change would be overwritten\.$/,
    key: "p_audit_custom_price_now",
    raw: true,
  },
  { pattern: /^Set (\S+) to (\S+) \(was (\S+)\)$/, key: "p_audit_label_set_plan", translatable: [1, 2] },
  {
    pattern: /^Set (\S+) to (\S+) \(no prior subscription\)$/,
    key: "p_audit_label_set_plan_new",
    translatable: [1],
  },
  {
    pattern: /^Set (\S+) billing period to lifetime$/,
    key: "p_audit_label_period_lifetime",
    raw: true,
  },
  {
    pattern: /^Set (\S+) billing period to (\S+) months$/,
    key: "p_audit_label_period_months",
    raw: true,
  },
  {
    pattern: /^Set custom price (\S+) (\S+) for (\S+)$/,
    key: "p_audit_label_set_custom_price",
    raw: true,
  },
  {
    pattern: /^Cleared custom price \((\S+) (\S+)\) for (\S+)$/,
    key: "p_audit_label_clear_custom_price",
    raw: true,
  },
  { pattern: /^Granted admin for (\S+)$/, key: "p_audit_label_granted_admin", raw: true },
  { pattern: /^Revoked admin for (\S+)$/, key: "p_audit_label_revoked_admin", raw: true },
  { pattern: /^Gave (\S+) admin pages: (.+)$/, key: "p_audit_label_gave_admin_pages", translatable: [1] },
  { pattern: /^Removed (\S+)'s admin pages$/, key: "p_audit_label_removed_admin_pages", raw: true },
  { pattern: /^Reset password for (\S+)$/, key: "p_audit_label_reset_password", raw: true },
  {
    pattern: /^Issued a temporary password for (\S+)$/,
    key: "p_audit_label_temp_password",
    raw: true,
  },
  { pattern: /^Deleted account (\S+)$/, key: "p_audit_label_deleted_account", raw: true },
  { pattern: /^Reset all business data for (\S+)$/, key: "p_audit_label_reset_account", raw: true },
  { pattern: /^Reactivated account (\S+)$/, key: "p_audit_label_reactivated_account", raw: true },
  { pattern: /^Seeded demo data for (\S+)$/, key: "p_audit_label_seeded_demo_for", raw: true },
  { pattern: /^Triaged feedback (\S+)$/, key: "p_audit_label_triage_feedback", raw: true },
  {
    pattern: /^Triaged feedback (\S+) -> (\S+)$/,
    key: "p_audit_label_triage_feedback_status",
    translatable: [1],
  },
  {
    pattern: /^Triaged feedback (\S+) \((\S+)\)$/,
    key: "p_audit_label_triage_feedback_priority",
    translatable: [1],
  },
  {
    pattern: /^Triaged feedback (\S+) -> (\S+) \((\S+)\)$/,
    key: "p_audit_label_triage_feedback_both",
    translatable: [1, 2],
  },
  {
    pattern: /^Triaged custom development request (\S+)$/,
    key: "p_audit_label_triage_request",
    raw: true,
  },
  {
    pattern: /^Triaged custom development request (\S+) -> (\S+)$/,
    key: "p_audit_label_triage_request_status",
    translatable: [1],
  },
  { pattern: /^Adjusted (.+) by (\S+)$/, key: "p_audit_label_adjusted_stock", raw: true },
  { pattern: /^Deleted waste entry for (.+)$/, key: "p_audit_label_deleted_waste", raw: true },
  { pattern: /^Refunded (\S+) on order (\S+)$/, key: "p_audit_label_refunded_order", raw: true },
  { pattern: /^Deleted store (.+)$/, key: "p_audit_label_deleted_store", raw: true },
  { pattern: /^Changed the options of (.+)$/, key: "p_audit_label_changed_options", raw: true },
  { pattern: /^Reverted: (.+)$/, key: "p_audit_label_reverted" },

  { pattern: /^(FREE|POS|OPERATIONS|ENTERPRISE)\/([A-Z_]+)$/, key: "p_plan_with_status", translatable: [1] },
  // --- change history written by the Claude connector (src/lib/mcp/tools/menu.ts) ---
  ...["Added", "Changed"].flatMap((verb): Array<{
    pattern: RegExp;
    key: string;
    translatable: readonly number[];
  }> => {
    const v = verb.toLowerCase();
    return [
      { pattern: new RegExp(`^${verb} 1 menu item: (.+?); also set (.+)$`), key: `p_menu_${v}_one_linked`, translatable: [1] },
      { pattern: new RegExp(`^${verb} 1 menu item: (.+)$`), key: `p_menu_${v}_one`, translatable: [] },
      { pattern: new RegExp(`^${verb} (\\d+) menu items: (.+?) and (\\d+) more; also set (.+)$`), key: `p_menu_${v}_more_linked`, translatable: [3] },
      { pattern: new RegExp(`^${verb} (\\d+) menu items: (.+?) and (\\d+) more$`), key: `p_menu_${v}_more`, translatable: [] },
      { pattern: new RegExp(`^${verb} (\\d+) menu items: (.+?); also set (.+)$`), key: `p_menu_${v}_many_linked`, translatable: [2] },
      { pattern: new RegExp(`^${verb} (\\d+) menu items: (.+)$`), key: `p_menu_${v}_many`, translatable: [] },
    ];
  }),
  // The "also set …" tail: the linked product, and the other menu items on it.
  { pattern: /^linked product (.+?) \((.+?)\) to (\S+) and 1 other menu item$/, key: "p_menu_linked_product_one", raw: true },
  { pattern: /^linked product (.+?) \((.+?)\) to (\S+) and (\d+) other menu items$/, key: "p_menu_linked_product_many", raw: true },
  { pattern: /^linked product (.+?) \((.+?)\) to (\S+)$/, key: "p_menu_linked_product", raw: true },
  { pattern: /^1 other menu item linked to (.+) to (\S+)$/, key: "p_menu_linked_other_one", raw: true },
  { pattern: /^(\d+) other menu items linked to (.+) to (\S+)$/, key: "p_menu_linked_other_many", raw: true },
  { pattern: /^Renamed category (.+?) to (.+)$/, key: "p_menu_category_renamed", raw: true },
  { pattern: /^Merged category (.+?) into (.+)$/, key: "p_menu_category_merged", raw: true },
  { pattern: /^Removed 1 empty category: (.+)$/, key: "p_menu_categories_removed_one", raw: true },
  { pattern: /^Removed (\d+) empty categories: (.+)$/, key: "p_menu_categories_removed_many", raw: true },

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

const LIST_SEPARATORS = ["; ", ", "] as const;

/** The translation of a message the catalog knows, or null. */
function translateKnown(
  message: string,
  catalog: Record<string, unknown>,
  depth: number,
  allowList: boolean
): string | null {
  const exact = lookup(catalog, serverMessageKey(message));
  if (exact) return exact;

  // Several messages in one string ("Name is required, Price is required", or
  // partner conflicts joined with "; "). Translated only when every part is
  // known, so a sentence that merely contains a comma is never half-translated.
  // Tried before the patterns: the generic shapes would otherwise swallow the
  // whole list as one field name.
  if (allowList) {
    for (const separator of LIST_SEPARATORS) {
      if (!message.includes(separator)) continue;
      const parts = message
        .split(separator)
        .map((part) => translateKnown(part, catalog, depth, false));
      if (parts.every((part): part is string => part !== null)) return parts.join(separator);
    }
  }

  for (const { pattern, key, raw, translatable } of SERVER_MESSAGE_PATTERNS) {
    const match = pattern.exec(message);
    if (!match) continue;
    const template = lookup(catalog, key);
    // No translated template: try the next shape rather than give up, so a
    // sentence can still fall through to a generic one.
    if (!template) continue;
    return template.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
      const captured = match[Number(index) + 1];
      if (captured === undefined) return placeholder;
      // One level of nesting is enough for "X import failed: <message>". A
      // captured noun is found whatever its case: the key is a lowercase slug.
      if (depth >= (translatable ? 2 : 1)) return captured;
      if (translatable) {
        if (!translatable.includes(Number(index))) return captured;
      } else if (raw) {
        return captured;
      }
      return translateKnown(captured, catalog, depth + 1, true) ?? captured;
    });
  }

  return null;
}

function translate(message: string, catalog: Record<string, unknown>): string {
  return translateKnown(message, catalog, 0, true) ?? message;
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
    return translate(message, catalog);
  } catch {
    return message;
  }
}

/**
 * The name of a form field for a validation summary ("Prix : champ requis"
 * rather than "price: …"). `path` is the field path the server reports
 * (`price`, `currentStock`, `items.0.quantity`): its last named segment is
 * looked up in the same catalog as the field nouns of the generic patterns
 * (`currentStock` → `current_stock`), and a row number is kept as "#1".
 *
 * Returns the path unchanged when the language is English, when its
 * dictionary has not loaded, or when the field has no entry. Never throws.
 */
export function localizeServerField(path: string | null | undefined, locale?: string): string {
  if (path === null || path === undefined) return "";
  if (typeof path !== "string" || path.length === 0) return path;
  try {
    const lang = activeLocale(locale);
    if (lang === "en") return path;
    const catalog = catalogFor(lang);
    if (!catalog) return path;
    const segments = path.split(/[.[\]]+/).filter(Boolean);
    const named = segments.filter((segment) => !/^\d+$/.test(segment));
    const field = named[named.length - 1];
    if (!field) return path;
    const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    const label = lookup(catalog, serverMessageKey(words));
    if (!label) return path;
    const row = segments.find((segment) => /^\d+$/.test(segment));
    return row === undefined ? label : `${label} #${Number(row) + 1}`;
  } catch {
    return path;
  }
}
