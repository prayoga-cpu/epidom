import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-epidom-locale": "id" }) }));

import { buildLegalMetadata, getRequestLocale, legalMetadata, type LegalPage } from "../metadata";

const PAGES: LegalPage[] = ["privacy", "cookie-policy", "gdpr", "terms", "refund-policy"];

describe("legal page metadata", () => {
  it.each(PAGES)(
    "%s: canonical points at the locale that is served, hreflang lists all three",
    (page) => {
      const fr = buildLegalMetadata(page, "fr");
      const id = buildLegalMetadata(page, "id");
      const en = buildLegalMetadata(page, "en");

      expect(fr.alternates?.canonical).toBe(`https://epidom.fr/${page}`);
      expect(id.alternates?.canonical).toBe(`https://epidom.fr/id/${page}`);
      expect(en.alternates?.canonical).toBe(`https://epidom.fr/en/${page}`);

      expect(id.alternates?.languages).toEqual({
        fr: `https://epidom.fr/${page}`,
        id: `https://epidom.fr/id/${page}`,
        en: `https://epidom.fr/en/${page}`,
        "x-default": `https://epidom.fr/${page}`,
      });
    }
  );

  it.each(PAGES)("%s: the title and description are in the visitor's language", (page) => {
    const titles = (["fr", "id", "en"] as const).map((l) => {
      const m = buildLegalMetadata(page, l);
      expect(m.description).toBeTruthy();
      return (m.title as { default: string }).default;
    });
    // gdpr and id/en share "GDPR"; every other page differs between languages.
    expect(new Set(titles).size).toBeGreaterThanOrEqual(page === "gdpr" ? 2 : 3);
    for (const t of titles) expect(t).toMatch(/EPIDOM$/);
  });

  it.each(PAGES)(
    "%s: French titles and descriptions use a no-break space before : ; ? !",
    (page) => {
      const m = buildLegalMetadata(page, "fr");
      expect(String(m.description)).not.toMatch(/ [:;?!]/);
      expect((m.title as { default: string }).default).not.toMatch(/ [:;?!]/);
    }
  );

  it("the French terms and refund descriptions keep their colon glued to the name", () => {
    expect(buildLegalMetadata("terms", "fr").description).toContain("d'EPIDOM : conditions");
    expect(buildLegalMetadata("refund-policy", "fr").description).toContain(
      "d'EPIDOM : conditions"
    );
  });

  it("uses the locale header the proxy sets", async () => {
    expect(await getRequestLocale()).toBe("id");
    const meta = await legalMetadata("privacy")();
    expect(meta.alternates?.canonical).toBe("https://epidom.fr/id/privacy");
  });

  it("keeps the site-wide share image", () => {
    const m = buildLegalMetadata("privacy", "fr");
    expect((m.openGraph as { images?: unknown[] }).images?.length).toBeGreaterThan(0);
    expect((m.openGraph as { locale?: string }).locale).toBe("fr_FR");
  });
});
