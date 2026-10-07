import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SUPPORT_MAILTO } from "@/lib/constants/contact";

const h = vi.hoisted(() => ({ push: vi.fn(), search: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  useSearchParams: () => h.search,
}));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { CheckoutFailedContent } from "../checkout-failed-content";

const realLocation = window.location;

beforeEach(() => {
  h.search = new URLSearchParams();
  h.push.mockClear();
  // jsdom refuses to navigate, so swap in a plain object that records the href.
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href: "https://epidom.test/checkout/failed" },
  });
});
afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
});

describe("CheckoutFailedContent support link", () => {
  it("'Contact support' opens the shared support mailto", () => {
    render(<CheckoutFailedContent />);

    fireEvent.click(screen.getByRole("button", { name: "common.contactSupport" }));

    expect(window.location.href).toBe(SUPPORT_MAILTO);
  });

  it("'Try again' goes back to /pricing, the real purchase page (not the retired /payments)", () => {
    render(<CheckoutFailedContent />);

    fireEvent.click(screen.getByRole("button", { name: "checkout.failed.tryAgainButton" }));

    expect(h.push).toHaveBeenCalledWith("/pricing");
  });
});

describe("CheckoutFailedContent after a Checkout opened from setup", () => {
  it("a cancelled Checkout says so, not that a payment failed", () => {
    h.search = new URLSearchParams("reason=canceled");
    render(<CheckoutFailedContent />);
    expect(
      screen.getByRole("heading", { name: "checkout.failed.canceledTitle" })
    ).toBeInTheDocument();
    expect(screen.getByText("checkout.failed.canceledSubtitle")).toBeInTheDocument();
  });

  it("'Try again' reopens the plan on /pricing, with its billing interval", () => {
    h.search = new URLSearchParams("reason=canceled&plan=POS&billing=monthly");
    render(<CheckoutFailedContent />);
    fireEvent.click(screen.getByRole("button", { name: "checkout.failed.tryAgainButton" }));
    expect(h.push).toHaveBeenCalledWith("/pricing?plan=POS&billing=monthly#plans");
  });

  it("goes on to the new store instead of the homepage", () => {
    h.search = new URLSearchParams(
      "reason=canceled&plan=POS&billing=monthly&next=%2Fstore%2Fs1%2Fdashboard%3Ftour%3D1"
    );
    render(<CheckoutFailedContent />);
    fireEvent.click(screen.getByRole("button", { name: /checkout\.failed\.continueToStore/ }));
    expect(h.push).toHaveBeenCalledWith("/store/s1/dashboard?tour=1");
  });

  it("never follows a `next` to another site", () => {
    h.search = new URLSearchParams("reason=canceled&next=https%3A%2F%2Fevil.test");
    render(<CheckoutFailedContent />);
    expect(screen.queryByRole("button", { name: /continueToStore/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /common\.goHome/ }));
    expect(h.push).toHaveBeenCalledWith("/");
  });
});
