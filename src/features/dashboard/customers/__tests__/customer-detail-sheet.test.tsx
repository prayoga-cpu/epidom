import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  toastError: vi.fn(),
  currency: { current: "EUR" },
}));

vi.mock("@/components/lang/i18n-provider", async () => {
  const { mockUseI18n } = await import("./helpers");
  return { useI18n: mockUseI18n };
});
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeUseCurrency } = await import("./helpers");
  return { useCurrency: makeUseCurrency(() => h.currency.current) };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: h.toastError } }));
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiClient: { get: h.get, post: h.post, patch: vi.fn() } };
});

import { CustomerDetailSheet } from "../components/customer-detail-sheet";
import { apiError, makeCustomer, makeDetail, renderWithQuery } from "./helpers";

interface SheetProps {
  canManage?: boolean;
  loyaltyEnabled?: boolean;
  customer?: ReturnType<typeof makeCustomer>;
}

function renderSheet({
  canManage = true,
  loyaltyEnabled = true,
  customer = makeCustomer(),
}: SheetProps = {}) {
  const onEdit = vi.fn();
  const onOpenChange = vi.fn();
  renderWithQuery(
    <CustomerDetailSheet
      storeId="s1"
      customer={customer}
      open
      onOpenChange={onOpenChange}
      canManage={canManage}
      loyaltyEnabled={loyaltyEnabled}
      onEdit={onEdit}
    />
  );
  return { onEdit, onOpenChange };
}

const pointsInput = () => screen.getByLabelText("customers.adjust.amount") as HTMLInputElement;
const reasonInput = () => screen.getByLabelText("customers.adjust.reason") as HTMLInputElement;
const submitAdjust = () => screen.getByRole("button", { name: "customers.adjust.submit" });

async function loaded() {
  // The orders list is the last thing the detail response fills in.
  await screen.findByText("ORD-0001");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.currency.current = "EUR";
  h.get.mockResolvedValue(makeDetail());
  h.post.mockResolvedValue(makeCustomer({ points: 70 }));
});

