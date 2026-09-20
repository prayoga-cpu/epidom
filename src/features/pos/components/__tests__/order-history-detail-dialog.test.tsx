/**
 * The receipt section of an order in Order Queue → History: the emailed receipt
 * has its own status (sent / failed / not sent yet), separate from WhatsApp's.
 * It used to be one "last send" line that read "sent via WhatsApp" even when the
 * last send had been an email.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
    formatDateTimeWithTimezone: (d: string) => `at ${d}`,
    formatDate: (d: unknown) => String(d),
  }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "EUR",
    formatPrice: (v: number, c: string) => `${c} ${Number(v).toFixed(2)}`,
  }),
}));

const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiClient: api }));

vi.mock("@/lib/pwa/thermal-printer", () => ({
  isBluetoothSupported: () => false,
  isPrinterConnected: () => false,
  printReceipt: vi.fn(),
}));
vi.mock("../../hooks/use-printer-settings", () => ({ usePrinterSettings: () => ({}) }));
vi.mock("../../hooks/use-update-order-status", () => ({
  useUpdateOrderStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../hooks/use-refund-order", () => ({
  useRefundOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../mark-paid-dialog", () => ({ MarkPaidDialog: () => null }));
vi.mock("../refund-dialog", () => ({ RefundDialog: () => null }));
vi.mock("../send-receipt-whatsapp", () => ({ SendReceiptWhatsApp: () => null }));

import { OrderHistoryDetailDialog } from "../order-history-detail-dialog";
import type { OrderHistoryItem } from "../../types/pos.types";

const order = (over: Record<string, unknown> = {}) =>
  ({
    id: "order-1",
    orderNumber: "POS-1",
    status: "DELIVERED",
    source: "POS",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    customerName: "Alice",
    customerPhone: "+33612345678",
    customerEmail: "alice@example.com",
    subtotal: "10",
    tax: "0",
    delivery: "0",
    total: "10",
    orderDate: "2026-09-19T21:00:00.000Z",
    createdAt: "2026-09-19T21:00:00.000Z",
    items: [],
    ...over,
  }) as unknown as OrderHistoryItem;

const sendRow = (over: Record<string, unknown> = {}) => ({
  id: "send-1",
  channel: "EMAIL",
  recipientPhone: null,
  recipientEmail: "alice@example.com",
  status: "SENT",
  fonnteMessageId: null,
  errorMessage: null,
  sentAt: "2026-09-19T21:57:00.000Z",
  ...over,
});

let sendLog: Array<ReturnType<typeof sendRow>> = [];

const renderDialog = (o: OrderHistoryItem = order()) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrderHistoryDetailDialog order={o} storeId="store-1" onOpenChange={() => {}} />
    </QueryClientProvider>
  );
};

const emailStatus = () => screen.getByTestId("receipt-email-status");

beforeEach(() => {
  sendLog = [];
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockImplementation(async () => sendLog);
  api.post.mockResolvedValue({});
});

describe("OrderHistoryDetailDialog — emailed receipt status", () => {
  it("says 'not sent yet' when nothing has gone out, with the address prefilled to send to", async () => {
    renderDialog();
    await waitFor(() => expect(emailStatus()).toHaveAttribute("data-state", "not_sent"));
    expect(emailStatus()).toHaveTextContent("pos.receiptEmail.notSent");
    expect(screen.getByText("pos.receiptEmail.label")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("cashierPayments.sendEmail.placeholder")).toHaveValue(
      "alice@example.com"
    );
    expect(
      screen.getByRole("button", { name: /cashierPayments\.sendEmail\.button/ })
    ).toBeEnabled();
  });

  it("says it was emailed — to whom and when — and offers a resend", async () => {
    sendLog = [sendRow()];
    renderDialog();

    await waitFor(() => expect(emailStatus()).toHaveAttribute("data-state", "sent"));
    expect(emailStatus()).toHaveTextContent("pos.receiptEmail.sent");
    expect(emailStatus()).toHaveTextContent("alice@example.com");
    expect(emailStatus()).toHaveTextContent("at 2026-09-19T21:57:00.000Z");
    expect(
      screen.getByRole("button", { name: /cashierPayments\.sendEmail\.resend/ })
    ).toBeEnabled();
  });

  it("reports a failed send and why", async () => {
    sendLog = [sendRow({ status: "FAILED", errorMessage: "Mailbox full" })];
    renderDialog();

    await waitFor(() => expect(emailStatus()).toHaveAttribute("data-state", "failed"));
    expect(emailStatus()).toHaveTextContent("pos.receiptEmail.failed");
    expect(emailStatus()).toHaveTextContent("Mailbox full");
    // A plain Send again — there is nothing delivered to "re"-send.
    expect(
      screen.getByRole("button", { name: /cashierPayments\.sendEmail\.button/ })
    ).toBeEnabled();
  });

  it("a WhatsApp send does not count as the receipt having been emailed", async () => {
    sendLog = [
      sendRow({
        id: "wa-1",
        channel: "WHATSAPP",
        recipientPhone: "+33612345678",
        recipientEmail: null,
      }),
    ];
    renderDialog();

    // The WhatsApp line reports the WhatsApp send...
    expect(await screen.findByText(/pos\.history\.receiptSent/)).toBeInTheDocument();
    // ...and the emailed receipt is still not sent.
    expect(emailStatus()).toHaveAttribute("data-state", "not_sent");
  });

  it("an email send does not show up as 'sent via WhatsApp'", async () => {
    sendLog = [sendRow()];
    renderDialog();
    await waitFor(() => expect(emailStatus()).toHaveAttribute("data-state", "sent"));
    // The old single "last send" line mislabelled every send as WhatsApp.
    expect(screen.queryByText(/pos\.history\.receiptSent/)).toBeNull();
  });

  it("re-reads the status after a manual send, so it turns to sent without reopening", async () => {
    api.post.mockImplementation(async (url: string) => {
      if (url.endsWith("/send-receipt-email")) sendLog = [sendRow()];
      return {};
    });
    renderDialog();
    await waitFor(() => expect(emailStatus()).toHaveAttribute("data-state", "not_sent"));

    fireEvent.click(screen.getByRole("button", { name: /cashierPayments\.sendEmail\.button/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/stores/store-1/pos/orders/order-1/send-receipt-email",
        { email: "alice@example.com" }
      )
    );
    await waitFor(() => expect(emailStatus()).toHaveAttribute("data-state", "sent"));
  });
});
