import { describe, it, expect } from "vitest";
import { en } from "../en";
import { fr } from "../fr";
import { id } from "../id";

/**
 * Copy that lost its reader and was deleted, pinned so it does not come back by
 * a merge or a copy-paste from an old branch.
 *
 * - paymentsPage / paymentsComponents were the strings of the old /payments page,
 *   which no longer exists. One of them told the reader "This is a demo; all actions
 *   are simulated" on what is a real billing surface.
 * - contact.title / subtitle / labels / map / info were the pre-redesign contact page
 *   (the live copy is contact.page.*).
 * - redesign.hero.headline3 duplicated redesign.hero.headlineAccent, which the hero reads.
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

const GONE = [
  "paymentsPage",
  "paymentsComponents",
  "contact.title",
  "contact.subtitle",
  "contact.labels",
  "contact.map",
  "contact.info",
  "redesign.hero.headline3",
  // Orphans of the deleted /payments page and a change-password block nothing read.
  "pricing",
  "choosePlan",
  "password",
];

// The wording of the simulated-billing disclaimer, per language.
const DEMO_DISCLAIMER = [
  /all actions are simulated/i,
  /toutes les actions sont simul/i,
  /semua tindakan disimulasikan/i,
];

describe.each(Object.entries(LOCALES))("removed copy (%s)", (_name, dict) => {
  it.each(GONE)("%s is gone", (path) => {
    expect(dig(dict, path)).toBeUndefined();
  });

  it("no longer tells anyone the billing page is a simulated demo", () => {
    const everything = JSON.stringify(dict);
    for (const pattern of DEMO_DISCLAIMER) expect(everything).not.toMatch(pattern);
  });

  it("keeps what replaced them", () => {
    expect(dig(dict, "redesign.hero.headlineAccent")).toEqual(expect.any(String));
    expect(dig(dict, "contact.page.title1")).toEqual(expect.any(String));
  });
});
