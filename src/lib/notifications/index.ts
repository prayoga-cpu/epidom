import { sendFonnteWhatsApp, isFonnteAvailable } from "./providers/fonnte";
import { formatCurrency } from "@/lib/utils/formatting";
import { buildReceiptWhatsAppMessage, type ReceiptLocale } from "@/lib/receipts/receipt-labels";

export interface OrderNotificationData {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  items: Array<{ name: string; quantity: number }>;
  merchantPhone: string;
  storeName: string;
}

function formatOrderNotification(data: OrderNotificationData): string {
  const itemLines = data.items.map((i) => `  • ${i.name} x${i.quantity}`).join("\n");

  const amount = formatCurrency(data.totalAmount, data.currency, "id-ID");

  return (
    `🛒 *Pesanan Baru!* - ${data.storeName}\n\n` +
    `No. Pesanan: *${data.orderNumber}*\n` +
    `Pelanggan: ${data.customerName}\n\n` +
    `*Item:*\n${itemLines}\n\n` +
    `*Total: ${amount}*\n` +
    `Pembayaran: ${data.paymentMethod}\n\n` +
    `Buka dasbor untuk konfirmasi pesanan.`
  );
}

export async function notifyMerchantNewOrder(data: OrderNotificationData): Promise<void> {
  if (!isFonnteAvailable()) {
    console.warn("[notifications] Fonnte not configured — skipping WhatsApp notification");
    return;
  }

  const message = formatOrderNotification(data);
  await sendFonnteWhatsApp({ to: data.merchantPhone, message });
}

export interface CustomerReceiptNotificationData {
  customerName: string;
  storeName: string;
  totalAmount: number;
  currency: string;
  orderDate: Date;
  receiptUrl: string;
  customerPhone: string;
  locale: ReceiptLocale;
}

function formatCustomerReceiptNotification(data: CustomerReceiptNotificationData): string {
  return buildReceiptWhatsAppMessage({
    customerName: data.customerName,
    storeName: data.storeName,
    total: data.totalAmount,
    currency: data.currency,
    orderDate: data.orderDate,
    receiptUrl: data.receiptUrl,
    locale: data.locale,
  });
}

/** Sends the customer-facing digital-receipt link — see send-customer-receipt.ts for when this fires. */
export async function notifyCustomerReceipt(
  data: CustomerReceiptNotificationData
): Promise<{ fonnteMessageId: string }> {
  if (!isFonnteAvailable()) {
    throw new Error("FONNTE_API_TOKEN is not configured");
  }

  const message = formatCustomerReceiptNotification(data);
  const result = await sendFonnteWhatsApp({ to: data.customerPhone, message });
  return { fonnteMessageId: result.id };
}
