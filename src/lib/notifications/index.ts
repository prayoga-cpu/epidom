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
  const itemLines = data.items
    .map((i) => `  • ${i.name} x${i.quantity}`)
    .join("\n");

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

export async function notifyMerchantNewOrder(
  data: OrderNotificationData
): Promise<void> {
  if (!isFonnteAvailable()) {
    console.warn("[notifications] Fonnte not configured — skipping WhatsApp notification");
    return;
  }

  const message = formatOrderNotification(data);
  await sendFonnteWhatsApp({ to: data.merchantPhone, message });
}
