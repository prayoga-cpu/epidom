import { describe, it, expect } from "vitest";
import { en } from "../en";
import { fr } from "../fr";
import { id } from "../id";
import { th } from "../th";

/**
 * The completeness gate for Thai. `t()` silently falls back to English for a
 * missing key, so nothing else notices a string that was never translated.
 * This test is what makes "every string is translated" checkable: it fails
 * the build when a key exists in any language but not in Thai, when a
 * placeholder was dropped or altered, or when a value is plain English.
 *
 * When you add a string to en.ts / fr.ts / id.ts, add its Thai here (th.ts).
 */

type Leaves = Map<string, string>;

function leaves(node: unknown, path = "", out: Leaves = new Map()): Leaves {
  if (typeof node === "string") out.set(path, node);
  else if (typeof node === "function") out.set(path, "__function__");
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      leaves(value, path ? `${path}.${key}` : key, out);
    }
  } else out.set(path, String(node));
  return out;
}

const EN = leaves(en);
const TH = leaves(th);
const UNION = new Set([...EN.keys(), ...leaves(fr).keys(), ...leaves(id).keys()]);

const THAI_SCRIPT = /[฀-๿]/;
const THAI_DIGITS = /[๐-๙]/;

const placeholders = (s: string) =>
  (s.match(/\$\{[^}]*\}|\{\{[^}]*\}\}|\{[A-Za-z0-9_.]+\}|%[sd]|<\/?[A-Za-z][^>]*>/g) ?? [])
    .sort()
    .join("|");

const numbers = (s: string): string[] => s.match(/\d+(?:[.,]\d+)*/g) ?? [];

/**
 * A value may legitimately equal its English source when it is a brand, plan
 * or product name, a code, a placeholder example, a URL or an e-mail: short,
 * no sentence in it. Anything longer that is identical to English is a missed
 * translation.
 */
function mayStayEnglish(english: string): boolean {
  const plain = english.replace(/\{[^}]*\}|<[^>]*>/g, "").trim();
  if (!/[A-Za-z]/.test(plain)) return true; // nothing translatable: placeholders, symbols, empty
  if (/@|https?:\/\/|^\/|^[+\d]/.test(plain)) return true;
  const words = plain.split(/\s+/);
  return words.length <= 3;
}

/**
 * English sentences the app builds from several keys (`title1 title2 accent title3`)
 * can be cut differently in Thai, leaving a piece empty on purpose.
 */
const INTENTIONALLY_EMPTY = new Set(["redesign.cta.title2"]);

describe("Thai dictionary completeness", () => {
  it("has every key that exists in English, French or Indonesian", () => {
    const missing = [...UNION].filter((key) => !TH.has(key));
    expect(missing, `Thai is missing ${missing.length} key(s)`).toEqual([]);
  });

  it("has no key the other languages do not have", () => {
    const extra = [...TH.keys()].filter((key) => !UNION.has(key));
    expect(extra).toEqual([]);
  });

  it("keeps every placeholder, tag and number of the English string", () => {
    const problems: string[] = [];
    for (const [key, english] of EN) {
      const thai = TH.get(key);
      if (thai === undefined || english === "__function__") continue;
      if (placeholders(english) !== placeholders(thai)) problems.push(`${key}: placeholders differ`);
      const remaining = numbers(thai);
      for (const n of numbers(english)) {
        const at = remaining.indexOf(n);
        if (at === -1) problems.push(`${key}: number ${n} missing`);
        else remaining.splice(at, 1);
      }
    }
    expect(problems).toEqual([]);
  });

  it("is written in Thai, not left in English", () => {
    const untranslated: string[] = [];
    for (const [key, thai] of TH) {
      if (thai === "__function__") continue;
      if (thai === "" && INTENTIONALLY_EMPTY.has(key)) continue;
      if (THAI_SCRIPT.test(thai)) continue;
      const english = EN.get(key);
      // Keys only French/Indonesian have (no English text) must still be Thai.
      if (english === undefined) {
        if (/[A-Za-z]{4,}/.test(thai) && !mayStayEnglish(thai)) untranslated.push(key);
        continue;
      }
      // Nothing translatable in the English (only placeholders/punctuation), so Thai may reshape it.
      if (!/[A-Za-z]/.test(english.replace(/\{[^}]*\}|<[^>]*>/g, ""))) continue;
      if (thai !== english || !mayStayEnglish(english)) untranslated.push(key);
    }
    expect(untranslated, `${untranslated.length} value(s) still in English`).toEqual([]);
  });

  it("uses Arabic digits only and no zero-width characters", () => {
    const bad = [...TH]
      .filter(([, value]) => THAI_DIGITS.test(value) || /[​‌‍﻿]/.test(value))
      .map(([key]) => key);
    expect(bad).toEqual([]);
  });

  it("still renders the footer line for the current year", () => {
    const rights = (th as { footer: { rights: (year: number) => string } }).footer.rights;
    expect(rights(2026)).toContain("2026");
    expect(rights(2026)).toMatch(THAI_SCRIPT);
  });
});
