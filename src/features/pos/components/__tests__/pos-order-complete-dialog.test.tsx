import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";

// Keys echo back, except the two templated ones this suite reads the interpolated text of.
const STRINGS: Record<string, string> = {
  "cashierCheckout.complete.paid": "Paid {amount}",
  "cashierCheckout.complete.orderNumber": "Order {number}",
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => STRINGS[k] ?? k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "EUR",
    formatPrice: (v: number, currency: string) => `${currency} ${Number(v).toFixed(2)}`,
  }),
}));

const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));

const api = vi.hoisted(() => {
  class ApiClientError extends Error {
    constructor(
      public response: { error: { message: string } },
      public status: number
    ) {
      super(response.error.message);
    }
  }
  return { post: vi.fn(), ApiClientError };
});
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: api.post },
  ApiClientError: api.ApiClientError,
}));

const printer = vi.hoisted(() => ({ print: vi.fn(), isPrinting: false }));
vi.mock("../../hooks/use-print-receipt", () => ({ usePrintReceipt: () => printer }));
const orderPrinting = vi.hoisted(() => ({ has: false, printOrder: vi.fn() }));
vi.mock("../../hooks/use-print-order", () => ({
  usePrintOrder: () => ({ printOrder: orderPrinting.printOrder, isPrinting: false }),
  useHasOrderPrinters: () => orderPrinting.has,
}));

// PhoneInput doesn't forward props to its <input> and pulls in flag assets — a plain input keeps this about the dialog.
vi.mock("@/components/ui/phone-input", () => ({
  PhoneInput: ({
    value,
    onChange,
    disabled,
  }: {
    value?: string;
    onChange?: (v: string | undefined) => void;
    disabled?: boolean;
  }) => (
    <input
      aria-label="phone-input"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value || undefined)}
    />
  ),
}));

import { PosOrderCompleteDialog, type OrderCompleteResult } from "../pos-order-complete-dialog";

const receipt = { orderNumber: "#12" } as unknown as ReceiptData;

const cashResult = (over: Partial<OrderCompleteResult> = {}): OrderCompleteResult => ({
  orderId: "order-1",
  orderNumber: "#12",
  total: 22.5,
  change: 7.5,
  paymentSummary: "Cash",
  receipt,
  customer: { name: "Alice", phone: "+33612345678", email: "alice@example.com" },
  ...over,
});

const renderDialog = (
  result: OrderCompleteResult,
  extra: { onNewSale?: () => void; newSaleLabel?: string } = {}
) =>
  render(
    <PosOrderCompleteDialog
      open
      storeId="store-1"
      result={result}
      onNewSale={extra.onNewSale ?? (() => {})}
      newSaleLabel={extra.newSaleLabel}
    />
  );

beforeEach(() => {
  api.post.mockResolvedValue({});
  orderPrinting.has = false;
  orderPrinting.printOrder.mockClear();
});

describe("PosOrderCompleteDialog — the money", () => {
  it("cash: 'Paid X' and a huge Change figure, formatted in the store's currency", () => {
    renderDialog(cashResult());
    // Two-arg formatPrice → the currency is there (an IDR-converting call would lose it).
    expect(screen.getByText("Paid EUR 22.50")).toBeInTheDocument();
    expect(screen.getByText("Order #12")).toBeInTheDocument();
    expect(screen.getByTestId("complete-change")).toHaveTextContent("EUR 7.50");
    expect(screen.getByTestId("complete-change").className).toContain("text-5xl");
  });

  it("an exact hand-over still shows Change, as zero", () => {
    renderDialog(cashResult({ change: 0 }));
    expect(screen.getByTestId("complete-change")).toHaveTextContent("EUR 0.00");
  });

  it("card / QRIS / split: shows the payment summary instead of a change figure", () => {
    renderDialog(cashResult({ change: null, paymentSummary: "Cash EUR 10.00 · QRIS EUR 12.50" }));
    expect(screen.queryByTestId("complete-change")).toBeNull();
    expect(screen.getByTestId("complete-summary")).toHaveTextContent(
      "Cash EUR 10.00 · QRIS EUR 12.50"
    );
  });

  it("Pay Later is 'order placed', with the amount due, not 'paid'", () => {
    renderDialog(cashResult({ change: null, paid: false, paymentSummary: "Pay Later" }));
    expect(screen.getByText("cashierCheckout.complete.orderPlaced")).toBeInTheDocument();
    expect(screen.getByText("cashierCheckout.complete.amountDue")).toBeInTheDocument();
    expect(screen.getByTestId("complete-summary")).toHaveTextContent("EUR 22.50");
  });
});

describe("PosOrderCompleteDialog — buttons", () => {
  it("New Sale is a 48px+ primary button and calls onNewSale", () => {
    const onNewSale = vi.fn();
    renderDialog(cashResult(), { onNewSale });
    const button = screen.getByRole("button", { name: "cashierCheckout.complete.newSale" });
    expect(button.className).toContain("h-12");
    fireEvent.click(button);
    expect(onNewSale).toHaveBeenCalledTimes(1);
  });

  it("the primary button's label can be overridden (between split bills)", () => {
    renderDialog(cashResult(), { newSaleLabel: "Next bill" });
    expect(screen.getByRole("button", { name: "Next bill" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "cashierCheckout.complete.newSale" })).toBeNull();
  });

  it("Print Receipt prints the receipt through usePrintReceipt", () => {
    renderDialog(cashResult());
    fireEvent.click(screen.getByRole("button", { name: "pos.print.confirm" }));
    expect(printer.print).toHaveBeenCalledWith(receipt);
  });
});

