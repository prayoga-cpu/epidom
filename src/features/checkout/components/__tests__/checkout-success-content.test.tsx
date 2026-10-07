import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ push: vi.fn(), search: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  useSearchParams: () => h.search,
}));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ refetch: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({
  trackConversion: vi.fn(),
  trackMetaPixelEvent: vi.fn(),
}));

import { CheckoutSuccessContent } from "../checkout-success-content";

function renderPage(query: string) {
  h.search = new URLSearchParams(query);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckoutSuccessContent />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  h.push.mockClear();
});

describe("CheckoutSuccessContent", () => {
  it("a trial says nothing was charged, and mentions no receipt", () => {
    renderPage("plan=POS&trial=true");
    expect(
      screen.getByRole("heading", { name: "checkout.success.trialTitle" })
    ).toBeInTheDocument();
    expect(screen.getByText("checkout.success.trialSubtitle")).toBeInTheDocument();
    expect(screen.getByText("checkout.success.trialStatus")).toBeInTheDocument();
    expect(screen.queryByText("checkout.success.title")).toBeNull();
    expect(screen.queryByText("checkout.success.confirmationEmail")).toBeNull();
  });

  it("a paid plan keeps the payment wording", () => {
    renderPage("plan=OPERATIONS&trial=false");
    expect(screen.getByRole("heading", { name: "checkout.success.title" })).toBeInTheDocument();
    expect(screen.getByText("checkout.success.confirmationEmail")).toBeInTheDocument();
  });

  it("goes on to the new store when setup opened Checkout", () => {
    renderPage("plan=POS&trial=true&next=%2Fstore%2Fs1%2Fdashboard%3Ftour%3D1");
    fireEvent.click(screen.getByRole("button", { name: "checkout.success.continueToStore" }));
    expect(h.push).toHaveBeenCalledWith("/store/s1/dashboard?tour=1");
  });

  it("otherwise, and for a `next` to another site, goes to the profile", () => {
    renderPage("plan=POS&trial=true&next=%2F%2Fevil.test");
    fireEvent.click(screen.getByRole("button", { name: "checkout.success.continueToProfile" }));
    expect(h.push).toHaveBeenCalledWith("/profile");
  });
});
