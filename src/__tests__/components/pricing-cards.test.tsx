import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "redesign.pricingPage.t1name": "Free",
        "redesign.pricingPage.t2name": "POS",
        "redesign.pricingPage.t3name": "Operations",
        "redesign.pricingPage.t4name": "Enterprise",
        "redesign.pricingPage.t1cta": "Get Started",
        "redesign.pricingPage.t2cta": "Get POS",
        "redesign.pricingPage.t3cta": "Get Operations",
        "redesign.pricingPage.t4cta": "Contact Sales",
        "redesign.pricingPage.t1price_mo": "Rp 0",
        "redesign.pricingPage.t2price_mo": "Rp 149.000",
        "redesign.pricingPage.t3price_mo": "Rp 249.000",
        "redesign.pricingPage.t4price_mo": "Custom",
        "redesign.pricingPage.t1price_yr": "Rp 0",
        "redesign.pricingPage.t2price_yr": "Rp 1.490.000",
        "redesign.pricingPage.t3price_yr": "Rp 2.490.000",
        "redesign.pricingPage.t4price_yr": "Custom",
        "redesign.pricingPage.t1tag": "Starter",
        "redesign.pricingPage.t2tag": "POS",
        "redesign.pricingPage.t3tag": "Operations",
        "redesign.pricingPage.t4tag": "Enterprise",
        "redesign.pricingPage.t1tagline": "For starters",
        "redesign.pricingPage.t2tagline": "For cafes",
        "redesign.pricingPage.t3tagline": "Full suite",
        "redesign.pricingPage.t4tagline": "Custom",
        "redesign.pricingPage.mostPopular": "Most Popular",
        "redesign.pricingPage.freeForever": "Free forever",
        "redesign.pricingPage.talkSales": "Talk to sales",
        "redesign.pricingPage.billedMonthly": "Billed monthly",
        "redesign.pricingPage.billedYearly": "Billed yearly",
        "redesign.pricingPage.trialBar": "Try free",
        "redesign.pricingPage.trialBarSub": "No credit card",
        "redesign.pricingPage.trialBarCta": "Start free",
        "redesign.pricingPage.trialBadge": "14-day free trial",
        "redesign.pricingPage.promoTrialNote": "14 days free, then billed monthly",
        "redesign.pricingPage.startTrialCta": "Start free trial",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;
const mockLocationAssign = vi.fn();
Object.defineProperty(window, "location", {
  value: { href: "" },
  writable: true,
});
const mockWindowOpen = vi.fn();
global.window.open = mockWindowOpen;

import { PricingCards } from "@/features/marketing/pricing/components/pricing-cards";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PricingCards", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockWindowOpen.mockClear();
    window.location.href = "";
  });

  it("renders all four plan names", () => {
    render(<PricingCards yearly={false} />);
    expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
    expect(screen.getAllByText("POS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Operations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enterprise").length).toBeGreaterThan(0);
  });

  it("clicking Free CTA opens confirmation dialog", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Started"));
    expect(screen.getByText("Switch to Free")).toBeTruthy();
  });

  it("clicking POS CTA opens dialog with POS plan name", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    expect(screen.getByText("Start POS free trial")).toBeTruthy();
  });

  it("clicking Operations CTA opens dialog with Operations plan name", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Operations"));
    expect(screen.getByText("Switch to Operations")).toBeTruthy();
  });

  it("clicking Enterprise CTA opens Calendly, no dialog", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Contact Sales"));
    expect(mockWindowOpen).toHaveBeenCalledWith(expect.stringContaining("calendly.com"), "_blank");
    expect(screen.queryByText(/Switch to/)).toBeNull();
  });

  it("Cancel button closes dialog without calling API", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    expect(screen.getByText("Start POS free trial")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Start POS free trial")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/subscriptions/"),
      expect.any(Object)
    );
  });

  it("Confirm calls activate-free API with correct plan (FREE)", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Started"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/subscriptions/activate-free",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ plan: "FREE", trial: undefined, yearly: false }),
        })
      );
    });
  });

  it("Confirm calls checkout API with correct plan (POS)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: { url: "https://checkout.stripe.com/test" } }),
    });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/subscriptions/checkout",
        expect.objectContaining({
          body: JSON.stringify({ plan: "POS", trial: true, yearly: false }),
        })
      );
    });
  });

  it("on success redirects to Stripe Checkout URL for paid plans", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: { url: "https://checkout.stripe.com/test" } }),
    });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(window.location.href).toBe("https://checkout.stripe.com/test");
    });
  });

  it("on success redirects to /stores for FREE plan", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Started"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(window.location.href).toBe("/stores");
    });
  });

  it("on 401 redirects to /register", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(window.location.href).toBe("/register");
    });
  });

  it("dialog closes after successful activation", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: { url: "https://checkout.stripe.com/test" } }),
    });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(screen.queryByText("Start POS free trial")).toBeNull();
    });
  });
});
