import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// Real dictionaries (not a hand-written key map) so a string missing from a
// locale fails here instead of silently falling back to English.
const state = vi.hoisted(() => ({ locale: "en" as "en" | "fr" | "id" }));
const analytics = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  trackConversion: vi.fn(),
  trackMetaPixelEvent: vi.fn(),
}));

vi.mock("@/components/lang/i18n-provider", async () => {
  const dicts = {
    en: (await import("@/locales/en")).en,
    fr: (await import("@/locales/fr")).fr,
    id: (await import("@/locales/id")).id,
  } as Record<string, unknown>;
  const lookup = (dict: unknown, key: string): string | undefined => {
    const v = key
      .split(".")
      .reduce<unknown>(
        (n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined),
        dict
      );
    return typeof v === "string" ? v : undefined;
  };
  const intl = { en: "en-US", fr: "fr-FR", id: "id-ID" } as const;
  return {
    useI18n: () => ({
      locale: state.locale,
      intlLocale: intl[state.locale],
      t: (key: string) => lookup(dicts[state.locale], key) ?? lookup(dicts.en, key) ?? key,
    }),
  };
});

vi.mock("next/navigation", () => ({ usePathname: () => "/store/s1/billing" }));
vi.mock("@/lib/analytics", () => analytics);

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Checkout hands off with `window.location.href = url` and BETA reloads, which
// jsdom does not implement: swap in a plain object.
const realLocation = window.location;
const reload = vi.fn();
beforeEach(() => {
  state.locale = "en";
  mockFetch.mockReset();
  reload.mockReset();
  Object.values(analytics).forEach((fn) => fn.mockClear());
  Object.defineProperty(window, "location", {
    value: { href: "", origin: "https://app.test", pathname: "/store/s1/billing", reload },
    writable: true,
    configurable: true,
  });
});
afterEach(() => {
  Object.defineProperty(window, "location", {
    value: realLocation,
    writable: true,
    configurable: true,
  });
});

import { PlanCards } from "../components/plan-cards";
import { resolvePriceCurrency, yearlySavingsPercent } from "../lib/plan-price";

// Intl puts narrow/non-breaking spaces in "13,99 €" and "Rp 229.000".
const text = (el: HTMLElement) => (el.textContent ?? "").replace(/[  ]/g, " ");
const card = (container: HTMLElement, plan: string) =>
  container.querySelector<HTMLElement>(`[data-plan="${plan}"]`)!;
const okJson = (body: unknown) => ({ ok: true, status: 201, json: async () => body });

describe("plan-price helpers", () => {
  it("quotes in the store's currency when Stripe has a price in it", () => {
    expect(resolvePriceCurrency("IDR", "fr")).toBe("IDR");
    expect(resolvePriceCurrency("EUR", "en")).toBe("EUR");
  });

  it("falls back to the UI language's currency otherwise", () => {
    expect(resolvePriceCurrency("SGD", "fr")).toBe("EUR");
    expect(resolvePriceCurrency(null, "en")).toBe("USD");
    expect(resolvePriceCurrency(undefined, "id")).toBe("IDR");
  });

  it("never overstates the yearly saving for any plan", () => {
    // EUR: POS saves 17.9%, Operations only 16.1% — the smaller one wins.
    expect(yearlySavingsPercent("EUR")).toBe(16);
    expect(yearlySavingsPercent("USD")).toBe(16);
    expect(yearlySavingsPercent("IDR")).toBe(17);
  });
});

describe("PlanCards prices", () => {
  it("shows the exact Stripe amount, monthly then yearly", () => {
    state.locale = "fr";
    const { container } = render(<PlanCards currentPlan="FREE" mode="checkout" currency="EUR" />);
    const pos = card(container, "POS");
    expect(text(pos)).toContain("13,99 €");
    expect(text(pos)).toContain("EUR / mois");
    expect(text(pos)).toContain("facturé chaque mois");

    fireEvent.click(screen.getByRole("radio", { name: /Annuel/ }));
    expect(text(pos)).toContain("11,49 €");
    expect(text(pos)).toContain("137,88 € facturés chaque année");
    expect(text(card(container, "OPERATIONS"))).toContain("23,49 €");
  });

  it("labels the yearly toggle with the real saving", () => {
    render(<PlanCards currentPlan="FREE" mode="checkout" currency="IDR" />);
    expect(screen.getByRole("radio", { name: /Yearly · Save 17%/ })).toBeTruthy();
  });

  it("quotes Enterprise as custom", () => {
    const { container } = render(<PlanCards currentPlan="FREE" mode="checkout" currency="USD" />);
    expect(text(card(container, "ENTERPRISE"))).toContain(en.redesign.pricingPage.t4price_mo);
  });

  it("lists each plan's features under its 'Everything in' line", () => {
    const { container } = render(<PlanCards currentPlan="FREE" mode="checkout" currency="USD" />);
    const ops = within(card(container, "OPERATIONS"));
    expect(ops.getByText(en.redesign.pricingPage.t3f1).tagName).toBe("P");
    // t3f2..t3f10 — financial reports and the all-outlets roll-up are
    // Operations features now, not Enterprise ones.
    expect(ops.getAllByRole("listitem")).toHaveLength(9);
    expect(ops.getByText(en.redesign.pricingPage.t3f8)).toBeTruthy();
    expect(ops.getByText(en.redesign.pricingPage.t3f9)).toBeTruthy();
    expect(ops.getByText(en.redesign.pricingPage.t3f10)).toBeTruthy();
  });
});

