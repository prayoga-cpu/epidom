import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "geist-sans" } }));
vi.mock("@/lib/fonts", () => ({ geistMono: { variable: "geist-mono" } }));
vi.mock("@/components/analytics/conditional-analytics", () => ({ ConditionalAnalytics: () => null }));
vi.mock("@/components/providers/session-provider", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/lang/i18n-provider", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useI18n: () => ({ locale: "en", t: (key: string) => key }),
}));

import AuthLayout from "../layout";

beforeEach(() => {
  window.localStorage.clear();
});

describe("the login / register layout", () => {
  it("asks for cookie consent, so a visitor landing here from an ad can allow the pixel", () => {
    render(
      <AuthLayout>
        <p>form</p>
      </AuthLayout>
    );
    expect(screen.getByText("form")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "cookie.title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cookie.accept" })).toBeInTheDocument();
  });

  it("doesn't ask again once the visitor answered (on the site or a sales page)", () => {
    window.localStorage.setItem(
      "cookie-consent-preferences",
      JSON.stringify({ essential: true, analytics: false, marketing: true, language: "fr", timestamp: 1, version: "1.0.0" })
    );
    render(
      <AuthLayout>
        <p>form</p>
      </AuthLayout>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