describe("PosOrderCompleteDialog — order tickets", () => {
  const printInput = {
    context: { locale: "en" as const, orderNumber: "#12", queueNumber: 7 },
    items: [],
  };
  const TICKETS = { name: "pos.printers.printTickets" };

  it("offers nothing extra to a shop with no kitchen, bar or label printer", () => {
    renderDialog(cashResult({ printInput }));
    expect(screen.queryByRole("button", TICKETS)).toBeNull();
  });

  it("offers nothing when there is no order to reprint from (e.g. an old result shape)", () => {
    orderPrinting.has = true;
    renderDialog(cashResult());
    expect(screen.queryByRole("button", TICKETS)).toBeNull();
  });

  it("reprints the tickets and labels on a tap — marked as a reprint, and allowed to pair a printer", () => {
    orderPrinting.has = true;
    renderDialog(cashResult({ printInput }));
    fireEvent.click(screen.getByRole("button", TICKETS));

    expect(orderPrinting.printOrder).toHaveBeenCalledTimes(1);
    const [sent, options] = orderPrinting.printOrder.mock.calls[0];
    expect(options).toEqual({ interactive: true });
    expect(sent.context).toMatchObject({ orderNumber: "#12", queueNumber: 7, reprint: true });
    // The stored input is not mutated: a second reprint starts from the original.
    expect(printInput.context).not.toHaveProperty("reprint");
  });

  it("keeps the receipt button and New Sale where they were", () => {
    orderPrinting.has = true;
    renderDialog(cashResult({ printInput }));
    expect(screen.getByRole("button", { name: "pos.print.confirm" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "cashierCheckout.complete.newSale" })
    ).toBeInTheDocument();
  });
});

describe("PosOrderCompleteDialog — send receipt", () => {
  it("prefills the email and WhatsApp fields from the customer", () => {
    renderDialog(cashResult());
    expect(screen.getByLabelText("cashierCheckout.complete.emailLabel")).toHaveValue(
      "alice@example.com"
    );
    expect(screen.getByLabelText("phone-input")).toHaveValue("+33612345678");
  });

  it("emails the receipt: POST send-receipt-email { email }", async () => {
    renderDialog(cashResult());
    fireEvent.click(screen.getByRole("button", { name: /cashierCheckout\.complete\.sendEmail/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/stores/store-1/pos/orders/order-1/send-receipt-email",
        {
          email: "alice@example.com",
        }
      )
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("cashierCheckout.complete.sentToast")
    );
    // The button now reads as sent.
    expect(
      await screen.findByRole("button", { name: /cashierCheckout\.complete\.sent$/ })
    ).toBeDisabled();
  });

  it("WhatsApp: POST send-receipt { phone }", async () => {
    renderDialog(cashResult());
    fireEvent.click(
      screen.getByRole("button", { name: /cashierCheckout\.complete\.sendWhatsapp/ })
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/stores/store-1/pos/orders/order-1/send-receipt", {
        phone: "+33612345678",
      })
    );
  });

  it("each channel has its own Send: editing one address doesn't touch the other", async () => {
    renderDialog(cashResult({ customer: null }));
    const email = screen.getByLabelText("cashierCheckout.complete.emailLabel");
    const emailButton = screen.getByRole("button", {
      name: /cashierCheckout\.complete\.sendEmail/,
    });
    const whatsappButton = screen.getByRole("button", {
      name: /cashierCheckout\.complete\.sendWhatsapp/,
    });

    // Nothing typed → both disabled; a malformed email keeps it disabled.
    expect(emailButton).toBeDisabled();
    expect(whatsappButton).toBeDisabled();
    fireEvent.change(email, { target: { value: "not-an-email" } });
    expect(emailButton).toBeDisabled();
    fireEvent.change(email, { target: { value: "bob@example.com" } });
    expect(emailButton).toBeEnabled();
    expect(whatsappButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("phone-input"), { target: { value: "+6281234567890" } });
    expect(whatsappButton).toBeEnabled();
  });

  it("surfaces the server's reason when sending fails", async () => {
    api.post.mockRejectedValueOnce(
      new api.ApiClientError({ error: { message: "Email is not configured" } }, 500)
    );
    renderDialog(cashResult());
    fireEvent.click(screen.getByRole("button", { name: /cashierCheckout\.complete\.sendEmail/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email is not configured"));
  });

  it("offline (no order id yet): both sends are disabled with a hint, and nothing is posted", () => {
    renderDialog(cashResult({ orderId: null }));
    expect(
      screen.getByRole("button", { name: /cashierCheckout\.complete\.sendEmail/ })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /cashierCheckout\.complete\.sendWhatsapp/ })
    ).toBeDisabled();
    expect(screen.getByLabelText("cashierCheckout.complete.emailLabel")).toBeDisabled();
    expect(screen.getByText("cashierCheckout.complete.offlineHint")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    // Printing and starting the next sale still work offline.
    expect(screen.getByRole("button", { name: "pos.print.confirm" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "cashierCheckout.complete.newSale" })).toBeEnabled();
  });

  it("does not offer SMS", () => {
    renderDialog(cashResult());
    expect(screen.queryByText(/sms/i)).toBeNull();
  });
});
