import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

const pref = vi.hoisted(() => ({ value: "en" as "en" | "fr" | "id" }));
vi.mock("@/lib/cookie-consent", () => ({
  getLanguagePreference: () => pref.value,
  setLanguagePreference: vi.fn(),
}));

import { fr } from "@/locales/fr";
import { id } from "@/locales/id";
import { seedLocale } from "@/locales";
import { I18nProvider, useI18n } from "../i18n-provider";

seedLocale("fr", fr);
seedLocale("id", id);

function Probe() {
  const { locale, t } = useI18n();
  return <p data-testid="probe">{`${locale}|${t("publicProfile.poweredBy")}`}</p>;
}

beforeEach(() => {
  pref.value = "en";
});

describe("I18nProvider defaultLocale (the public storefront's store language)", () => {
  it("renders the store's language on the server, whatever the visitor prefers", () => {
    pref.value = "id";
    // renderToString runs no effects, exactly like the server render, so this
    // is the HTML a crawler gets and the client's first render must match.
    const html = renderToString(
      <I18nProvider defaultLocale="fr">
        <Probe />
      </I18nProvider>
    );
    expect(html).toContain("fr|Propulsé par");
  });

  it("then lets the visitor's own preference take over", async () => {
    pref.value = "id";
    render(
      <I18nProvider defaultLocale="fr">
        <Probe />
      </I18nProvider>
    );
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("id|Didukung oleh"));
  });

  it("stays on the store's language when the visitor prefers it too", async () => {
    pref.value = "fr";
    render(
      <I18nProvider defaultLocale="fr">
        <Probe />
      </I18nProvider>
    );
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("fr|Propulsé par"));
  });

  it("initialLocale still pins the language, whatever the visitor prefers", async () => {
    pref.value = "id";
    render(
      <I18nProvider initialLocale="fr">
        <Probe />
      </I18nProvider>
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("probe").textContent).toBe("fr|Propulsé par");
  });
});