describe("CustomerDetailSheet — content", () => {
  it("fills the header and stat tiles from the row straight away, before the detail lands", () => {
    h.get.mockReturnValue(new Promise(() => {})); // never resolves
    renderSheet();

    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("Customer since Jan 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("+33612345678")).toBeInTheDocument();
    expect(screen.getByText("marie@example.com")).toBeInTheDocument();
    expect(screen.getByText("€1,234.50")).toBeInTheDocument();
    expect(screen.getByText("customers.detail.recentOrders")).toBeInTheDocument();
  });

  it("shows the customer's notes, or says there is no contact when nothing is saved", () => {
    h.get.mockReturnValue(new Promise(() => {}));
    renderSheet({
      customer: makeCustomer({ notes: "Prefers oat milk", phone: null, email: null }),
    });

    expect(screen.getByText("Prefers oat milk")).toBeInTheDocument();
    expect(screen.getByText("customers.detail.noContact")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("lists the recent orders with their status and the loyalty ledger with signed points", async () => {
    renderSheet();
    await loaded();

    expect(screen.getByText("customers.status.delivered")).toBeInTheDocument();

    expect(screen.getByText("customers.ledger.earn")).toBeInTheDocument();
    expect(screen.getByText("customers.ledger.redeem")).toBeInTheDocument();
    expect(screen.getByText("+49")).toHaveClass("text-emerald-600");
    expect(screen.getByText("-20")).toHaveClass("text-destructive");
    expect(screen.getByText("Order ORD-0001")).toBeInTheDocument();
  });

  it("formats order totals and life spending in the store currency without IDR conversion", async () => {
    renderSheet();
    await loaded();

    // 48.9 and 1234.5 are already euros; a dropped `currency` argument would turn
    // them into ~€0.00 / €0.07.
    expect(screen.getByText("€48.90")).toBeInTheDocument();
    expect(screen.getByText("€1,234.50")).toBeInTheDocument();
    expect(screen.queryByText("€0.00")).toBeNull();
    expect(screen.queryByText("€0.07")).toBeNull();
  });

  it("falls back to the raw status when it isn't one it has a label for", async () => {
    h.get.mockResolvedValue(
      makeDetail({
        orders: [
          {
            id: "o9",
            orderNumber: "ORD-9",
            orderDate: "2026-09-01T10:00:00.000Z",
            total: 5,
            status: "PENDING",
          },
        ],
      })
    );
    renderSheet();
    expect(await screen.findByText("PENDING")).toBeInTheDocument();
  });

  it("says so when there is no order or points history yet", async () => {
    h.get.mockResolvedValue(makeDetail({ orders: [], loyaltyEntries: [] }));
    renderSheet();
    expect(await screen.findByText("customers.detail.noOrders")).toBeInTheDocument();
    expect(screen.getByText("customers.detail.noPointsHistory")).toBeInTheDocument();
  });

  it("keeps the header and offers a retry when the detail can't be loaded", async () => {
    h.get.mockRejectedValueOnce(apiError(500, "boom"));
    renderSheet();

    expect(await screen.findByRole("alert")).toHaveTextContent("customers.detail.loadFailed");
    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "customers.detail.retry" }));
    await loaded();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has a 40px close button of its own", () => {
    renderSheet();
    const close = screen.getByRole("button", { name: "customers.detail.close" });
    expect(close.className).toContain("size-10");
  });
});

describe("CustomerDetailSheet — adjust points", () => {
  it("submits a removal as a negative number with the reason, then shows the new balance", async () => {
    renderSheet();
    await loaded();

    fireEvent.click(screen.getByRole("button", { name: "customers.adjust.remove" }));
    fireEvent.change(pointsInput(), { target: { value: "30" } });
    fireEvent.change(reasonInput(), { target: { value: "  Correction  " } });
    // Live preview, computed from the balance on screen (100 - 30).
    expect(screen.getByText("Balance after: 70 points")).toBeInTheDocument();
    fireEvent.click(submitAdjust());

    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith("/stores/s1/customers/c1/points", {
        points: -30,
        note: "Correction",
      })
    );
    expect(await screen.findByRole("status")).toHaveTextContent("New balance: 70 points");
    // The form is ready for the next adjustment.
    expect(pointsInput().value).toBe("");
    expect(reasonInput().value).toBe("");
  });

  it("submits a grant as a positive number (the default direction)", async () => {
    h.post.mockResolvedValue(makeCustomer({ points: 150 }));
    renderSheet();
    await loaded();

    expect(screen.getByRole("button", { name: "customers.adjust.add" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.change(pointsInput(), { target: { value: "50" } });
    fireEvent.change(reasonInput(), { target: { value: "Goodwill" } });
    fireEvent.click(submitAdjust());

    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith("/stores/s1/customers/c1/points", {
        points: 50,
        note: "Goodwill",
      })
    );
    expect(await screen.findByRole("status")).toHaveTextContent("New balance: 150 points");
  });

  it("requires an amount and a reason before it calls the API", async () => {
    renderSheet();
    await loaded();

    fireEvent.click(submitAdjust());

    expect(await screen.findByText("customers.adjust.errors.amountInvalid")).toBeInTheDocument();
    expect(screen.getByText("customers.adjust.errors.reasonRequired")).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it("rejects a fractional or negative amount typed into the field", async () => {
    renderSheet();
    await loaded();

    fireEvent.change(pointsInput(), { target: { value: "-5" } });
    fireEvent.change(reasonInput(), { target: { value: "x" } });
    fireEvent.click(submitAdjust());

    expect(await screen.findByText("customers.adjust.errors.amountInvalid")).toBeInTheDocument();
    expect(h.post).not.toHaveBeenCalled();
  });

  it("shows the server's refusal under the points field and shows no new balance", async () => {
    const refusal = "This customer only has 100 points, so 500 can't be removed";
    h.post.mockRejectedValue(apiError(400, "Rejected", [{ field: "points", message: refusal }]));
    renderSheet();
    await loaded();

    fireEvent.click(screen.getByRole("button", { name: "customers.adjust.remove" }));
    fireEvent.change(pointsInput(), { target: { value: "500" } });
    fireEvent.change(reasonInput(), { target: { value: "Oops" } });
    fireEvent.click(submitAdjust());

    const message = await screen.findByText(refusal);
    expect(message.closest("[data-slot=form-item]")!.contains(pointsInput())).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
    expect(h.toastError).not.toHaveBeenCalled();
    // What was typed is kept so it can be corrected.
    expect(pointsInput().value).toBe("500");
  });

  it("uses a toast when the failure isn't about a field", async () => {
    h.post.mockRejectedValue(apiError(500, "Server exploded"));
    renderSheet();
    await loaded();

    fireEvent.change(pointsInput(), { target: { value: "5" } });
    fireEvent.change(reasonInput(), { target: { value: "Test" } });
    fireEvent.click(submitAdjust());

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Server exploded"));
  });

  it("gives the direction toggle and inputs a 40px touch target", async () => {
    renderSheet();
    await loaded();
    const toggle = screen.getByRole("button", { name: "customers.adjust.add" });
    expect(toggle.className).toContain("h-10");
    expect(pointsInput().className).toContain("h-10");
    expect(submitAdjust().className).toContain("h-10");
  });
});

describe("CustomerDetailSheet — permissions", () => {
  it("canManage: shows Edit, and Edit hands over to the form", async () => {
    const { onEdit } = renderSheet({ canManage: true });
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "customers.detail.edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("read-only persona: no Edit and no Adjust points, but the history is still readable", async () => {
    renderSheet({ canManage: false });
    await loaded();

    expect(screen.queryByRole("button", { name: "customers.detail.edit" })).toBeNull();
    expect(screen.queryByText("customers.adjust.title")).toBeNull();
    expect(screen.queryByRole("form", { name: "customers.adjust.title" })).toBeNull();
    expect(screen.queryByLabelText("customers.adjust.amount")).toBeNull();

    expect(screen.getByText("customers.detail.pointsHistory")).toBeInTheDocument();
    expect(screen.getByText("ORD-0001")).toBeInTheDocument();
  });
});

describe("CustomerDetailSheet — loyalty off", () => {
  it("has no points, member-since, ledger or adjust form, even for a manager", async () => {
    renderSheet({ canManage: true, loyaltyEnabled: false });
    await loaded();

    expect(screen.queryByText("customers.detail.points")).toBeNull();
    expect(screen.queryByText("customers.detail.memberSince")).toBeNull();
    expect(screen.queryByText("customers.detail.memberBadge")).toBeNull();
    expect(screen.queryByText("customers.detail.pointsHistory")).toBeNull();
    expect(screen.queryByText("customers.ledger.earn")).toBeNull();
    expect(screen.queryByText("customers.adjust.title")).toBeNull();

    // The non-loyalty facts are all still there.
    const stats = screen.getByText("customers.detail.lifetimeSpend").closest("dl")!;
    expect(within(stats).getByText("customers.detail.orders")).toBeInTheDocument();
    expect(within(stats).getByText("customers.detail.lastVisit")).toBeInTheDocument();
  });

  it("shows points and member since when loyalty is on", async () => {
    renderSheet({ loyaltyEnabled: true });
    await loaded();
    const stats = screen.getByText("customers.detail.lifetimeSpend").closest("dl")!;
    expect(within(stats).getByText("customers.detail.points")).toBeInTheDocument();
    expect(within(stats).getByText("100")).toBeInTheDocument();
    expect(within(stats).getByText("customers.detail.memberSince")).toBeInTheDocument();
  });
});
