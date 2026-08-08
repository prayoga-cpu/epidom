import { sendFonnteWhatsApp, isFonnteAvailable } from "./providers/fonnte";

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

  const amount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: data.currency,
    minimumFractionDigits: 0,
  }).format(data.totalAmount);

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
  orderDate: string;
  receiptUrl: string;
  customerPhone: string;
}

function formatCustomerReceiptNotification(data: CustomerReceiptNotificationData): string {
  const amount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: data.currency,
    minimumFractionDigits: 0,
  }).format(data.totalAmount);

  return (
    `Hai ${data.customerName} 👋\n` +
    `Terima kasih ya kunjungannya di *${data.storeName}*.\n` +
    `Berikut total pesananmu sebesar *${amount}*, pada ${data.orderDate}.\n\n` +
    `Detailnya kami cantumkan di sini ya\n${data.receiptUrl}`
  );
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
