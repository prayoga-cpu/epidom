import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

/**
 * The compliance claim on the home page is only made once it is true: the
 * attestation can be issued (publisher details filled in) and only on the
 * French site, and it never says "certified".
 */

const mockLocale = vi.hoisted(() => ({ value: "fr" as "en" | "fr" | "id" }));
const readiness = vi.hoisted(() => ({ ready: true }));

vi.mock("@/lib/fiscal/attestation", () => ({
  isFiscalAttestationReady: () => readiness.ready,
}));

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

beforeEach(() => {
  vi.resetModules();
  mockLocale.value = "fr";
  readiness.ready = true;
});

async function renderSection() {
  const { ComplianceSection } = await import("../compliance-section");
  return render(<ComplianceSection />);
}

describe("ComplianceSection", () => {
  it("shows Epidom's own seal and the four conditions on the French site", async () => {
    await renderSection();
    expect(screen.getByTestId("compliance-seal")).toBeTruthy();
    for (const title of ["Inaltérabilité", "Sécurisation", "Conservation", "Archivage"]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    // Attested, not certified, and it says so.
    expect(screen.getByText(/n'est pas certifié NF525/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/certifié NF525 par Epidom|Epidom est certifié/);
  });

  it("renders nothing until the attestation can be issued", async () => {
    readiness.ready = false;
    const { container } = await renderSection();
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing on the other sites", async () => {
    mockLocale.value = "id";
    const { container } = await renderSection();
    expect(container.innerHTML).toBe("");
  });
});
