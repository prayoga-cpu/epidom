import { describe, expect, it, vi } from "vitest";

// The layout module pulls in web fonts and the whole site chrome; none of it
// matters for the static metadata export under test.
vi.mock("next/font/google", () => ({
  Jost: () => ({ variable: "jost" }),
  IM_Fell_French_Canon: () => ({ variable: "imfell" }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/features/marketing/shared/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/features/marketing/shared/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/features/marketing/shared/components/cookie-consent-bar", () => ({
  CookieConsentBar: () => null,
}));
vi.mock("@/components/lang/i18n-provider-eager", () => ({
  EagerI18nProvider: ({ children }: { children: unknown }) => children,
}));

import { metadata } from "@/app/(marketing)/layout";

describe("marketing layout fallback metadata", () => {
  const description = String(metadata.description);

  it("is a valid metadata export with a title and a description", () => {
    expect(metadata.title).toBe("Epidom");
    expect(description.trim()).not.toBe("");
  });

  it("does not read as if the whole product were free: only the storefront is", () => {
    expect(description).not.toMatch(/free forever\.?$/i);
    expect(description).toMatch(/storefront free forever/i);
    expect(description).toMatch(/14-day/);
  });
});
