import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/storefront/components/storefront-controls", () => ({
  StorefrontControls: () => null,
}));
vi.mock("@/components/ui/phone-input", () => ({ PhoneInput: () => null }));
vi.mock("@/features/storefront/hooks/use-track-storefront-event", () => ({
  trackEvent: vi.fn(),
  useTrackPageView: vi.fn(),
}));

import { OrderStatusClient } from "../order-status-client";

type OrderProps = React.ComponentProps<typeof OrderStatusClient>;

const order: OrderProps["order"] = {
  id: "order-1",
  orderNumber: "ORD-20261006-ABC123",
  queueNumber: 12,
  status: "CONFIRMED",
  paymentStatus: "PENDING",
  paymentMethod: "CASH",
  customerName: "Sari",
  orderType: "DINE_IN",
  tableNumber: null,
  notes: null,
  total: 50000,
  currency: "IDR",
  createdAt: "2026-10-06T00:00:00.000Z",
  items: [],
};

function renderOrder(overrides: Partial<OrderProps["order"]> = {}) {
  return render(
    <OrderStatusClient
      storefront={{
        slug: "warung",
        displayName: "Warung",
        themeColor: "#FF6B35",
        whatsappNumber: null,
      }}
      order={{ ...order, ...overrides }}
    />
  );
}

describe("OrderStatusClient — pay at the cashier", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tells the customer to pay at the cashier and shows the number to give", () => {
    renderOrder();
    expect(screen.getByText("publicOrder.orderStatus.payAtCashierTitle")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    // The badge says where to pay, not a bare "Awaiting Payment".
    expect(screen.getByText(/publicOrder\.orderStatus\.paymentAtCashier/)).toBeInTheDocument();
  });

  it("falls back to the order number without a queue number", () => {
    renderOrder({ queueNumber: null });
    // Once in the header, once on the card.
    expect(screen.getAllByText("ORD-20261006-ABC123")).toHaveLength(2);
    expect(screen.queryByText(/^#/)).toBeNull();
  });

  it("hides the card once paid, and for a cancelled order", () => {
    const { unmount } = renderOrder({ paymentStatus: "PAID" });
    expect(screen.queryByText("publicOrder.orderStatus.payAtCashierTitle")).toBeNull();
    unmount();
    renderOrder({ status: "CANCELLED" });
    expect(screen.queryByText("publicOrder.orderStatus.payAtCashierTitle")).toBeNull();
  });

  it("keeps watching a DELIVERED order until it is paid (kitchen display off)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "DELIVERED", paymentStatus: "PAID" } }),
    });
    renderOrder({ status: "DELIVERED" });
    expect(screen.getByText("publicOrder.orderStatus.payAtCashierTitle")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/public/orders/order-1/status");
    expect(screen.queryByText("publicOrder.orderStatus.payAtCashierTitle")).toBeNull();
  });

  it("stops polling a DELIVERED order that is already paid", async () => {
    renderOrder({ status: "DELIVERED", paymentStatus: "PAID" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
