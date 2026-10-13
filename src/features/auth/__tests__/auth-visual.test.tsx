import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import { PRODUCT_SCREENS } from "@/features/marketing/shared/content/product-screens";

// t() reads the real dictionaries and returns the key path when one is missing,
// so a key the panel asks for but the locale lacks shows up in the text.
const mockLocale = vi.hoisted(() => ({ value: "en" as "en" | "fr" | "id" }));

vi.mock("@/components/lang/i18n-provider", () => {
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

import { AuthVisual } from "../components/auth-visual";

afterEach(cleanup);

describe("AuthVisual: the sign-in / sign-up carousel", () => {
  it.each(["fr", "en", "id"] as const)("%s: every slide's copy exists in this locale", (loc) => {
    mockLocale.value = loc;
    const { container } = render(<AuthVisual />);
    expect(container.textContent).not.toContain("auth.visual.");
    expect(container.textContent).toContain(
      { en, fr, id }[loc].auth.visual.cashierTitle.split("\n")[0]
    );
  });

  it("shows the real POS and Back Office screens, described in the visitor's language", () => {
    mockLocale.value = "fr";
    render(<AuthVisual />);
    for (const shot of [
      PRODUCT_SCREENS.posCashier,
      PRODUCT_SCREENS.posOrderQueue,
      PRODUCT_SCREENS.posCustomerDisplay,
      PRODUCT_SCREENS.backOfficeStock,
    ]) {
      expect(screen.getByRole("img", { name: shot.alt.fr })).toBeInTheDocument();
    }
  });
});
