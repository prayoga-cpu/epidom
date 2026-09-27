import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isValidStoreSlug,
  normalizeSlugInput,
  slugifyStoreLink,
  storeLinkHost,
  storeLinkLabel,
} from "../store-link";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("slugifyStoreLink", () => {
  it.each([
    ["Crêperie du Port", "creperie-du-port"],
    ["Le Cœur de Lyon", "le-coeur-de-lyon"],
    ["Æble & Straße", "aeble-strasse"],
    ["  Mon Café !! ", "mon-cafe"],
    ["Warung Bu Tini — Kemang", "warung-bu-tini-kemang"],
    ["ÉPICERIE", "epicerie"],
    ["---", ""],
  ])("%s -> %s", (input, expected) => {
    expect(slugifyStoreLink(input)).toBe(expected);
  });

  it("caps the link at 50 characters without a trailing dash", () => {
    const slug = slugifyStoreLink(`${"a".repeat(49)} bcd`);
    expect(slug).toBe("a".repeat(49));
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it("matches the server's slugify on every example", async () => {
    // The service module pulls in Prisma (mocked in src/test/setup.ts); only
    // its pure slugify is used here.
    const { slugify } = await import("@/lib/services/onboarding.service");
    for (const name of [
      "Crêperie du Port",
      "Le Cœur de Lyon",
      "Æble & Straße",
      "Mon Café",
      "Warung Bu Tini — Kemang",
      "Ça va ? Bistro",
      "x".repeat(80),
    ]) {
      expect(slugifyStoreLink(name)).toBe(slugify(name));
    }
  });
});

describe("normalizeSlugInput", () => {
  it("keeps a trailing dash while typing", () => {
    expect(normalizeSlugInput("mon-")).toBe("mon-");
    expect(normalizeSlugInput("Mon Café")).toBe("mon-cafe");
    expect(normalizeSlugInput("--a__b")).toBe("a-b");
  });
});

describe("isValidStoreSlug", () => {
  it("accepts 3-50 lowercase letters, digits and dashes only", () => {
    expect(isValidStoreSlug("abc")).toBe(true);
    expect(isValidStoreSlug("ab")).toBe(false);
    expect(isValidStoreSlug("a".repeat(51))).toBe(false);
    expect(isValidStoreSlug("Abc")).toBe(false);
    expect(isValidStoreSlug("a_b")).toBe(false);
  });
});

describe("storeLinkLabel", () => {
  it("defaults to epidom.fr", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(storeLinkHost()).toBe("epidom.fr");
    expect(storeLinkLabel("mon-cafe")).toBe("epidom.fr/@mon-cafe");
  });

  it("uses the host of NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dev.epidom.fr/");
    expect(storeLinkLabel("mon-cafe")).toBe("dev.epidom.fr/@mon-cafe");
  });
});
