import { inngest } from "../client";
import { sendMerchantAlert, getStoreOwnerContact } from "@/lib/magicbell/client";
import { formatCurrency } from "@/lib/utils/formatting";

export const sendOrderNotification = inngest.createFunction(
  {
    id: "send-order-notification",
    retries: 3,
    triggers: [{ event: "order/placed" }],
  },
  async ({ event }) => {
    const { data } = event;

    const owner = await getStoreOwnerContact(data.storeId);
    if (!owner) {
      return { skipped: true, reason: "Store owner not found" };
    }

    sendMerchantAlert({
      recipientEmail: owner.email,
      recipientExternalId: owner.externalId,
      category: "new-order",
      title: `New order — ${data.storeName}`,
      content: `${data.orderNumber} · ${data.customerName} · ${formatCurrency(data.totalAmount, data.currency, "id-ID")}`,
      actionUrl: `/store/${data.storeId}/pos`,
    });

    return { sent: true, orderId: data.orderId };
  }
);
