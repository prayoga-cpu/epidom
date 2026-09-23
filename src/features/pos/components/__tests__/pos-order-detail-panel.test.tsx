import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "IDR",
    formatPrice: (v: number, c?: string) => `${c ?? ""} ${v}`,
  }),
}));

const handleCancel = vi.fn();
const handleResume = vi.fn();
vi.mock("../../hooks/use-order-queue-actions", () => ({
  useOrderQueueActions: () => ({ handleCancel, handleResume, confirmDialog: null }),
}));
// The real action row pulls in react-query mutations; its own behavior is not
// what's under test here, only that the panel hosts it.
vi.mock("../pos-order-primary-action", () => ({
  PosOrderPrimaryAction: ({ order, trailing }: any) => (
    <div data-testid="primary-action">
      <span>{order.status}</span>
      {trailing}
    </div>
  ),
}));

import { PosOrderDetailPanel } from "../pos-order-detail-panel";
import { makeOrder } from "./order-queue-fixtures";

const renderPanel = (order: ReturnType<typeof makeOrder> | null) =>
  render(<PosOrderDetailPanel order={order} storeId="store-1" onUpdateStatus={vi.fn()} />);

describe("PosOrderDetailPanel", () => {
  it("asks the cashier to pick an order when none is selected", () => {
    renderPanel(null);
    expect(screen.getByText("pos.queue.detailEmptyTitle")).toBeInTheDocument();
    expect(screen.queryByTestId("primary-action")).not.toBeInTheDocument();
  });

  it("puts the order number, status and queue number in the header", () => {
    renderPanel(makeOrder({ status: "IN_PRODUCTION", queueNumber: 12 }));
    expect(screen.getByText("POS-20260919-AB12CD")).toBeInTheDocument();
    expect(screen.getByText("pos.status.inProduction")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
  });

  it("shows a dash rather than '#null' when the order has no queue number", () => {
    renderPanel(makeOrder({ queueNumber: null }));
    expect(screen.queryByText(/#null|#undefined/)).not.toBeInTheDocument();
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("lists who and where: cashier, table, guests, customer, phone, email", () => {
    renderPanel(
      makeOrder({
        shift: { staffMember: { id: "s1", name: "Sari" } },
        tableLabel: "Patio 2",
        guestCount: 3,
        customerName: "Budi",
        customerPhone: "0812",
        customerEmail: "budi@example.com",
      })
    );
    for (const text of ["Sari", "Patio 2", "3", "Budi", "0812", "budi@example.com"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("leaves out the rows an order has no value for", () => {
    renderPanel(
      makeOrder({ shift: null, guestCount: null, customerPhone: null, customerEmail: null })
    );
    for (const key of ["detailCashier", "detailGuests", "detailPhone", "detailEmail"]) {
      expect(screen.queryByText(`pos.queue.${key}`)).not.toBeInTheDocument();
    }
  });

  it("lists items with quantity, options, notes and line total", () => {
    renderPanel(
      makeOrder({
        items: [
          {
            id: "i1",
            menuItemId: "m1",
            name: "Latte",
            quantity: 2,
            unitPrice: 30000,
            total: 60000,
            status: "PENDING",
            selectedOptions: [
              { groupName: "Milk", optionName: "Oat", priceAdjustment: 0 },
              { groupName: "Size", optionName: "Large", priceAdjustment: 0 },
            ],
            notes: "less ice",
          },
        ],
      })
    );
    expect(screen.getByText("2x Latte")).toBeInTheDocument();
    expect(screen.getByText("Oat, Large")).toBeInTheDocument();
    expect(screen.getByText("“less ice”")).toBeInTheDocument();
    expect(screen.getByText("IDR 60000")).toBeInTheDocument();
  });

  it("shows only the charges that applied, the discount as a deduction", () => {
    renderPanel(
      makeOrder({
        subtotal: 100000,
        discountAmount: 10000,
        serviceCharge: 5000,
        tax: 0,
        delivery: 0,
        total: 95000,
      })
    );
    expect(screen.getByText("pos.cart.subtotal")).toBeInTheDocument();
    expect(screen.getByText("−IDR 10000")).toBeInTheDocument();
    expect(screen.getByText("pos.cart.serviceCharge")).toBeInTheDocument();
    expect(screen.queryByText("pos.cart.tax")).not.toBeInTheDocument();
    expect(screen.getByText("IDR 95000")).toBeInTheDocument();
  });

  it("skips every charge line on an order that predates the fields", () => {
    renderPanel(makeOrder({ discountAmount: undefined, serviceCharge: undefined, tax: undefined }));
    expect(screen.queryByText("pos.cart.discount")).not.toBeInTheDocument();
    expect(screen.queryByText("pos.cart.serviceCharge")).not.toBeInTheDocument();
    expect(screen.queryByText("pos.cart.tax")).not.toBeInTheDocument();
  });

  it("lists each tender of a split payment", () => {
    renderPanel(
      makeOrder({
        paymentMethod: "SPLIT",
        payments: [
          {
            id: "p1",
            method: "CASH",
            amount: 50000,
            amountTendered: null,
            change: null,
            note: null,
            refundedAmount: 0,
          },
          {
            id: "p2",
            method: "QRIS",
            amount: 60000,
            amountTendered: null,
            change: null,
            note: null,
            refundedAmount: 0,
          },
        ],
      })
    );
    expect(screen.getByText("publicOrder.paymentMethods.CASH")).toBeInTheDocument();
    expect(screen.getByText("IDR 50000")).toBeInTheDocument();
    expect(screen.getByText("publicOrder.paymentMethods.QRIS")).toBeInTheDocument();
    expect(screen.getByText("IDR 60000")).toBeInTheDocument();
  });

  it("flags an unpaid order, in the header and the payment section", () => {
    renderPanel(makeOrder({ paymentStatus: "PENDING", paymentMethod: "PAY_LATER" }));
    expect(screen.getByText("pos.orderCard.unpaid")).toBeInTheDocument();
    expect(screen.getByText(/pos\.queue\.detailNotPaid/)).toBeInTheDocument();
  });

  it("hosts the order's actions, and cancel routes to the confirm flow", () => {
    handleCancel.mockClear();
    renderPanel(makeOrder({ status: "CONFIRMED" }));
    expect(screen.getByTestId("primary-action")).toHaveTextContent("CONFIRMED");
    fireEvent.click(screen.getByRole("button", { name: "pos.orderCard.cancel" }));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("has no footer at all for a delivered, paid order — nothing to press", () => {
    renderPanel(makeOrder({ status: "DELIVERED", paymentStatus: "PAID" }));
    expect(screen.queryByTestId("primary-action")).not.toBeInTheDocument();
  });

  it("still offers Mark as Paid on a delivered order that is unpaid, but not cancel", () => {
    renderPanel(makeOrder({ status: "DELIVERED", paymentStatus: "PENDING" }));
    expect(screen.getByTestId("primary-action")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pos.orderCard.cancel" })).not.toBeInTheDocument();
  });

  it("makes the cancel button a 44px target", () => {
    renderPanel(makeOrder({ status: "CONFIRMED" }));
    expect(screen.getByRole("button", { name: "pos.orderCard.cancel" }).className).toContain(
      "size-11"
    );
  });
});
