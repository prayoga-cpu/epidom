import { inngest } from "../client";
import { notifyMerchantNewOrder } from "@/lib/notifications";

export const sendOrderNotification = inngest.createFunction(
  {
    id: "send-order-notification",
    retries: 3,
    triggers: [{ event: "order/placed" }],
  },
  async ({ event }) => {
    const { data } = event;

    if (!data.merchantPhone) {
      return { skipped: true, reason: "No merchant phone configured" };
    }

    await notifyMerchantNewOrder({
      orderNumber: data.orderNumber,
      customerName: data.customerName,
      totalAmount: data.totalAmount,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      items: data.items,
      merchantPhone: data.merchantPhone,
      storeName: data.storeName,
    });

    return { sent: true, orderId: data.orderId };
  }
);
