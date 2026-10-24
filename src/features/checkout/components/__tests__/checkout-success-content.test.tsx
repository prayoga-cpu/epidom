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
import { trackConversion, trackMetaPixelEvent } from "@/lib/analytics";

const meta = trackMetaPixelEvent as unknown as ReturnType<typeof vi.fn>;
const ga = trackConversion as unknown as ReturnType<typeof vi.fn>;

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
  meta.mockClear();
  ga.mockClear();
  window.sessionStorage.clear();
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

  it("congratulates the user on choosing Epidom, paid or trial", () => {
    const paid = renderPage("plan=OPERATIONS&trial=false");
    expect(
      screen.getByRole("heading", { name: "checkout.success.congratsTitle" })
    ).toBeInTheDocument();
    expect(screen.getByText("checkout.success.congratsBody")).toBeInTheDocument();
    paid.unmount();

    renderPage("plan=POS&trial=true");
    expect(
      screen.getByRole("heading", { name: "checkout.success.congratsTitle" })
    ).toBeInTheDocument();
  });

  it("goes on to the new store when setup opened Checkout", () => {
    renderPage("plan=POS&trial=true&next=%2Fstore%2Fs1%2Fdashboard%3Ftour%3D1");
    fireEvent.click(screen.getByRole("button", { name: "checkout.success.continueToStore" }));
    expect(h.push).toHaveBeenCalledWith("/store/s1/dashboard?tour=1");
  });

  it("a trial reaches Meta as StartTrial with the first charge after it, keyed by the session", () => {
    renderPage("plan=POS&trial=true&billing=monthly&currency=EUR&session_id=cs_test_1");
    expect(meta).toHaveBeenCalledTimes(1);
    expect(meta).toHaveBeenCalledWith(
      "StartTrial",
      { content_name: "POS", value: 13.99, currency: "EUR" },
      { eventId: "cs_test_1" }
    );
  });

  it("a trial's value is on GA's trial_started only, not counted twice", () => {
    renderPage("plan=POS&trial=true&billing=monthly&currency=EUR&session_id=cs_test_ga");
    expect(ga).toHaveBeenCalledWith("subscription_started", { event_label: "POS", plan: "POS" });
    expect(ga).toHaveBeenCalledWith("trial_started", {
      event_label: "POS",
      plan: "POS",
      value: 13.99,
      currency: "EUR",
    });
  });

  it("a yearly plan's value is the whole year", () => {
    renderPage("plan=OPERATIONS&trial=false&billing=yearly&currency=IDR&session_id=cs_test_2");
    expect(meta).toHaveBeenCalledWith(
      "Subscribe",
      { content_name: "OPERATIONS", value: 379_000 * 12, currency: "IDR" },
      { eventId: "cs_test_2" }
    );
  });

  it("a reload of the same checkout doesn't count it twice", () => {
    const query = "plan=POS&trial=true&billing=monthly&currency=USD&session_id=cs_test_3";
    renderPage(query).unmount();
    renderPage(query);
    expect(meta).toHaveBeenCalledTimes(1);
  });

  it("an older link without currency still counts, without a value", () => {
    renderPage("plan=POS&trial=false");
    expect(meta).toHaveBeenCalledWith("Subscribe", { content_name: "POS" }, undefined);
  });

  it("otherwise, and for a `next` to another site, goes to the profile", () => {
    renderPage("plan=POS&trial=true&next=%2F%2Fevil.test");
    fireEvent.click(screen.getByRole("button", { name: "checkout.success.continueToProfile" }));
    expect(h.push).toHaveBeenCalledWith("/profile");
  });
});
