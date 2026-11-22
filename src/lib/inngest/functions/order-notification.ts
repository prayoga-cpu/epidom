import { inngest } from "../client";
import { sendMerchantAlert, getStoreOwnerContact } from "@/lib/magicbell/client";
import { formatCurrency } from "@/lib/utils/formatting";

// The owner's alert speaks the business language; English when unknown.
const NEW_ORDER_TITLE: Record<"en" | "fr" | "id" | "th", string> = {
  en: "New order",
  fr: "Nouvelle commande",
  id: "Pesanan baru",
  th: "ออเดอร์ใหม่",
};

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

    const lang =
      owner.locale === "fr" || owner.locale === "id" || owner.locale === "th" ? owner.locale : "en";

    sendMerchantAlert({
      recipientEmail: owner.email,
      recipientExternalId: owner.externalId,
      category: "new-order",
      title: `${NEW_ORDER_TITLE[lang]} — ${data.storeName}`,
      content: `${data.orderNumber} · ${data.customerName} · ${formatCurrency(data.totalAmount, data.currency, "id-ID")}`,
      actionUrl: `/store/${data.storeId}/pos`,
    });

    return { sent: true, orderId: data.orderId };
  }
);
