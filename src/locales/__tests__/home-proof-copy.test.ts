import { describe, it, expect } from "vitest";
import { en } from "../en";
import { fr } from "../fr";
import { id } from "../id";

/**
 * The home page and About page used to carry invented proof: customer counts,
 * a rating, and named testimonials from shops that were never sourced. In
 * France/EU a fabricated endorsement is a legal exposure, so this pins the
 * removal in every locale and stops the numbers creeping back in.
 */

const LOCALES = { en, fr, id } as const;

function dig(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      obj
    );
}

function leaves(obj: unknown, prefix = ""): [string, string][] {
  if (typeof obj === "string") return [[prefix, obj]];
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k)
  );
}

const REMOVED_STRINGS = [
  "500+",
  "20+",
  "10k+",
  "4.9",
  "4,9",
  "Warung Sari",
  "Café Bretonne",
  "Maison Lacroix",
  "Kopi Tujuh",
  "Cookie Atelier",
  "Le Petit Bar",
  "Sari Dewi",
  "Budi Santoso",
  "Rina Kusuma",
  "Léa Marchand",
  "Hugo Lambert",
  "Théo Vasseur",
];

// Only the subtrees this work owns; other pages have their own claims.
const OWNED_SUBTREES = [
  "redesign.landing",
  "redesign.caseStudies",
  "about",
  "redesign.cta",
  "redesign.faq",
  "redesign.servicesPage",
  "redesign.dashboard",
];

/** Home sections the 2026-09 homepage spec dropped: their copy went with them. */
const DROPPED_SUBTREES = [
  "redesign.hero",
  "redesign.trust",
  "redesign.useCases",
  "redesign.setup",
  "redesign.oldVsNew",
  "redesign.features",
  "redesign.oneLink",
  "redesign.coreProducts",
  "redesign.pricingTeaser",
];

/**
 * The four "use case" tabs each carried a named, quoted customer plus two
 * outcome figures, none of it sourced. Names, places and figures are pinned out
 * here; the keys themselves are pinned out below.
 */
const REMOVED_USE_CASE_PROOF = [
  "Coffee Shop, Bandung",
  "Café Owner, Yogyakarta",
  "Home Restaurant, Surabaya",
  "Cookie Atelier, Bordeaux",
  "Bandung",
  "Yogyakarta",
  "Surabaya",
  "Bordeaux",
  "+34%",
  "+27%",
  "28%",
  "38%",
  "orders via IG link",
  "kitchen wait time",
  "lost paper tickets",
  "flour waste",
  "mystery cash gaps",
  "shift handover",
  "weekend revenue",
];

/**
 * What the merchant is (not) sent. New-order alerts are in-app: the notification
 * bell and the open dashboard. notifyMerchantNewOrder, the only WhatsApp message
 * to a merchant, is never called, and the Fonnte gateway is disabled
 * (docs/ENVIRONMENT.md), so no WhatsApp ping reaches the merchant. No code emails
 * a nightly digest either. WhatsApp copy belongs to the customer's ordering link
 * (wa.me), never to something the merchant receives.
 *
 * Scanned over OWNED_SUBTREES, through FALSE_CLAIMS.
 */
const NOTIFICATION_CLAIMS: [label: string, pattern: RegExp][] = [
  ["merchant WhatsApp ping", /WhatsApp ping|ping WhatsApp|WA ping|ping WA\b/i],
  [
    "merchant WhatsApp notification",
    /WhatsApp (business )?notif|notif\w* (business )?WhatsApp|notifs? WA\b/i,
  ],
  ["new-order chip 'via WA'", /(new order|nouvelle commande|pesanan baru) via WA\b/i],
  ["one email per night", /one email per night|un e-mail par nuit|satu email per malam/i],
];

/**
 * Claims the product does not back up. Each pattern is a phrase that used to be
 * on the home or services page. See the notes on each one for what is actually
 * true in the code.
 */
