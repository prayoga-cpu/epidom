import { afterEach, describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import { ChangelogView } from "../changelog-view";

const DICTS = { en, fr, id } as const;

const RELEASES = [
  {
    version: "2.96.0",
    // Date-only in CHANGELOG.md, stored as UTC midnight.
    releasedAt: "2026-08-09T00:00:00.000Z",
    tag: "feat" as const,
    items: ["**Zoom on the till.** Capped so a phone layout cannot break."],
  },
  {
    version: "2.95.1",
    releasedAt: "2026-07-01T00:00:00.000Z",
    tag: "fix" as const,
    items: ["Fixed a thing."],
  },
  {
    version: "2.95.0",
    releasedAt: "2026-06-15T00:00:00.000Z",
    tag: "infra" as const,
    items: ["Moved a thing."],
  },
  {
    version: "2.94.0",
    releasedAt: "2026-05-02T00:00:00.000Z",
    tag: "ux" as const,
    items: ["Polished a thing."],
  },
];

function renderView(locale: Locale, releases = RELEASES) {
  return render(
    <EagerI18nProvider initialLocale={locale}>
      <ChangelogView releases={releases} />
    </EagerI18nProvider>
  );
}

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("ChangelogView chrome", () => {
  it.each(["en", "fr", "id"] as const)(
    "localizes the heading, subtitle and note in %s",
    (locale) => {
      const dict = DICTS[locale].changelogPage;
      const { container } = renderView(locale);
      const text = container.textContent ?? "";

      expect(container.querySelector("h1")?.textContent).toBe(dict.title);
      expect(text).toContain(dict.eyebrow);
      expect(text).toContain(dict.subtitle);
      expect(text).toContain(dict.englishNote);
      expect(text).not.toMatch(/\bchangelogPage\.[a-zA-Z]/);
    }
  );

  it("says in French and Indonesian that release notes are in English", () => {
    expect(renderView("fr").container.textContent).toContain(
      "Les notes de version sont rédigées en anglais."
    );
    expect(renderView("id").container.textContent).toContain(
      "Catatan rilis ditulis dalam bahasa Inggris."
    );
  });

  it.each(["en", "fr", "id"] as const)("localizes every tag label in %s", (locale) => {
    const dict = DICTS[locale].changelogPage;
    const text = renderView(locale).container.textContent ?? "";
    for (const label of [dict.tagFeat, dict.tagFix, dict.tagInfra, dict.tagUx]) {
      expect(text).toContain(label);
    }
  });

  it("uses distinct French and Indonesian tag words rather than the English ones", () => {
    const frText = renderView("fr").container.textContent ?? "";
    expect(frText).toContain("Fonctionnalité");
    expect(frText).toContain("Correctif");
    expect(frText).not.toContain("Feature");
    const idText = renderView("id").container.textContent ?? "";
    expect(idText).toContain("Fitur");
    expect(idText).toContain("Perbaikan");
    expect(idText).not.toContain("Feature");
  });

  it("falls back to the feature label for a tag it does not know", () => {
    const { container } = renderView("fr", [
      {
        version: "1.0.0",
        releasedAt: "2026-01-01T00:00:00.000Z",
        tag: "toString" as never,
        items: ["x"],
      },
    ]);
    expect(container.textContent).toContain(fr.changelogPage.tagFeat);
  });
});

describe("ChangelogView dates", () => {
  it("formats the release date per locale with Intl", () => {
    const dateOf = (locale: Locale) =>
      renderView(locale).container.querySelector("time")?.textContent;

    expect(dateOf("en")).toBe("August 9, 2026");
    expect(dateOf("fr")).toBe("9 août 2026");
    expect(dateOf("id")).toBe("9 Agustus 2026");
  });

  it("keeps the machine-readable date in the time element", () => {
    const time = renderView("fr").container.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe("2026-08-09");
  });

  it("shows the same calendar day west of Greenwich (dates are UTC, not local)", () => {
    // UTC-11: 2026-08-09T00:00Z is still Aug 8 on a local clock there.
    process.env.TZ = "Pacific/Pago_Pago";
    expect(renderView("en").container.querySelector("time")?.textContent).toBe("August 9, 2026");
    expect(renderView("fr").container.querySelector("time")?.textContent).toBe("9 août 2026");
  });

  it("falls back to the raw date instead of throwing on an unparseable one", () => {
    const { container } = renderView("en", [
      { version: "0.0.1", releasedAt: "not-a-date", tag: "fix", items: ["x"] },
    ]);
    expect(container.querySelector("time")?.textContent).toBe("not-a-date");
  });
});

describe("ChangelogView entries", () => {
  it("renders the entries as-is, marked as English, with inline markdown", () => {
    const { container } = renderView("fr");
    const list = container.querySelector("ul");
    expect(list?.getAttribute("lang")).toBe("en");
    expect(list?.textContent).toContain("Zoom on the till.");
    expect(container.querySelector("strong")?.textContent).toBe("Zoom on the till.");
  });

  it("shows a localized empty state and no release rows when there are none", () => {
    for (const locale of ["en", "fr", "id"] as const) {
      const { container, unmount } = renderView(locale, []);
      expect(container.textContent).toContain(DICTS[locale].changelogPage.empty);
      expect(container.querySelector("time")).toBeNull();
      unmount();
    }
  });

  it("does not show the empty state when there are releases", () => {
    expect(renderView("en").container.textContent).not.toContain(en.changelogPage.empty);
  });
});
