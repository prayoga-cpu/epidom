import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { safeInternalPath } from "@/lib/safe-redirect";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mutable per-test: who is looking at the page, in which language.
const state = vi.hoisted(() => ({
  locale: "fr" as "fr" | "en" | "id",
  user: { id: "u1" } as { id: string } | null,
  loading: false,
}));
const push = vi.hoisted(() => vi.fn());
const analytics = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  trackConversion: vi.fn(),
  trackMetaPixelEvent: vi.fn(),
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    locale: state.locale,
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
        "redesign.pricingPage.currentPlanCta": "Current Plan",
        "redesign.pricingPage.switchPlanCta": "Switch Plan",
        "redesign.pricingPage.upgradeCta": "Upgrade Plan",
        // Confirm dialog: was hardcoded English in the component, now locale keys.
        // The values are the shipped en wording, so the assertions below are unchanged.
        "redesign.pricingPage.dlgEyebrow": "Confirm Plan Change",
        "redesign.pricingPage.dlgTrialTitle": "Start {name} free trial",
        "redesign.pricingPage.dlgSwitchTitle": "Switch to {name}",
        "redesign.pricingPage.dlgTrialBody":
          "You'll add a card but **won't be charged for 14 days**. After the trial your **{name}** plan renews automatically.",
        "redesign.pricingPage.dlgSwitchBody":
          "Your subscription will be updated to the **{name}** plan immediately.",
        "redesign.pricingPage.dlgCancel": "Cancel",
        "redesign.pricingPage.dlgConfirm": "Confirm",
        "redesign.pricingPage.dlgActivating": "Activating…",
      };
      return map[key] ?? key;
    },
  }),
}));

// The real hook fetches /api/session; a test decides instead who is signed in.
vi.mock("@/lib/auth-client", () => ({
  useUser: () => ({ user: state.user, loading: state.loading, session: null }),
}));

// The global next/navigation mock builds a fresh router per call, so its push
// can't be asserted on.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/analytics", () => analytics);

const mockFetch = vi.fn();
global.fetch = mockFetch;
Object.defineProperty(window, "location", {
  value: { href: "", search: "", pathname: "/pricing" },
  writable: true,
});
const mockWindowOpen = vi.fn();
global.window.open = mockWindowOpen;
// Like the browser's: replacing the URL with the bare pathname drops the query,
// which is what stops the deep-link effect from opening the dialog again.
const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {
  window.location.search = "";
});

import { PricingCards } from "@/features/marketing/pricing/components/pricing-cards";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cardOf(container: HTMLElement, plan: string) {
  return container.querySelector<HTMLElement>(`[data-plan="${plan}"]`)!;
}
function ctaOf(container: HTMLElement, plan: string) {
  return within(cardOf(container, plan)).getAllByRole("button")[0];
}

const CHECKOUT_OK = {
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true, data: { url: "https://checkout.stripe.com/test" } }),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PricingCards", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockWindowOpen.mockClear();
    push.mockClear();
    replaceState.mockClear();
    window.location.href = "";
    window.location.search = "";
    state.locale = "fr";
    state.user = { id: "u1" };
    state.loading = false;
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

  it("clicking Enterprise CTA opens WhatsApp, no dialog", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Contact Sales"));
    expect(mockWindowOpen).toHaveBeenCalledWith(expect.stringContaining("wa.me"), "_blank");
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
    mockFetch.mockResolvedValue(CHECKOUT_OK);
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
    mockFetch.mockResolvedValue(CHECKOUT_OK);
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

  // Behaviour change: a 401 used to drop the visitor on a bare /register, losing
  // which plan they had picked. It now carries the same `next` as a signed-out click.
  it("on 401 redirects to /register carrying the trial intent", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(window.location.href).toBe("/register?next=%2Fpricing%3Ftrial%3Dtrue");
    });
  });

  it("on 401 for the Free plan redirects to a plain /register", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Started"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(window.location.href).toBe("/register");
    });
  });

  it("dialog closes after successful activation", async () => {
    mockFetch.mockResolvedValue(CHECKOUT_OK);
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    fireEvent.click(screen.getByText("Confirm"));
    await waitFor(() => {
      expect(screen.queryByText("Start POS free trial")).toBeNull();
    });
  });
});

