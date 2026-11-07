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
  ...["label", "hint", "valid", "price", "unknown", "credited"].map(
    (k) => `onboarding.referral.${k}`
  ),
  "onboarding.store.planNote",
  "onboarding.store.planNoteSkip",
  "onboarding.actions.skipSetup",
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
    "trialStarting",
    "trialFailed",
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

  it("the trial copy says no card is needed (the trial starts without one, 3.41.0)", () => {
    for (const [locale, dict] of Object.entries(DICTS)) {
      for (const key of [
        "onboarding.store.planNote",
        "onboarding.launch.plan.trialBody",
        "checkout.success.trialSubtitle",
      ]) {
        expect(lookup(dict, key), `${locale}: ${key}`).toMatch(/no card|sans carte|tanpa kartu/i);
      }
    }
  });
});
