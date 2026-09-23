import { describe, it, expect } from "vitest";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

type Node = string | { [k: string]: Node };
const root = (l: unknown) => (l as { redesign: Record<string, Node> }).redesign;

function leaves(node: Node, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}
function get(node: Node, path: string): Node | undefined {
  return path.split(".").reduce<Node | undefined>((n, k) => {
    if (n === undefined || typeof n === "string") return undefined;
    return n[k];
  }, node);
}

// t() falls back to English silently, so a key missing from fr or id never
// fails loudly: it just ships English text to a French or Indonesian visitor.
describe.each(["pricingPage", "pricingTeaser", "faq"])("redesign.%s locale parity", (section) => {
  const enLeaves = leaves(root(en)[section]);

  it.each([
    ["fr", fr],
    ["id", id],
  ] as const)("%s has every key that en has", (_name, dict) => {
    const missing = enLeaves.filter((k) => typeof get(root(dict)[section], k) !== "string");
    expect(missing).toEqual([]);
  });

  it.each([
    ["fr", fr],
    ["id", id],
  ] as const)("%s has no key that en lacks", (_name, dict) => {
    const extra = leaves(root(dict)[section]).filter(
      (k) => typeof get(root(en)[section], k) !== "string"
    );
    expect(extra).toEqual([]);
  });
});

describe("fr /pricing flagship promo is translated", () => {
  const page = root(fr).pricingPage as Record<string, string>;
  const enPage = root(en).pricingPage as Record<string, string>;
  it.each([
    "trialBadge",
    "promoTrialNote",
    "startTrialCta",
    "cmp_waste",
    "cmp_owner_dashboard",
    "cmp_finance",
  ])("%s is real French, not the English string", (key) => {
    expect(page[key]).toBeTruthy();
    expect(page[key]).not.toBe(enPage[key]);
  });
});

describe("one plan is marked most popular", () => {
  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("Operations' tag in %s says nothing about popularity", (_name, dict) => {
    const r = root(dict);
    for (const tag of [
      (r.pricingPage as Record<string, string>).t3tag,
      (r.pricingTeaser as Record<string, string>).t3tag,
    ]) {
      expect(tag).toBeTruthy();
      expect(tag).not.toMatch(/popul/i);
    }
  });

  it("the teaser and the page use the same Operations tag", () => {
    for (const dict of [en, fr, id]) {
      const r = root(dict);
      expect((r.pricingTeaser as Record<string, string>).t3tag).toBe(
        (r.pricingPage as Record<string, string>).t3tag
      );
    }
  });
});

describe("support email is no longer hardcoded into the FAQ strings", () => {
  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("%s redesign.faq has no helpEmail and no @prionation.io", (_name, dict) => {
    const faq = root(dict).faq as Record<string, string>;
    expect(faq.helpEmail).toBeUndefined();
    expect(JSON.stringify(faq)).not.toContain("prionation.io");
  });
});

// The 14-day trial is POS-only (the checkout route applies it when plan is POS).
// Operations used to read "Start free trial", promising something it does not have.
describe("only the POS plan's CTA mentions a trial", () => {
  const TRIAL = /trial|essai|uji coba/i;

  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("%s: t1cta, t3cta and t4cta do not, t2cta does", (_name, dict) => {
    const page = root(dict).pricingPage as Record<string, string>;
    for (const key of ["t1cta", "t3cta", "t4cta"]) {
      expect(page[key]).toBeTruthy();
      expect(page[key]).not.toMatch(TRIAL);
    }
    expect(page.t2cta).toMatch(TRIAL);
  });

  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("%s: Operations' CTA names the plan, like its tier name", (_name, dict) => {
    const page = root(dict).pricingPage as Record<string, string>;
    expect(page.t3cta).toContain(page.t3name);
  });
});

describe("customer-facing checkout errors", () => {
  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)(
    "%s: errCheckoutStart does not send a customer to a Stripe configuration",
    (_name, dict) => {
      const message = (root(dict).pricingPage as Record<string, string>).errCheckoutStart;
      expect(message).toBeTruthy();
      expect(message).not.toMatch(/stripe|config/i);
    }
  );
});

describe("pricing feature comparison header", () => {
  it("is translated, not left as the English word in fr and id", () => {
    const feature = (d: unknown) => (root(d).pricingPage as Record<string, string>).cmpFeature;
    expect(feature(en)).toBe("Feature");
    expect(feature(fr)).toBe("Fonctionnalité");
    expect(feature(id)).toBe("Fitur");
  });
});

// These held the old /payments page's plan cards ("Le Plus Populaire" on
// Operations, "Paiement CB & Lydia", the old prices). The page is gone and
// nothing reads them; they must not come back as copy that contradicts /pricing.
describe("retired top-level locale namespaces stay gone", () => {
  it.each([
    ["en", en],
    ["fr", fr],
    ["id", id],
  ] as const)("%s has no top-level `pricing` or `choosePlan`", (_name, dict) => {
    expect(dict).not.toHaveProperty("pricing");
    expect(dict).not.toHaveProperty("choosePlan");
  });
});
