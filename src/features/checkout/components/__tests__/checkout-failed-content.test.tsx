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
