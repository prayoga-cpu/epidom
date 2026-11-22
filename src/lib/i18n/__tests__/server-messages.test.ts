import { afterEach, describe, expect, it, vi } from "vitest";

// The catalog under test: a tiny French dictionary, plus a Thai one with no
// `serverMessages` table at all. English is the baseline and is never read.
vi.mock("@/locales", () => {
  const fr = {
    serverMessages: {
      customer_not_found: "Client introuvable",
      customer: "Client",
      unknown_error: "Erreur inconnue",
      p_not_found: "{0} introuvable",
      p_not_found_with_id: "{0} avec l'identifiant « {1} » introuvable",
      p_rate_limit_seconds: "Trop de tentatives. Veuillez réessayer dans {0} secondes.",
      p_import_failed: "Échec de l'import ({0}) : {1}",
      p_zod_string_min: "Doit comporter au moins {0} caractère(s)",
      // Field nouns, and the shapes they fill.
      nickname: "Surnom",
      email: "E-mail",
      current_stock: "Stock actuel",
      quantity: "Quantité",
      p_is_required: "{0} : champ requis",
      p_min_characters: "{0} : {1} caractères minimum",
      // Success texts and partner admin.
      material_deleted_successfully: "Matière première supprimée",
      p_deleted_materials_in_category: "{0} matière(s) première(s) de cette catégorie supprimée(s)",
      p_imported_items_some_failed: "{0} élément(s) importé(s), {1} en échec",
      p_partner_code_used: "Le code {0} est déjà utilisé par un autre partenaire",
      p_sales_page_belongs_to: "{0} appartient déjà à {1}",
      p_table_exists: "La table « {0} » existe déjà",
      // The admin activity log's revert panel (src/lib/audit).
      this_action_has_already_been_reverted: "Cette action a déjà été annulée.",
      pending: "En attente",
      p_audit_action_in_state: "Cette action est à l'état « {0} » et ne peut pas être annulée.",
      p_audit_category_gone: "La catégorie « {0} » n'existe plus.",
      // The Claude connector's change history (src/lib/mcp/tools/menu.ts).
      p_menu_changed_one_linked: "Modification de 1 article du menu : {0} ; également défini : {1}",
      p_menu_changed_more: "Modification de {0} articles du menu : {1} et {2} autres",
      p_menu_added_many: "Ajout de {0} articles du menu : {1}",
      p_menu_linked_product: "produit lié {0} ({1}) à {2}",
      p_menu_linked_other_many: "{0} autres articles du menu liés à {1} à {2}",
      p_menu_category_renamed: "Catégorie {0} renommée en {1}",
      reordered_the_menu_categories: "Catégories du menu réordonnées",
      // Plan and status codes inside audit labels.
      p_plan_with_status: "{0} · {1}",
      p_audit_label_set_plan: "{0} passé à {1} (était {2})",
      p_audit_label_triage_feedback_both: "Retour {0} trié → {1} ({2})",
      active: "Actif",
      past_due: "Paiement en retard",
      in_progress: "En cours",
      urgent: "Urgent",
    },
  };
  const dictionaries: Record<string, unknown> = { en: {}, fr, th: {} };
  return { getLocaleMessages: (locale: string) => dictionaries[locale] };
});

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ locale: "fr", t: (key: string) => key }),
}));

import {
  SERVER_MESSAGE_PATTERNS,
  localizeServerField,
  localizeServerMessage,
  serverMessageKey,
} from "../server-messages";
import { useLocalizeServerMessage } from "../use-localize-server-message";