describe("PricingCards signed out", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockWindowOpen.mockClear();
    push.mockClear();
    replaceState.mockClear();
    window.location.href = "";
    window.location.search = "";
    state.locale = "fr";
    state.user = null;
    state.loading = false;
  });

  it("the trial bar sends a signed-out visitor to sign-up with the trial intent in `next`", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free"));

    expect(window.location.href).toBe(
      "/register?next=" + encodeURIComponent("/pricing?trial=true")
    );
    // The "?" inside the target must not split the value, and the sign-up form must
    // accept it: it reads `next` through safeInternalPath, not `callbackURL`.
    const url = new URL(window.location.href, "http://localhost");
    expect(url.pathname).toBe("/register");
    expect(url.searchParams.get("callbackURL")).toBeNull();
    expect(url.searchParams.get("next")).toBe("/pricing?trial=true");
    expect(safeInternalPath(url.searchParams.get("next"))).toBe("/pricing?trial=true");
    expect(analytics.trackEvent).toHaveBeenCalledWith("cta_click", {
      event_category: "engagement",
      event_label: "pricing_trial_bar",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the trial bar keeps the visitor's language in the return path", () => {
    state.locale = "en";
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free"));
    expect(window.location.href).toBe(
      "/register?next=" + encodeURIComponent("/en/pricing?trial=true")
    );
  });

  it("the POS card skips the dialog and goes to sign-up wanting the trial back", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free trial"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.href).toBe("/register?next=%2Fpricing%3Ftrial%3Dtrue");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("the Operations card returns to /pricing after sign-up, with no trial", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Operations"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.href).toBe("/register?next=%2Fpricing");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("the Free card goes to a plain /register", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Started"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.href).toBe("/register");
  });

  it("id visitors come back to /id/pricing", () => {
    state.locale = "id";
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Operations"));
    expect(window.location.href).toBe("/register?next=%2Fid%2Fpricing");
  });

  it("Enterprise still opens WhatsApp rather than sign-up", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Contact Sales"));
    expect(mockWindowOpen).toHaveBeenCalledWith(expect.stringContaining("wa.me"), "_blank");
    expect(window.location.href).toBe("");
  });

  it("while auth is still loading a click is not treated as signed out", () => {
    state.loading = true;
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Get Operations"));
    expect(window.location.href).toBe("");
    expect(screen.getByText("Switch to Operations")).toBeTruthy();
  });

  it("while auth is still loading the trial bar does not send a signed-in visitor to sign-up", () => {
    state.loading = true;
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free"));
    expect(window.location.href).toBe("");
    expect(screen.getByText("Start POS free trial")).toBeTruthy();
  });
});

describe("PricingCards trial bar when signed in", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    window.location.href = "";
    window.location.search = "";
    state.locale = "fr";
    state.user = { id: "u1" };
    state.loading = false;
  });

  it("opens the trial dialog instead of leaving the page", () => {
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Start free"));
    expect(screen.getByText("Start POS free trial")).toBeTruthy();
    expect(window.location.href).toBe("");
  });
});

