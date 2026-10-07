import { describe, expect, it } from "vitest";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

/**
 * The copy for "the plan picked goes on to Checkout" (setup's goals hint and
 * launch screen, and the Checkout success / cancel pages): every key in all
 * three languages, real translations, and never a claim the flow can't keep.
 */
const DICTS = { en, fr, id } as const;

function lookup(dict: object, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], dict);
}

const KEYS = [
  ...["trial", "pos", "operations", "stayFree"].map((k) => `onboarding.goals.next.${k}`),
  ...[
    "trialTitle",
    "trialBody",
    "trialCta",
    "posTitle",
    "posBody",
    "operationsTitle",
    "operationsBody",
    "checkoutCta",
    "redirecting",
    "failed",
  ].map((k) => `onboarding.launch.plan.${k}`),
  ...["continueToStore", "trialTitle", "trialSubtitle", "trialMessage", "trialStatus"].map(
    (k) => `checkout.success.${k}`
  ),
  ...["canceledTitle", "canceledSubtitle", "continueToStore"].map((k) => `checkout.failed.${k}`),
];

describe("plan Checkout copy", () => {
  it.each(Object.keys(DICTS) as (keyof typeof DICTS)[])("has every key in %s", (locale) => {
    for (const key of KEYS) {
      const value = lookup(DICTS[locale], key);
      expect(typeof value === "string" && value.trim().length > 0, `${locale}: ${key}`).toBe(true);
    }
  });

  it.each(["fr", "id"] as const)("%s is translated, not English left in place", (locale) => {
    for (const key of KEYS) {
      expect(lookup(DICTS[locale], key), `${locale}: ${key}`).not.toBe(lookup(en, key));
    }
  });

  it("the old launch-screen trial keys are gone", () => {
    for (const dict of Object.values(DICTS)) {
      expect(lookup(dict, "onboarding.launch.posTrial")).toBeUndefined();
    }
  });

  it("the trial copy says a card is added, and never that no card is needed", () => {
    for (const [locale, dict] of Object.entries(DICTS)) {
      const text = [
        lookup(dict, "onboarding.goals.next.trial"),
        lookup(dict, "onboarding.launch.plan.trialBody"),
      ].join(" ");
      expect(text, locale).toMatch(/card|carte|kartu/i);
      expect(text, locale).not.toMatch(/no card|sans carte|tanpa kartu/i);
    }
  });
});
