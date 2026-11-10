import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { SETTINGS_SECTIONS } from "../settings-sections";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

const get = (o: unknown, path: string) =>
  path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);
const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

describe("settings search sections", () => {
  const page = readFileSync("src/features/dashboard/profile/components/profile-client.tsx", "utf8");
  const transfer = readFileSync(
    "src/features/dashboard/profile/components/store-ownership-transfer-card.tsx",
    "utf8"
  );

  it("every section points at an element id that exists on the Settings page", () => {
    for (const s of SETTINGS_SECTIONS) {
      expect(page + transfer).toContain(`id="${s.anchor}"`);
    }
  });

  it("every section title exists in en, fr and id", () => {
    for (const s of SETTINGS_SECTIONS)
      for (const l of [en, fr, id]) expect(typeof get(l, s.labelKey)).toBe("string");
  });

  it("finds a section from English, Indonesian and French words", () => {
    const find = (q: string) =>
      SETTINGS_SECTIONS.filter((s) => fold(s.keywords).includes(fold(q))).map((s) => s.id);
    expect(find("tax rate")).toContain("fees");
    expect(find("pajak")).toContain("fees");
    expect(find("TVA")).toContain("fees");
    expect(find("wifi")).toContain("receipt");
    expect(find("reçu")).toContain("receipt");
    expect(find("spanduk")).toContain("customer-display");
    expect(find("mot de passe")).toContain("account");
  });
});