const FALSE_CLAIMS: [label: string, pattern: RegExp][] = [
  // Menu import reads .csv/.txt only (and that is a paid feature); the only image
  // analysis is the onboarding Instagram-profile screenshot. No menu-photo OCR.
  ["menu-photo OCR", /\bOCR\b/],
  ["menu-photo import (en)", /photo of your (current|existing) menu/i],
  ["menu-photo import (fr)", /photo de (votre menu|l['’]existant)/i],
  ["menu-photo import (id)", /foto menu/i],
  // WhatsApp goes through Fonnte, a third-party gateway; there is no broadcast feature.
  ["official WhatsApp API", /official WA API|API WA officielle|API WA resmi/i],
  ["WhatsApp broadcast", /broadcast|diffusion de nouveaux menus/i],
  // No code e-mails a daily report; it is opened, printed or saved as PDF on demand.
  ["reports emailed at midnight", /midnight|minuit|tengah malam/i],
  [
    "reports emailed every night",
    /emailed every night|par e-mail chaque soir|diemail setiap malam/i,
  ],
  ["auto-emailed P&L", /auto-emailed|par e-mail automatique|dikirim otomatis/i],
  ["fictional report recipient", /@(warungsari|cookieatelier)|23:59/i],
  // The databases are in Singapore, so "regional data centers" reads as EU hosting to a French visitor.
  ["regional data centers", /regional data cent|data centers? régionaux|pusat data regional/i],
  // The setup time was never measured. This also catches "Five minutes." /
  // "Cinq minutes." / "Lima menit.", the opener of the old blog CTA.
  [
    "measured setup time",
    /\b(5|five|cinq|lima)[-\s]?(min\b|minute|menit)|5\s?[–-]\s?10\s?min|setup 5|5 min de config/i,
  ],
  ...NOTIFICATION_CLAIMS,
];

// The wording each guard was written for, so a pattern cannot quietly go vacuous.
const REMOVED_WORDING = [
  "You just get a WhatsApp ping.",
  "Vos clients commandent et paient depuis un seul lien. Vous recevez juste une notification WhatsApp.",
  "Kamu tinggal terima notifikasi WhatsApp.",
  "Auto WhatsApp ping the moment they pay.",
  "Notif WhatsApp automatique dès qu'ils paient.",
  "Notif WhatsApp otomatis begitu mereka bayar.",
  "WhatsApp business notifications",
  "Notifications WhatsApp business",
  "Notifikasi WhatsApp bisnis",
  "New order via WA",
  "Nouvelle commande via WA",
  "Pesanan baru via WA",
  "Epidom sends one WhatsApp ping per order and one email per night. That's it.",
  "Epidom envoie un ping WhatsApp par commande et un e-mail par nuit. C'est tout.",
  "Epidom mengirim satu ping WhatsApp per pesanan dan satu email per malam. Itu saja.",
  "Five minutes. No card. Your first link is free forever.",
  "Cinq minutes. Sans carte. Votre premier lien est gratuit pour toujours.",
  "Lima menit. Tanpa kartu. Link pertamamu gratis selamanya.",
];

describe("false-claim guard", () => {
  it.each(REMOVED_WORDING)("still catches: %s", (wording) => {
    expect(FALSE_CLAIMS.some(([, pattern]) => pattern.test(wording))).toBe(true);
  });

  it("does not trip on the customer's WhatsApp ordering link", () => {
    for (const fine of [
      "Send it on WhatsApp.",
      "Digital receipts sent to your customers on WhatsApp.",
      "You get a notification as soon as an order comes in.",
    ]) {
      expect(NOTIFICATION_CLAIMS.some(([, pattern]) => pattern.test(fine))).toBe(false);
    }
  });
});

describe.each(Object.entries(LOCALES))("home + about copy (%s)", (_name, dict) => {
  it("has no testimonials namespace", () => {
    expect(dig(dict, "redesign.testimonials")).toBeUndefined();
  });

  it("has no invented customer numbers or named customers in the owned subtrees", () => {
    for (const subtree of OWNED_SUBTREES) {
      for (const [path, text] of leaves(dig(dict, subtree), subtree)) {
        for (const banned of REMOVED_STRINGS) {
          expect(text, `${path} still contains "${banned}"`).not.toContain(banned);
        }
      }
    }
  });

  it("dropped the old hero proof keys and the About stat card keys", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(dig(dict, `redesign.hero.proof${n}Val`)).toBeUndefined();
      expect(dig(dict, `redesign.hero.proof${n}Label`)).toBeUndefined();
      expect(dig(dict, `about.stat${n}label`)).toBeUndefined();
      expect(dig(dict, `about.stat${n}value`)).toBeUndefined();
    }
    expect(dig(dict, "about.numbersLabel")).toBeUndefined();
  });

  it("has the case-study section copy", () => {
    for (const key of ["eyebrow", "title1", "title2", "source", "readStory"]) {
      expect(dig(dict, `redesign.caseStudies.${key}`), key).toEqual(expect.any(String));
    }
  });

  it("no longer says the trust bar is 'trusted by' customers", () => {
    const label = dig(dict, "redesign.landing.trust.label") as string;
    expect(label).toEqual(expect.any(String));
    expect(label.toLowerCase()).not.toMatch(/trusted|adopté|dipercaya/);
  });
  it("makes none of the false feature, delivery, hosting or timing claims", () => {
    for (const subtree of OWNED_SUBTREES) {
      for (const [path, text] of leaves(dig(dict, subtree), subtree)) {
        for (const [label, pattern] of FALSE_CLAIMS) {
          expect(text, `${path} makes the "${label}" claim`).not.toMatch(pattern);
        }
      }
    }
  });

  it("has every KDS mockup string, with a {count} placeholder in the header", () => {
    for (const key of ["live", "kitchen", "tickets", "table4", "walkIn", "igLink", "markReady"]) {
      expect(dig(dict, `redesign.dashboard.kds.${key}`), key).toEqual(expect.any(String));
    }
    expect(dig(dict, "redesign.dashboard.kds.kitchen")).toContain("{count}");
  });

  it("no longer states an average support response time or fixed support hours on the contact page", () => {
    expect(dig(dict, "contact.page.responseTime")).toBeUndefined();
    expect(dig(dict, "contact.page.responseVal")).toBeUndefined();
    for (const [path, text] of leaves(dig(dict, "contact.page"), "contact.page")) {
      expect(text, `${path} names WIB hours`).not.toMatch(/\bWIB\b/);
      expect(text, `${path} promises an average response time`).not.toMatch(
        /(< ?4 ?(h|jam))|avg\.? response|temps de réponse moyen|rata-rata waktu/i
      );
    }
    // The one commitment that stays.
    expect(dig(dict, "contact.page.script")).toMatch(/24/);
  });
  it("has none of the home sections the 2026-09 homepage spec dropped", () => {
    for (const subtree of DROPPED_SUBTREES) {
      expect(dig(dict, subtree), subtree).toBeUndefined();
    }
  });

  it("never says the Free plan takes online orders or payments (ordering is a POS feature)", () => {
    // FEATURE_MIN_PLAN.onlineOrders is POS, enforced in POST /api/public/orders.
    const onlineOrders =
      /online orders?|orders? online|commandes? en ligne|paiements? (en ligne|carte)|pesanan online|pembayaran (online|QRIS)|card \/ bank/i;
    const freeLines = [
      "redesign.landing.pricing.freeDesc",
      ...[1, 2, 3, 4, 5].map((n) => `redesign.pricingPage.t1f${n}`),
    ];
    for (const path of freeLines) {
      const line = dig(dict, path);
      expect(line, path).toEqual(expect.any(String));
      expect(line as string, path).not.toMatch(onlineOrders);
    }
    // The Free FAQ answer may name ordering, but only as what POS adds.
    expect(dig(dict, "redesign.faq.a1")).toMatch(/POS/);
  });

  it("makes no AI claim on the home page", () => {
    for (const [path, text] of leaves(dig(dict, "redesign.landing"), "redesign.landing")) {
      expect(text, path).not.toMatch(/\bAI\b|\bIA\b|intelligen|kecerdasan buatan/i);
    }
  });
});

describe("home page copy across languages", () => {
  const landing = (dict: unknown) =>
    Object.fromEntries(leaves(dig(dict, "redesign.landing"), "redesign.landing"));

  it("has the same redesign.landing keys in fr, en and id", () => {
    const keys = Object.keys(landing(en)).sort();
    expect(keys.length).toBeGreaterThan(100);
    expect(Object.keys(landing(fr)).sort()).toEqual(keys);
    expect(Object.keys(landing(id)).sort()).toEqual(keys);
  });

  it("keeps every {placeholder} in every language", () => {
    const en_ = landing(en);
    for (const dict of [fr, id]) {
      const other = landing(dict);
      for (const [path, text] of Object.entries(en_)) {
        const wanted = (text.match(/\{\w+\}/g) ?? []).sort();
        expect((other[path].match(/\{\w+\}/g) ?? []).sort(), path).toEqual(wanted);
      }
    }
  });

  it("fr: never names Just Eat, which no longer operates in France", () => {
    for (const [path, text] of Object.entries(landing(fr))) {
      expect(text, path).not.toMatch(/just ?eat/i);
    }
  });
});