describe("PlanCards actions", () => {
  it("marks the current plan and labels the others up or down from it", () => {
    const { container } = render(
      <PlanCards currentPlan="OPERATIONS" mode="portal" currency="USD" />
    );
    const current = within(card(container, "OPERATIONS")).getByRole("button", {
      name: "Current plan",
    }) as HTMLButtonElement;
    expect(current.disabled).toBe(true);
    expect(within(card(container, "POS")).getByRole("button", { name: "Downgrade to POS" }));
    expect(within(card(container, "ENTERPRISE")).getByRole("button", { name: "Talk to us" }));
  });

  it("offers the POS trial to a FREE account and sends it to Stripe Checkout", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true, data: { url: "https://stripe.test/c" } }));
    const { container } = render(<PlanCards currentPlan="FREE" mode="checkout" currency="USD" />);
    fireEvent.click(
      within(card(container, "POS")).getByRole("button", { name: "Start free trial" })
    );

    const dialog = within(screen.getByRole("alertdialog"));
    expect(dialog.getByText("Start your POS free trial")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Continue to Stripe" }));

    await waitFor(() => expect(window.location.href).toBe("https://stripe.test/c"));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/subscriptions/checkout");
    expect(JSON.parse(init.body)).toEqual({
      plan: "POS",
      yearly: false,
      trial: true,
      currency: "USD",
      cancelUrl: "https://app.test/store/s1/billing",
    });
    expect(analytics.trackConversion).toHaveBeenCalledWith(
      "begin_checkout",
      expect.objectContaining({ plan: "POS", trial: true })
    );
  });

  it("sends the chosen billing period and warns a lifetime plan it will be replaced", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true, data: { url: "https://stripe.test/c" } }));
    const { container } = render(
      <PlanCards currentPlan="ENTERPRISE" mode="checkout" currency="USD" />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Yearly/ }));
    fireEvent.click(
      within(card(container, "OPERATIONS")).getByRole("button", {
        name: "Downgrade to Operations",
      })
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("billed yearly");
    expect(dialog.textContent).toContain("It replaces your current Enterprise plan.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to Stripe" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      plan: "OPERATIONS",
      yearly: true,
    });
  });

  it("does not count a portal hand-off as a checkout", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true, data: { url: "https://stripe.test/p" } }));
    const { container } = render(<PlanCards currentPlan="POS" mode="portal" currency="USD" />);
    fireEvent.click(
      within(card(container, "OPERATIONS")).getByRole("button", { name: "Upgrade to Operations" })
    );
    expect(screen.getByRole("alertdialog").textContent).toContain("billing portal");
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe" }));

    await waitFor(() => expect(window.location.href).toBe("https://stripe.test/p"));
    expect(analytics.trackConversion).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with the server's error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: { message: "No price configured" } }),
    });
    const { container } = render(<PlanCards currentPlan="FREE" mode="checkout" currency="USD" />);
    fireEvent.click(
      within(card(container, "OPERATIONS")).getByRole("button", { name: "Upgrade to Operations" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe" }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "No price configured");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(window.location.href).toBe("");
  });

  it("switches a BETA account instantly, Enterprise included", async () => {
    mockFetch.mockResolvedValue(okJson({ success: true, data: { plan: "ENTERPRISE" } }));
    const { container } = render(<PlanCards currentPlan="POS" mode="beta" currency="USD" />);
    fireEvent.click(
      within(card(container, "ENTERPRISE")).getByRole("button", { name: "Upgrade to Enterprise" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch now" }));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/subscriptions/beta-plan");
    expect(JSON.parse(init.body)).toEqual({ plan: "ENTERPRISE" });
  });

  it("opens WhatsApp for Enterprise when there is one number to offer", () => {
    state.locale = "fr";
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(<PlanCards currentPlan="POS" mode="portal" currency="EUR" />);
    fireEvent.click(
      within(card(container, "ENTERPRISE")).getByRole("button", { name: "Nous contacter" })
    );
    expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/33781732386\?text=/);
    expect(mockFetch).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("billing.planCards locale coverage", () => {
  const keys = (l: unknown) =>
    Object.keys((l as { billing: { planCards: Record<string, string> } }).billing.planCards).sort();

  it("has every string in fr and id", () => {
    expect(keys(fr)).toEqual(keys(en));
    expect(keys(id)).toEqual(keys(en));
  });
});