describe("PricingCards ?trial=true deep link", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    replaceState.mockClear();
    window.location.href = "";
    window.location.search = "?trial=true";
    state.locale = "fr";
    state.user = { id: "u1" };
    state.loading = false;
  });

  it("opens the POS trial dialog for a signed-in visitor and cleans the query", () => {
    render(<PricingCards yearly={false} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Start POS free trial")).toBeTruthy();
    expect(replaceState).toHaveBeenCalledWith({}, "", "/pricing");
  });

  it("does nothing until the visitor is signed in", () => {
    state.user = null;
    render(<PricingCards yearly={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("does nothing while auth is loading", () => {
    state.loading = true;
    render(<PricingCards yearly={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("opens once the session resolves (the post-sign-up landing)", () => {
    state.user = null;
    state.loading = true;
    const { rerender } = render(<PricingCards yearly={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    state.user = { id: "u1" };
    state.loading = false;
    rerender(<PricingCards yearly={false} />);
    expect(screen.getByText("Start POS free trial")).toBeTruthy();
  });

  it("uses the plain switch wording for a subscriber on Operations", () => {
    render(<PricingCards yearly={false} currentPlan="OPERATIONS" />);
    expect(screen.getByText("Switch to POS")).toBeTruthy();
    expect(screen.queryByText("Start POS free trial")).toBeNull();
  });

  it("opens nothing for someone already on POS, but still cleans the query", () => {
    render(<PricingCards yearly={false} currentPlan="POS" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(replaceState).toHaveBeenCalledWith({}, "", "/pricing");
  });

  it("returns focus to the POS card's CTA when the dialog closes", () => {
    const { container } = render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(ctaOf(container, "POS"));
  });
});

describe("PricingCards trial gating by current plan", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    window.location.href = "";
    window.location.search = "";
    state.locale = "fr";
    state.user = { id: "u1" };
    state.loading = false;
  });

  it.each([[undefined], [null], ["FREE"]])(
    "offers the trial to a visitor whose plan is %s",
    (plan) => {
      const { container } = render(<PricingCards yearly={false} currentPlan={plan} />);
      const pos = within(cardOf(container, "POS"));
      expect(pos.getByText("14-day free trial")).toBeTruthy();
      expect(pos.getByText(/14 days free/)).toBeTruthy();
      expect(pos.getByRole("button", { name: "Start free trial" })).toBeTruthy();
      expect(screen.getByText("Try free")).toBeTruthy();
      expect(screen.getByText("Start free")).toBeTruthy();
    }
  );

  it.each([["OPERATIONS"], ["ENTERPRISE"]])(
    "shows no trial anywhere, and the plain switch wording, on %s",
    async (plan) => {
      mockFetch.mockResolvedValue(CHECKOUT_OK);
      const { container } = render(<PricingCards yearly={false} currentPlan={plan} />);

      expect(container.textContent).not.toContain("14-day free trial");
      expect(container.textContent).not.toMatch(/14 days free/);
      expect(container.textContent).not.toContain("Start free trial");
      // The trial bar (copy and CTA) is gone for a paying customer.
      expect(screen.queryByText("Try free")).toBeNull();
      expect(screen.queryByText("Start free")).toBeNull();
      expect(within(cardOf(container, "POS")).getByRole("button").textContent).toBe("Switch Plan");

      // The one "most popular" mark is still on POS, now as the ribbon.
      const hits = screen.getAllByText("Most Popular");
      expect(hits).toHaveLength(1);
      expect(cardOf(container, "POS").contains(hits[0])).toBe(true);

      fireEvent.click(ctaOf(container, "POS"));
      expect(screen.getByText("Switch to POS")).toBeTruthy();
      expect(screen.queryByText(/free trial/)).toBeNull();
      fireEvent.click(screen.getByText("Confirm"));
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/subscriptions/checkout",
          expect.objectContaining({ body: JSON.stringify({ plan: "POS", yearly: false }) })
        );
      });
      expect(mockFetch.mock.calls[0][1].body).not.toContain("trial");
      await waitFor(() => {
        expect(analytics.trackConversion).toHaveBeenCalledWith(
          "begin_checkout",
          expect.objectContaining({ plan: "POS", trial: false })
        );
      });
      expect(analytics.trackMetaPixelEvent).toHaveBeenCalledWith("InitiateCheckout", {
        content_name: "POS",
        content_category: "paid",
      });
    }
  );

  it("on POS the card is the current plan, with no trial and no trial bar", () => {
    const { container } = render(<PricingCards yearly={false} currentPlan="POS" />);
    const button = within(cardOf(container, "POS")).getByRole("button") as HTMLButtonElement;
    expect(button.textContent).toBe("Current Plan");
    expect(button.disabled).toBe(true);
    expect(container.textContent).not.toContain("14-day free trial");
    expect(screen.queryByText("Try free")).toBeNull();
  });

  it("a dialog opened before the plan loaded loses its trial copy once the plan arrives", () => {
    const { container, rerender } = render(<PricingCards yearly={false} />);
    fireEvent.click(ctaOf(container, "POS"));
    expect(screen.getByText("Start POS free trial")).toBeTruthy();

    rerender(<PricingCards yearly={false} currentPlan="OPERATIONS" />);
    expect(screen.getByText("Switch to POS")).toBeTruthy();
    expect(screen.queryByText("Start POS free trial")).toBeNull();
  });
});

describe("PricingCards Enterprise CTA", () => {
  beforeEach(() => {
    mockWindowOpen.mockClear();
    push.mockClear();
    state.locale = "fr";
    state.user = null;
    state.loading = false;
  });

  it.each([
    ["fr", "33781732386"],
    ["id", "6285156329091"],
  ] as const)(
    "%s opens that market's WhatsApp and fires contact_whatsapp once",
    (locale, number) => {
      state.locale = locale;
      render(<PricingCards yearly={false} />);
      fireEvent.click(screen.getByText("Contact Sales"));

      expect(mockWindowOpen).toHaveBeenCalledWith(`https://wa.me/${number}`, "_blank");
      expect(push).not.toHaveBeenCalled();
      expect(analytics.trackConversion).toHaveBeenCalledTimes(1);
      expect(analytics.trackConversion).toHaveBeenCalledWith("contact_whatsapp", {
        event_label: "pricing_enterprise",
      });
    }
  );

  // Two real numbers to choose from: nothing has opened, so this is only a click.
  // contact_whatsapp belongs to the contact page, when a number is actually picked.
  it("en sends the visitor to /en/contact without claiming a WhatsApp contact", () => {
    state.locale = "en";
    render(<PricingCards yearly={false} />);
    fireEvent.click(screen.getByText("Contact Sales"));

    expect(push).toHaveBeenCalledWith("/en/contact");
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(analytics.trackConversion).not.toHaveBeenCalled();
    const clicks = analytics.trackEvent.mock.calls.filter(([name]) => name === "cta_click");
    expect(clicks).toEqual([
      ["cta_click", { event_category: "engagement", event_label: "pricing_t4" }],
    ]);
  });
});

describe("PricingCards confirm dialog keyboard and focus", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    window.location.href = "";
    window.location.search = "";
    state.locale = "fr";
    state.user = { id: "u1" };
    state.loading = false;
  });

  function open(container: HTMLElement, plan = "OPERATIONS") {
    const trigger = ctaOf(container, plan);
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    return {
      trigger,
      dialog,
      cancel: within(dialog).getByRole("button", { name: "Cancel" }),
      confirm: within(dialog).getByRole("button", { name: "Confirm" }),
    };
  }

  it("moves focus into the dialog when it opens", () => {
    const { container } = render(<PricingCards yearly={false} />);
    const { dialog, cancel } = open(container);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(cancel);
  });

  it("keeps Tab inside the dialog: Tab from the last control wraps to the first", () => {
    const { container } = render(<PricingCards yearly={false} />);
    const { cancel, confirm } = open(container);
    confirm.focus();
    const notPrevented = fireEvent.keyDown(confirm, { key: "Tab" });
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(cancel);
  });

  it("keeps Tab inside the dialog: Shift+Tab from the first control wraps to the last", () => {
    const { container } = render(<PricingCards yearly={false} />);
    const { cancel, confirm } = open(container);
    cancel.focus();
    const notPrevented = fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(confirm);
  });

  it("lets the browser move between the dialog's own controls", () => {
    const { container } = render(<PricingCards yearly={false} />);
    const { cancel, confirm } = open(container);
    cancel.focus();
    expect(fireEvent.keyDown(cancel, { key: "Tab" })).toBe(true);
    confirm.focus();
    expect(fireEvent.keyDown(confirm, { key: "Tab", shiftKey: true })).toBe(true);
  });

  it("pulls focus back in when it has strayed outside the dialog", () => {
    const { container } = render(<PricingCards yearly={false} />);
    const { dialog, cancel, confirm } = open(container);
    (document.activeElement as HTMLElement).blur();
    expect(dialog.contains(document.activeElement)).toBe(false);

    expect(fireEvent.keyDown(document.body, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(cancel);

    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("Escape closes the dialog and focus returns to the CTA that opened it", () => {
    const { container } = render(<PricingCards yearly={false} />);
    const { trigger } = open(container);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Cancel also returns focus to the CTA that opened it", () => {
    const { container } = render(<PricingCards yearly={false} />);
    const { trigger, cancel } = open(container, "FREE");
    fireEvent.click(cancel);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("the trial bar's CTA gets focus back too", () => {
    render(<PricingCards yearly={false} />);
    const bar = screen.getByText("Start free");
    fireEvent.click(bar);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(bar);
  });

  it("Escape does nothing while an activation is in flight", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PricingCards yearly={false} />);
    const { dialog, confirm } = open(container);
    fireEvent.click(confirm);
    await waitFor(() => {
      expect((confirm as HTMLButtonElement).disabled).toBe(true);
    });

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBe(dialog);

    // With both buttons disabled there is nothing to Tab to: focus stays on the dialog.
    expect(fireEvent.keyDown(document.body, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(dialog);
  });

  it("stops listening for keys once the dialog is closed", () => {
    const { container } = render(<PricingCards yearly={false} />);
    open(container);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fireEvent.keyDown(document.body, { key: "Tab" })).toBe(true);
  });
});
