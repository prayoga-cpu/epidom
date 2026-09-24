import { describe, it, expect } from "vitest";
import { en } from "../en";
import { fr } from "../fr";
import { id } from "../id";

/**
 * The Services page (redesign.servicesPage) was rewritten for Epidom 3 after a
 * claim-by-claim check against the code. The patterns below are the claims it
 * used to make that the product does not back up; they are pinned out so they
 * don't come back with the next copy pass. See each note for what is true.
 */

const LOCALES = { en, fr, id } as const;

function leaves(obj: unknown, prefix = ""): [string, string][] {
  if (typeof obj === "string") return [[prefix, obj]];
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k)
  );
}

const services = (dict: (typeof LOCALES)[keyof typeof LOCALES]) => dict.redesign.servicesPage;

const UNBACKED_CLAIMS: [label: string, pattern: RegExp][] = [
  // No allergen or nutrition data exists on recipes, products or menu items.
  ["allergen labels", /allerg|alergen/i],
  ["nutrition labels", /nutrition|nutrisi/i],
  // Finance exports to Excel and prints; there is no FEC, GST or tax-ready export.
  ["FEC / GST exports", /\bFEC\b|\bGST\b|siap pajak|tax-ready/i],
  // Menu items are stored in one language; only the app chrome is translated.
  [
    "auto-translated menus",
    /auto-translat|traduction automatique|diterjemahkan otomatis|multiling|multibahasa/i,
  ],
  // There is no shareable story/product-card image export.
  ["IG-story cards", /IG[- ]story|stories IG|story IG/i],
  // Payout timing is the payment provider's (and differs by method), not Epidom's.
  ["next-day settlement", /next[- ](business )?day|lendemain|keesokan|settle|reversement/i],
  // Only the till's cash drawer is reconciled; no payment-to-bank matching exists.
  ["automatic reconciliation", /reconcil|rapprochement|rekonsiliasi/i],
  // A shift belongs to the store (2.94.0); reports name who opened it.
  ["per-server cash-out", /per server|par serveur|per pelayan/i],
  // Only the last-used view is remembered per device; there are no named views.
  ["saved views", /saved view|vues enregistrées|tampilan tersimpan/i],
  // Low-stock alerts are in-app only.
  [
    "reorder alerts by WhatsApp/email",
    /reorder alert|alertes? de réapprovisionnement|peringatan pemesanan ulang/i,
  ],
  // The kitchen display has no sound.
  ["KDS audio alert", /audio|sound|sonore|\bsuara\b/i],
  // Tables can't be merged or moved.
  ["merge/move tables", /(merge|move) tables?|fusion(ner)? (de )?tables|gabung meja|pindah meja/i],
];

describe("Services page copy", () => {
  it("has the same keys in French and Indonesian as in English, none of them empty", () => {
    const enKeys = leaves(services(en)).map(([k]) => k);
    for (const [loc, dict] of Object.entries(LOCALES)) {
      const entries = leaves(services(dict));
      expect(
        entries.map(([k]) => k),
        loc
      ).toEqual(enKeys);
      for (const [key, value] of entries) expect(value.trim(), `${loc}.${key}`).not.toBe("");
    }
  });

  it.each(Object.entries(LOCALES))("%s: makes none of the unbacked claims", (_loc, dict) => {
    for (const [key, text] of leaves(services(dict))) {
      for (const [label, pattern] of UNBACKED_CLAIMS) {
        expect(text, `${key} makes the "${label}" claim`).not.toMatch(pattern);
      }
    }
  });

  it.each(Object.entries(LOCALES))(
    "%s: shows the storefront address the product itself shows",
    (_loc, dict) => {
      // The editor, the QR code and the canonical URL all say epidom.fr/@slug.
      expect(services(dict).r1b1).toMatch(/epidom\.fr\/@/);
    }
  );

  it.each(Object.entries(LOCALES))(
    "%s: every feature row and tile names the plan it needs",
    (_loc, dict) => {
      const copy = services(dict) as Record<string, string>;
      for (const key of ["s1", "s2", "s3", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"]) {
        expect(copy[`${key}plan`], key).toEqual(expect.any(String));
      }
      for (let n = 1; n <= 8; n++) expect(copy[`m${n}plan`], `m${n}`).toEqual(expect.any(String));
    }
  );

  it("keeps the case-sensitive guards honest", () => {
    // A pattern that can never match is a silent pass; pin each to the old wording.
    const oldWording = [
      "Allergen + nutrition labels",
      "TVA / FEC / GST-ready exports",
      "Multilingual menus (auto-translated)",
      "IG-story-friendly product cards",
      "Settlement is next-day.",
      "Auto reconciliation with daily reports",
      "Shift management + cash-out per server",
      "Custom date ranges & saved views",
      "Reorder alerts via WhatsApp or email",
      "Étiquettes allergènes et nutritionnelles",
      "Menus multilingues (traduction automatique)",
      "Reversement le lendemain.",
      "Rapprochement automatique avec les rapports journaliers",
      "Gestion du staff et clôture de caisse par serveur",
      "Label alergen + nutrisi",
      "Menu multibahasa (diterjemahkan otomatis)",
      "Pencairan keesokan hari.",
      "Manajemen shift + kas keluar per pelayan",
      "Ekspor siap pajak",
    ];
    for (const wording of oldWording) {
      expect(
        UNBACKED_CLAIMS.some(([, pattern]) => pattern.test(wording)),
        wording
      ).toBe(true);
    }
  });
});
