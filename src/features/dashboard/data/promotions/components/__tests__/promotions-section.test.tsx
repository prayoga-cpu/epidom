import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { ApiErrorCode } from "@/types/api/responses";
import type { CouponDto, DiscountPresetDto, LoyaltySettingsDto } from "@/types/api/cashier";

const h = vi.hoisted(() => ({
  currency: "EUR",
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
  subscription: vi.fn(),
}));

vi.mock("@/components/lang/i18n-provider", async () =>
  (await import("../../__tests__/test-utils")).i18nMock()
);
vi.mock("@/components/providers/currency-provider", async () =>
  (await import("../../__tests__/test-utils")).currencyMock(() => h.currency)
);
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiClient: h.api,
}));
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/features/stores/stores/hooks/use-subscription-status", () => ({
  useSubscriptionStatus: () => h.subscription(),
}));

import { ApiClientError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils/formatting";
import { renderWithQuery, stubResizeObserver } from "../../__tests__/test-utils";
import { PromotionsSection } from "../promotions-section";

// Rendering the whole tab (three queries, Radix dialogs) under a parallel test run
// can outlast Testing Library's 1s default; the assertions are about state, not speed.
configure({ asyncUtilTimeout: 8000 });
// getByRole walks the whole accessibility tree, which is very slow in jsdom, so these
// suites query by text / label instead. They still render Radix dialogs and a form
// library, and a parallel run on a busy machine can outlast the repo's 20s default.
vi.setConfig({ testTimeout: 90_000 });

/** Intl puts a no-break space in "IDR 5,000"; Testing Library collapses it in the DOM text but not in a matcher string. */
const idr = (value: number) => formatCurrency(value, "IDR", "en-US").replace(/\s/g, " ");

const NOW = Date.now();
const DAY = 86_400_000;

const PRESETS: DiscountPresetDto[] = [
  { id: "p1", name: "Staff 20%", type: "PERCENT", value: 20, isActive: true, sortOrder: 0 },
  { id: "p2", name: "Happy hour", type: "FIXED", value: 2.5, isActive: false, sortOrder: 1 },
];

const COUPONS: CouponDto[] = [
  {
    id: "c1",
    code: "SUMMER10",
    name: "Summer promo",
    type: "PERCENT",
    value: 10,
    minSubtotal: 20,
    maxUses: 100,
    usedCount: 3,
    validFrom: new Date(NOW - 10 * DAY).toISOString(),
    validUntil: new Date(NOW + 10 * DAY).toISOString(),
    isActive: true,
  },
  {
    id: "c2",
    code: "FIVEOFF",
    name: null,
    type: "FIXED",
    value: 5,
    minSubtotal: null,
    maxUses: null,
    usedCount: 0,
    validFrom: null,
    validUntil: null,
    isActive: true,
  },
  {
    id: "c3",
    code: "OLDONE",
    name: null,
    type: "PERCENT",
    value: 15,
    minSubtotal: null,
    maxUses: 10,
    usedCount: 10,
    validFrom: null,
    validUntil: null,
    isActive: true,
  },
  {
    id: "c4",
    code: "LATER",
    name: null,
    type: "PERCENT",
    value: 5,
    minSubtotal: null,
    maxUses: null,
    usedCount: 0,
    validFrom: new Date(NOW + 30 * DAY).toISOString(),
    validUntil: null,
    isActive: true,
  },
  {
    id: "c5",
    code: "EXPIRED1",
    name: null,
    type: "PERCENT",
    value: 5,
    minSubtotal: null,
    maxUses: null,
    usedCount: 2,
    validFrom: null,
    validUntil: new Date(NOW - 5 * DAY).toISOString(),
    isActive: true,
  },
  {
    id: "c6",
    code: "OFFLINE",
    name: null,
    type: "PERCENT",
    value: 5,
    minSubtotal: null,
    maxUses: null,
    usedCount: 0,
    validFrom: null,
    validUntil: null,
    isActive: false,
  },
];

const LOYALTY: LoyaltySettingsDto = {
  enabled: true,
  spendPerPoint: 1,
  pointValue: 0.05,
  minRedeemPoints: 20,
};

function planIs(plan: string, status = "ACTIVE") {
  h.subscription.mockReturnValue({
    data: { hasSubscription: true, subscription: { plan, status }, storeUsage: null },
    isLoading: false,
    isError: false,
  });
}

function lockedError() {
  return new ApiClientError(
    {
      success: false,
      error: {
        code: ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
        message: "Coupons requires the Operations plan.",
        details: { feature: "loyaltyAndPromotions", requiredPlan: "OPERATIONS" },
      },
    },
    403
  );
}

function serveData() {
  h.api.get.mockImplementation(async (url: string) => {
    if (url.endsWith("/discount-presets")) return PRESETS;
    if (url.endsWith("/coupons")) return COUPONS;
    if (url.endsWith("/loyalty-settings")) return LOYALTY;
    throw new Error(`unexpected GET ${url}`);
  });
}

beforeAll(stubResizeObserver);

beforeEach(() => {
  h.currency = "EUR";
  planIs("OPERATIONS");
  serveData();
  h.api.patch.mockResolvedValue({});
  h.api.delete.mockResolvedValue({ id: "p1", deleted: true });
});

const renderSection = () => renderWithQuery(<PromotionsSection storeId="store_1" />);

describe("PromotionsSection — plan gate", () => {
  it.each([
    ["FREE", "ACTIVE"],
    ["POS", "ACTIVE"],
    ["OPERATIONS", "CANCELED"],
  ])(
    "shows the upgrade gate instead of the forms on %s/%s, and fetches nothing",
    async (plan, status) => {
      planIs(plan, status);
      renderSection();

      expect(await screen.findByText("promotions.locked.title")).toBeInTheDocument();
      expect(screen.getByText(/billing\.upgradeGate\.upgradeTo Operations/)).toBeInTheDocument();
      expect(screen.queryByText("promotions.presets.title")).toBeNull();
      expect(screen.queryByText("promotions.coupons.title")).toBeNull();
      expect(screen.queryByText("promotions.loyalty.title")).toBeNull();
      expect(h.api.get).not.toHaveBeenCalled();
    }
  );

  it("shows the gate for a store with no subscription at all", () => {
    h.subscription.mockReturnValue({
      data: { hasSubscription: false, subscription: null, storeUsage: null },
      isLoading: false,
      isError: false,
    });
    renderSection();

    expect(screen.getByText("promotions.locked.title")).toBeInTheDocument();
    expect(h.api.get).not.toHaveBeenCalled();
  });

  it("waits for the plan before deciding, and fetches nothing while it loads", () => {
    h.subscription.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderSection();

    expect(screen.queryByText("promotions.locked.title")).toBeNull();
    expect(screen.queryByText("promotions.presets.title")).toBeNull();
    expect(h.api.get).not.toHaveBeenCalled();
  });

  it("shows the gate when the API answers 403 SUBSCRIPTION_FEATURE_LOCKED despite the client thinking the plan is fine", async () => {
    h.api.get.mockRejectedValue(lockedError());
    renderSection();

    expect(await screen.findByText("promotions.locked.title")).toBeInTheDocument();
    expect(screen.queryByText("promotions.presets.add")).toBeNull();
  });

  it("does not retry the 403 — the upgrade screen must not wait behind backoff", async () => {
    h.api.get.mockRejectedValue(lockedError());
    renderSection();

    await screen.findByText("promotions.locked.title");
    // One call per block (presets, coupons, loyalty) and no retries.
    expect(h.api.get).toHaveBeenCalledTimes(3);
  });

  it("lets the server decide when the plan itself could not be read", async () => {
    h.subscription.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderSection();

    expect(await screen.findByText("Staff 20%")).toBeInTheDocument();
    expect(screen.queryByText("promotions.locked.title")).toBeNull();
  });

  it("opens up on ENTERPRISE", async () => {
    planIs("ENTERPRISE");
    renderSection();
    expect(await screen.findByText("Staff 20%")).toBeInTheDocument();
  });
});

describe("PromotionsSection — content", () => {
  it("requests every preset including inactive ones, and all coupons and loyalty settings", async () => {
    renderSection();
    await screen.findByText("Staff 20%");

    expect(h.api.get).toHaveBeenCalledWith("/stores/store_1/discount-presets", {
      includeInactive: "1",
    });
    expect(h.api.get).toHaveBeenCalledWith("/stores/store_1/coupons");
    expect(h.api.get).toHaveBeenCalledWith("/stores/store_1/loyalty-settings");
  });

  it("lists presets with a type badge and the value formatted in the store currency", async () => {
    renderSection();
    const percent = (await screen.findByText("Staff 20%")).closest("li")!;
    const fixed = screen.getByText("Happy hour").closest("li")!;

    expect(within(percent).getByText("promotions.type.percent")).toBeInTheDocument();
    expect(within(percent).getByText("20%")).toBeInTheDocument();
    expect(within(fixed).getByText("promotions.type.fixed")).toBeInTheDocument();
    // Literal 2.5 EUR — not IDR-converted to €0.00.
    expect(within(fixed).getByText("€2.50")).toBeInTheDocument();
  });

  it("formats a fixed preset in IDR for an IDR store", async () => {
    h.currency = "IDR";
    serveData();
    h.api.get.mockImplementation(async (url: string) => {
      if (url.endsWith("/discount-presets"))
        return [
          { id: "p9", name: "Hemat", type: "FIXED", value: 5000, isActive: true, sortOrder: 0 },
        ];
      if (url.endsWith("/coupons")) return [];
      return LOYALTY;
    });
    renderSection();

    // Literal 5000 in the store's currency, not converted to a few cents.
    expect(await screen.findByText(idr(5000))).toBeInTheDocument();
  });

  it("lists coupons with code, discount, min spend, usage and validity", async () => {
    renderSection();
    const row = (await screen.findByText("SUMMER10")).closest("tr")!;

    expect(within(row).getByText("Summer promo")).toBeInTheDocument();
    expect(within(row).getByText("10%")).toBeInTheDocument();
    expect(within(row).getByText("€20.00")).toBeInTheDocument();
    expect(within(row).getByText("3 / 100")).toBeInTheDocument();
    expect(within(row).getByText(/^From /)).toBeInTheDocument();
    expect(within(row).getByText(/^Until /)).toBeInTheDocument();

    const open = screen.getByText("FIVEOFF").closest("tr")!;
    expect(within(open).getByText("€5.00")).toBeInTheDocument();
    expect(within(open).getByText("0 / ∞")).toBeInTheDocument();
    expect(within(open).getByText("No time limit")).toBeInTheDocument();
  });

  it("computes each coupon's status badge client-side", async () => {
    renderSection();
    await screen.findByText("SUMMER10");
    const statusOf = (code: string) => {
      const row = screen.getByText(code).closest("tr")!;
      return within(row).getByText(/^promotions\.status\./).textContent;
    };

    expect(statusOf("SUMMER10")).toBe("promotions.status.active");
    expect(statusOf("FIVEOFF")).toBe("promotions.status.active");
    expect(statusOf("OLDONE")).toBe("promotions.status.usedUp");
    expect(statusOf("LATER")).toBe("promotions.status.scheduled");
    expect(statusOf("EXPIRED1")).toBe("promotions.status.expired");
    expect(statusOf("OFFLINE")).toBe("promotions.status.inactive");
  });

  it("gives coupons an edit button but no delete button", async () => {
    renderSection();
    const row = (await screen.findByText("SUMMER10")).closest("tr")!;

    // Besides the active Switch (rendered as a role="switch" button), the row's
    // only button is Edit — there is nothing to delete a coupon with.
    const buttons = Array.from(row.querySelectorAll("button:not([role='switch'])"));
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("aria-label", "Edit SUMMER10");
    expect(screen.getByText("promotions.coupons.noDeleteHint")).toBeInTheDocument();
  });

  it("wraps the coupon table so it scrolls sideways instead of overflowing on a phone", async () => {
    renderSection();
    const table = (await screen.findByText("SUMMER10")).closest("table")!;
    const wrapper = table.closest('[class*="-mx-4"]')!;

    expect(wrapper.className).toContain("overflow-x-auto");
    expect(wrapper.className).toContain("sm:mx-0");
    expect(table.className).toMatch(/min-w-\[\d+px\]/);
  });

  it("shows the loyalty summary in the store currency", async () => {
    renderSection();
    expect(
      await screen.findByText(
        "Spend €1.00 to earn 1 point · 1 point is worth €0.05 · minimum redeem 20 points"
      )
    ).toBeInTheDocument();
  });

  it("explains what a preset and a coupon are when there are none", async () => {
    h.api.get.mockImplementation(async (url: string) =>
      url.endsWith("/loyalty-settings") ? LOYALTY : []
    );
    renderSection();

    expect(await screen.findByText("promotions.presets.empty.title")).toBeInTheDocument();
    expect(screen.getByText("promotions.presets.empty.description")).toBeInTheDocument();
    expect(screen.getByText("promotions.coupons.empty.title")).toBeInTheDocument();
    expect(screen.getByText("promotions.coupons.empty.description")).toBeInTheDocument();
  });

  it("keeps the other blocks working when one route fails, and can retry it", async () => {
    let couponCalls = 0;
    h.api.get.mockImplementation(async (url: string) => {
      if (url.endsWith("/coupons")) {
        couponCalls += 1;
        // A 4xx, which the hook never retries (a 5xx is retried with backoff).
        throw new ApiClientError(
          {
            success: false,
            error: { code: ApiErrorCode.BUSINESS_LOGIC_ERROR, message: "Coupons exploded" },
          },
          422
        );
      }
      if (url.endsWith("/discount-presets")) return PRESETS;
      return LOYALTY;
    });
    renderSection();

    expect(await screen.findByText("Coupons exploded")).toBeInTheDocument();
    expect(screen.getByText("Staff 20%")).toBeInTheDocument();
    expect(screen.queryByText("promotions.locked.title")).toBeNull();

    fireEvent.click(screen.getByText("common.actions.retry"));
    await waitFor(() => expect(couponCalls).toBeGreaterThan(1));
  });
});

describe("PromotionsSection — actions", () => {
  it("PATCHes isActive immediately when a preset's switch is toggled", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText("Turn Staff 20% on or off"));

    await waitFor(() =>
      expect(h.api.patch).toHaveBeenCalledWith("/stores/store_1/discount-presets/p1", {
        isActive: false,
      })
    );
  });

  it("turns an inactive preset back on", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText("Turn Happy hour on or off"));

    await waitFor(() =>
      expect(h.api.patch).toHaveBeenCalledWith("/stores/store_1/discount-presets/p2", {
        isActive: true,
      })
    );
  });

  it("flips the switch optimistically and restores it when the PATCH fails", async () => {
    let rejectPatch: (error: Error) => void = () => {};
    h.api.patch.mockImplementation(() => new Promise((_, reject) => (rejectPatch = reject)));
    renderSection();
    const toggle = await screen.findByLabelText("Turn Staff 20% on or off");
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());

    rejectPatch(new Error("offline"));
    await waitFor(() => expect(toggle).toBeChecked());
    expect(h.toast.error).toHaveBeenCalledWith("common.error", { description: "offline" });
  });

  it("PATCHes isActive on a coupon's switch, never sending a code", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText("Turn SUMMER10 on or off"));

    await waitFor(() =>
      expect(h.api.patch).toHaveBeenCalledWith("/stores/store_1/coupons/c1", { isActive: false })
    );
  });

  it("deletes a preset only after the confirmation dialog", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText("Delete Staff 20%"));

    expect(await screen.findByText("promotions.presets.deleteTitle")).toBeInTheDocument();
    expect(h.api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("common.actions.delete"));
    await waitFor(() =>
      expect(h.api.delete).toHaveBeenCalledWith("/stores/store_1/discount-presets/p1")
    );
  });

  it("does not delete when the confirmation is cancelled", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText("Delete Staff 20%"));
    fireEvent.click(await screen.findByText("common.actions.cancel"));

    await waitFor(() => expect(screen.queryByText("promotions.presets.deleteTitle")).toBeNull());
    expect(h.api.delete).not.toHaveBeenCalled();
  });

  it("opens the add-preset dialog from the header button", async () => {
    renderSection();
    await screen.findByText("Staff 20%");
    fireEvent.click(screen.getByText("promotions.presets.add"));

    expect(await screen.findByText("promotions.presets.dialog.addTitle")).toBeInTheDocument();
  });

  it("opens the edit dialog prefilled from a preset row", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText("Edit Staff 20%"));

    expect(await screen.findByText("promotions.presets.dialog.editTitle")).toBeInTheDocument();
    expect(
      (screen.getByLabelText("promotions.presets.dialog.name") as HTMLInputElement).value
    ).toBe("Staff 20%");
  });

  it("opens the coupon dialog with the code locked when editing", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText("Edit SUMMER10"));

    const code = (await screen.findByLabelText(
      "promotions.coupons.dialog.code"
    )) as HTMLInputElement;
    expect(code.value).toBe("SUMMER10");
    expect(code).toHaveAttribute("readonly");
  });
});
