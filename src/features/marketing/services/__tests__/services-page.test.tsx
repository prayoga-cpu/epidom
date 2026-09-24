import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";

// t() reads the real dictionaries and returns the key path when one is missing,
// so a key the page asks for but the locale lacks shows up in the text.
const mockLocale = vi.hoisted(() => ({ value: "en" as "en" | "fr" | "id" }));

vi.mock("@/components/lang/i18n-provider", async () => {
  const { en } = await import("@/locales/en");
  const { fr } = await import("@/locales/fr");
  const { id } = await import("@/locales/id");
  const dictionaries = { en, fr, id } as Record<string, unknown>;
  const lookup = (dict: unknown, key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined,
        dict
      );
  return {
    useI18n: () => ({
      locale: mockLocale.value,
      t: (key: string) => {
        const value = lookup(dictionaries[mockLocale.value], key);
        return typeof value === "string" ? value : key;
      },
    }),
  };
});

vi.mock("@/features/marketing/shared/components/phone-menu", () => ({
  PhoneMenu: () => <div data-testid="phone-menu" />,
}));
vi.mock("@/features/marketing/shared/components/phone-kds", () => ({
  PhoneKDS: () => <div data-testid="phone-kds" />,
}));

import { SpacesSection } from "../components/spaces-section";
import { FeaturesShowcaseSection } from "../components/features-showcase-section";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

const DICTS = { en, fr, id } as const;
const LOCALES = ["fr", "id", "en"] as const;

afterEach(cleanup);

describe("Services page sections", () => {
  it.each(LOCALES)("%s: every string the page asks for exists in this locale", (loc) => {
    mockLocale.value = loc;
    const { container } = render(
      <>
        <SpacesSection />
        <FeaturesShowcaseSection />
      </>
    );
    expect(container.textContent).not.toContain("redesign.");
  });

  it.each(LOCALES)("%s: shows all eight feature rows with their plans", (loc) => {
    mockLocale.value = loc;
    const { container } = render(<FeaturesShowcaseSection />);
    const shown = container.textContent ?? "";
    const copy = DICTS[loc].redesign.servicesPage as Record<string, string>;
    for (let n = 1; n <= 8; n++) {
      expect(shown).toContain(copy[`r${n}title`]);
      expect(shown).toContain(copy[`r${n}plan`]);
    }
  });

  it.each(LOCALES)("%s: shows the three spaces of Epidom 3", (loc) => {
    mockLocale.value = loc;
    const { container } = render(<SpacesSection />);
    const shown = container.textContent ?? "";
    const copy = DICTS[loc].redesign.servicesPage;
    for (const tag of [copy.s1tag, copy.s2tag, copy.s3tag]) expect(shown).toContain(tag);
  });
});