function setDocumentLang(lang: string) {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

afterEach(() => {
  setDocumentLang("");
});

describe("serverMessageKey", () => {
  it("slugs a sentence the same way every time", () => {
    expect(serverMessageKey("Customer not found")).toBe("customer_not_found");
    expect(serverMessageKey("Customer not found")).toBe(serverMessageKey("Customer not found"));
  });

  it("collapses punctuation and trims the ends", () => {
    expect(serverMessageKey("File size exceeds 5MB limit.")).toBe("file_size_exceeds_5mb_limit");
    expect(serverMessageKey("  Invalid time format (HH:MM)  ")).toBe("invalid_time_format_hh_mm");
    expect(serverMessageKey("A paid order's payment can't be changed")).toBe(
      "a_paid_order_s_payment_can_t_be_changed"
    );
  });

  it("never starts a key with a digit", () => {
    expect(serverMessageKey("3–32 letters, digits, - or _")).toBe("n_3_32_letters_digits_or");
  });

  it("truncates long sentences and keeps them apart with a stable hash", () => {
    const base =
      "A custom price is awaiting payment on this account. Complete that checkout from your Billing page";
    const a = serverMessageKey(`${base}.`);
    const b = serverMessageKey(`${base} instead.`);
    expect(a).not.toBe(b);
    expect(a).toBe(serverMessageKey(`${base}.`));
    expect(a).toMatch(/^[a-z][a-z0-9_]*$/);
    // 80 characters of slug, "_", and a short base-36 hash.
    expect(a.length).toBeLessThanOrEqual(80 + 1 + 7);
    expect(a.startsWith("a_custom_price_is_awaiting_payment_on_this_account")).toBe(true);
  });

  it("gives a key even to a message with no letters or digits", () => {
    expect(serverMessageKey("…")).toMatch(/^m_[a-z0-9]+$/);
  });
});

describe("localizeServerMessage", () => {
  it("translates a known message for a non-English locale", () => {
    expect(localizeServerMessage("Customer not found", "fr")).toBe("Client introuvable");
    expect(localizeServerMessage("Unknown error", "fr-FR")).toBe("Erreur inconnue");
  });

  it("returns an unknown message unchanged", () => {
    const message = "Something the catalog has never seen";
    expect(localizeServerMessage(message, "fr")).toBe(message);
  });

  it("leaves English, unknown languages and unloaded dictionaries alone", () => {
    expect(localizeServerMessage("Customer not found", "en")).toBe("Customer not found");
    expect(localizeServerMessage("Customer not found", "de")).toBe("Customer not found");
    // Thai is loaded but has no serverMessages table; Indonesian is not loaded.
    expect(localizeServerMessage("Customer not found", "th")).toBe("Customer not found");
    expect(localizeServerMessage("Customer not found", "id")).toBe("Customer not found");
  });

  it("fills a pattern message with its captured values", () => {
    expect(
      localizeServerMessage("Rate limit exceeded. Please try again in 42 seconds.", "fr")
    ).toBe("Trop de tentatives. Veuillez réessayer dans 42 secondes.");
    expect(localizeServerMessage("String must contain at least 3 character(s)", "fr")).toBe(
      "Doit comporter au moins 3 caractère(s)"
    );
  });

  it("translates a captured value that is itself a known message", () => {
    expect(localizeServerMessage("Customer with id 'c_1' not found", "fr")).toBe(
      "Client avec l'identifiant « c_1 » introuvable"
    );
    expect(localizeServerMessage("Product import failed: Unknown error", "fr")).toBe(
      "Échec de l'import (Product) : Erreur inconnue"
    );
  });

  it("keeps an unknown captured value as it came", () => {
    expect(localizeServerMessage("Widget not found", "fr")).toBe("Widget introuvable");
  });

  it("skips a pattern whose template is missing from the dictionary", () => {
    // "X is too long" is a known shape, but this dictionary has no template.
    expect(localizeServerMessage("Nickname is too long", "fr")).toBe("Nickname is too long");
  });

  it("translates the field noun inside a generic shape, whatever its case", () => {
    expect(localizeServerMessage("Nickname is required", "fr")).toBe("Surnom : champ requis");
    expect(localizeServerMessage("nickname is required", "fr")).toBe("Surnom : champ requis");
    expect(localizeServerMessage("NICKNAME must be at least 3 characters", "fr")).toBe(
      "Surnom : 3 caractères minimum"
    );
    expect(localizeServerMessage("Current stock is required", "fr")).toBe(
      "Stock actuel : champ requis"
    );
  });

  it("translates success texts, counted ones included", () => {
    expect(localizeServerMessage("Material deleted successfully", "fr")).toBe(
      "Matière première supprimée"
    );
    expect(localizeServerMessage("Deleted 3 material(s) in this category", "fr")).toBe(
      "3 matière(s) première(s) de cette catégorie supprimée(s)"
    );
    // The comma belongs to the sentence: it is not read as a list of messages.
    expect(localizeServerMessage("Imported 4 items successfully, 2 failed", "fr")).toBe(
      "4 élément(s) importé(s), 2 en échec"
    );
  });

  it("translates partner admin messages and leaves what was typed alone", () => {
    expect(localizeServerMessage("The code BOB10 is already used by another partner", "fr")).toBe(
      "Le code BOB10 est déjà utilisé par un autre partenaire"
    );
    // "email" is a catalog noun, but here it is somebody's referral code.
    expect(localizeServerMessage("The code EMAIL is already used by another partner", "fr")).toBe(
      "Le code EMAIL est déjà utilisé par un autre partenaire"
    );
    expect(localizeServerMessage('Table "Nickname" already exists', "fr")).toBe(
      "La table « Nickname » existe déjà"
    );
    expect(localizeServerMessage("/offer already belongs to Bob Martin", "fr")).toBe(
      "/offer appartient déjà à Bob Martin"
    );
  });

  it("translates a list of messages only when every part is known", () => {
    expect(
      localizeServerMessage("/a already belongs to Bob; /b already belongs to Ann", "fr")
    ).toBe("/a appartient déjà à Bob; /b appartient déjà à Ann");
    expect(localizeServerMessage("Nickname is required, Email is required", "fr")).toBe(
      "Surnom : champ requis, E-mail : champ requis"
    );
    const half = "Nickname is required, something the catalog has never seen";
    expect(localizeServerMessage(half, "fr")).toBe(half);
  });

  it("translates the audit log's revert refusals, static and with values", () => {
    // A static refusal: one sentence, one key.
    expect(localizeServerMessage("This action has already been reverted.", "fr")).toBe(
      "Cette action a déjà été annulée."
    );
    // The action state is a noun the catalog knows, so it is translated.
    expect(
      localizeServerMessage("This action is in state PENDING and cannot be reverted.", "fr")
    ).toBe("Cette action est à l'état « En attente » et ne peut pas être annulée.");
    // A category named like a catalog noun is data the owner typed: left alone.
    expect(localizeServerMessage('The category "Customer" no longer exists.', "fr")).toBe(
      "La catégorie « Customer » n'existe plus."
    );
  });

  it("never throws on empty or odd input", () => {
    expect(localizeServerMessage(null, "fr")).toBe("");
    expect(localizeServerMessage(undefined, "fr")).toBe("");
    expect(localizeServerMessage("", "fr")).toBe("");
    expect(() => localizeServerMessage(42 as unknown as string, "fr")).not.toThrow();
  });

  it("reads the language from <html lang> when none is given", () => {
    if (typeof document === "undefined") {
      // No DOM (server / node test run): English, so the message is untouched.
      expect(localizeServerMessage("Customer not found")).toBe("Customer not found");
      return;
    }
    setDocumentLang("fr");
    expect(localizeServerMessage("Customer not found")).toBe("Client introuvable");
    setDocumentLang("en");
    expect(localizeServerMessage("Customer not found")).toBe("Customer not found");
  });
});

describe("localizeServerField", () => {
  it("names a known field in the UI language", () => {
    expect(localizeServerField("nickname", "fr")).toBe("Surnom");
    expect(localizeServerField("currentStock", "fr")).toBe("Stock actuel");
  });

  it("keeps the row of a nested field", () => {
    expect(localizeServerField("items.0.quantity", "fr")).toBe("Quantité #1");
    expect(localizeServerField("items[2].quantity", "fr")).toBe("Quantité #3");
  });

  it("falls back to the raw path", () => {
    expect(localizeServerField("splitGroupId", "fr")).toBe("splitGroupId");
    expect(localizeServerField("nickname", "en")).toBe("nickname");
    // Thai is loaded but has no serverMessages table.
    expect(localizeServerField("nickname", "th")).toBe("nickname");
    expect(localizeServerField(null, "fr")).toBe("");
    expect(localizeServerField("", "fr")).toBe("");
  });
});

describe("SERVER_MESSAGE_PATTERNS", () => {
  it("puts the generic shapes after the specific ones", () => {
    const keys = SERVER_MESSAGE_PATTERNS.map((p) => p.key);
    expect(keys.indexOf("p_not_found_with_id")).toBeLessThan(keys.indexOf("p_not_found"));
    expect(keys.indexOf("p_product_sku_exists")).toBeLessThan(keys.indexOf("p_already_exists"));
    expect(keys.indexOf("p_barcode_max_length")).toBeLessThan(keys.indexOf("p_max_characters"));
    expect(keys.indexOf("p_sales_page_belongs_to")).toBeLessThan(keys.indexOf("p_already_exists"));
    expect(keys.indexOf("p_material_id_not_found")).toBeLessThan(keys.indexOf("p_not_found"));
  });

  it("never translates the captured values of a row marked raw", () => {
    const raw = SERVER_MESSAGE_PATTERNS.filter((p) => p.raw).map((p) => p.key);
    expect(raw).toContain("p_partner_code_used");
    expect(raw).toContain("p_table_exists");
    expect(raw).toContain("p_audit_category_gone");
    expect(raw).not.toContain("p_audit_action_in_state");
    // Resource and field nouns must stay translatable in the generic shapes.
    expect(raw).not.toContain("p_not_found");
    expect(raw).not.toContain("p_is_required");
  });
});

describe("useLocalizeServerMessage", () => {
  it("is bound to the provider's locale", () => {
    setDocumentLang("en");
    const localize = useLocalizeServerMessage();
    expect(localize("Customer not found")).toBe("Client introuvable");
    expect(localize(null)).toBe("");
  });
});

describe("the Claude connector's menu change history", () => {
  it("translates the sentence and its linked-product tail, never the item names", () => {
    expect(
      localizeServerMessage(
        "Changed 1 menu item: Customer; also set linked product Earl grey (EARL-GREY) to 45000.00",
        "fr"
      )
    ).toBe(
      "Modification de 1 article du menu : Customer ; également défini : produit lié Earl grey (EARL-GREY) à 45000.00"
    );
  });

  it("translates a tail made of several parts joined with a semicolon", () => {
    expect(
      localizeServerMessage(
        "Changed 1 menu item: A; also set linked product Tea (TEA) to 5.00; 2 other menu items linked to Tea to 5.00",
        "fr"
      )
    ).toBe(
      "Modification de 1 article du menu : A ; également défini : produit lié Tea (TEA) à 5.00; 2 autres articles du menu liés à Tea à 5.00"
    );
  });

  it("handles the count, the 'and N more' form and the verb", () => {
    expect(localizeServerMessage("Added 2 menu items: Tea, Coffee", "fr")).toBe(
      "Ajout de 2 articles du menu : Tea, Coffee"
    );
    expect(localizeServerMessage("Changed 5 menu items: A, B, C and 2 more", "fr")).toBe(
      "Modification de 5 articles du menu : A, B, C et 2 autres"
    );
  });

  it("translates the category sentences and leaves the names alone", () => {
    expect(localizeServerMessage("Renamed category Hot drinks to Coffee", "fr")).toBe(
      "Catégorie Hot drinks renommée en Coffee"
    );
    expect(localizeServerMessage("Reordered the menu categories", "fr")).toBe(
      "Catégories du menu réordonnées"
    );
  });

  it("returns an unknown variant unchanged", () => {
    expect(localizeServerMessage("Deleted 3 menu items: A, B, C", "fr")).toBe(
      "Deleted 3 menu items: A, B, C"
    );
  });
});

describe("codes inside audit labels", () => {
  it("translates the status of a plan and leaves the plan name and the email alone", () => {
    expect(localizeServerMessage("Set bob@x.com to POS/ACTIVE (was OPERATIONS/PAST_DUE)", "fr")).toBe(
      "bob@x.com passé à POS · Actif (était OPERATIONS · Paiement en retard)"
    );
  });

  it("translates feedback status and priority codes but not the feedback id", () => {
    expect(localizeServerMessage("Triaged feedback fb_1 -> IN_PROGRESS (URGENT)", "fr")).toBe(
      "Retour fb_1 trié → En cours (Urgent)"
    );
  });

  it("keeps a code it has no word for", () => {
    expect(localizeServerMessage("Triaged feedback fb_1 -> SOMETHING_NEW (URGENT)", "fr")).toBe(
      "Retour fb_1 trié → SOMETHING_NEW (Urgent)"
    );
  });
});
