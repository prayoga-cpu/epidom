import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";

vi.mock("@/lib/auth-client", () => ({ useUser: () => ({ user: null }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/features/marketing/home/components/margin-calculator-section", () => ({
  MarginCalculatorSection: () => <section data-testid="commission-calculator" />,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

import { LandingPageView } from "../components/landing-page-view";
import { getLandingPage } from "../content";
import { POS_TRIAL_REGISTER_HREF } from "@/features/onboarding/lib/plan-intent";

const renderPage = (slug: string) => {
  const page = getLandingPage(slug)!;
  const utils = render(
    <EagerI18nProvider initialLocale={page.locale}>
      <LandingPageView
        page={page}
        related={[{ href: "/id/aplikasi-kasir-cafe", label: "Aplikasi kasir cafe" }]}
      />
    </EagerI18nProvider>
  );
  return { page, ...utils };
};

describe("LandingPageView", () => {
  it("renders one h1, the FAQ as visible text and as FAQPage JSON-LD from the same strings", () => {
    const { page, container } = renderPage("aplikasi-kasir-offline");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(page.h1);
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent ?? "{}"))
      .find((d) => d["@type"] === "FAQPage");
    expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(page.faqs.map((f) => f.q));
    for (const faq of page.faqs) expect(screen.getByText(faq.q)).toBeInTheDocument();
  });

  it("sends the trial call to action to the POS trial sign-up", () => {
    renderPage("aplikasi-kasir-offline");
    const links = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.includes("register"));
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0].getAttribute("href")).toBe(POS_TRIAL_REGISTER_HREF);
  });

  it("sends a pricing call to action to the page's own language's pricing page", () => {
    const { page } = renderPage("aplikasi-stok-bahan-baku");
    expect(page.cta.target).toBe("pricing");
    expect(screen.getAllByRole("link", { name: page.cta.button })[0]).toHaveAttribute(
      "href",
      "/id/pricing"
    );
  });

  it("renders the recipe calculator where the page puts it, and it computes", () => {
    renderPage("kalkulator-hpp");
    // The Indonesian example opens on one iced kopi susu.
    const add = screen.getByRole("button", { name: /Tambah bahan/ });
    fireEvent.click(add);
    expect(screen.getAllByRole("button", { name: /Hapus bahan/ })).toHaveLength(4);
    expect(screen.getByText("HPP per porsi")).toBeInTheDocument();
  });

  it("renders the commission calculator section on the commission pages", () => {
    renderPage("kalkulator-komisi-gofood");
    expect(screen.getByTestId("commission-calculator")).toBeInTheDocument();
  });

  it("links related pages in the same language", () => {
    renderPage("aplikasi-kasir-offline");
    const nav = screen.getByRole("navigation", { name: "Baca juga" });
    expect(within(nav).getByRole("link", { name: "Aplikasi kasir cafe" })).toHaveAttribute(
      "href",
      "/id/aplikasi-kasir-cafe"
    );
  });
});
