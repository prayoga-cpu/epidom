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
    // "X is required" is a known shape, but this dictionary has no template.
    expect(localizeServerMessage("Nickname is required", "fr")).toBe("Nickname is required");
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

describe("SERVER_MESSAGE_PATTERNS", () => {
  it("puts the generic shapes after the specific ones", () => {
    const keys = SERVER_MESSAGE_PATTERNS.map((p) => p.key);
    expect(keys.indexOf("p_not_found_with_id")).toBeLessThan(keys.indexOf("p_not_found"));
    expect(keys.indexOf("p_product_sku_exists")).toBeLessThan(keys.indexOf("p_already_exists"));
    expect(keys.indexOf("p_barcode_max_length")).toBeLessThan(keys.indexOf("p_max_characters"));
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
