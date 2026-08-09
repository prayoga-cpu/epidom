"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { buildReceiptWhatsAppMessage } from "@/lib/receipts/receipt-labels";
import { useStore } from "@/features/stores/stores/hooks/use-stores";
import { useUpdateOrderCustomerPhone } from "../hooks/use-update-order-customer";

interface SendReceiptWhatsAppProps {
  storeId: string;
  orderId: string;
  customerName: string;
  customerPhone?: string | null;
  total: number;
  currency: string;
  orderDate: Date | string;
  className?: string;
}

/**
 * Manual "open WhatsApp with the receipt link prefilled" action — a
 * zero-configuration alternative to the Fonnte auto-send button (which
 * requires a Fonnte account and only shows up once a phone is already on
 * file). Works for any order: lets the cashier type in a phone number right
 * here when the order has none, persists it, then hands off to
 * wa.me — the cashier still taps Send inside WhatsApp themselves.
 */
export function SendReceiptWhatsApp({
  storeId,
  orderId,
  customerName,
  customerPhone,
  total,
  currency,
  orderDate,
  className,
}: SendReceiptWhatsAppProps) {
  const { t, locale } = useI18n();
  const [phone, setPhone] = useState(customerPhone ?? "");
  const updatePhone = useUpdateOrderCustomerPhone(storeId);
  // Same store the dashboard shell already has cached (react-query dedupes
  // this against that fetch) — just need `.name` for the message.
  const { data: store } = useStore(storeId);

  const handleSend = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      toast.error(t("pos.history.whatsappPhoneRequired"));
      return;
    }

    if (trimmed !== (customerPhone ?? "")) {
      try {
        await updatePhone.mutateAsync({ orderId, customerPhone: trimmed });
      } catch {
        // Non-blocking — the number still works for messaging even if we
        // couldn't save it back to the order, so proceed to open WhatsApp
        // rather than stranding the cashier over a persistence failure.
        toast.error(t("pos.history.whatsappPhoneSaveFailed"));
      }
    }

    const receiptUrl = `${window.location.origin}/r/${orderId}`;
    const message = buildReceiptWhatsAppMessage({
      customerName: customerName || t("pos.history.whatsappGuestFallback"),
      storeName: store?.name ?? "",
      total,
      currency,
      orderDate: typeof orderDate === "string" ? new Date(orderDate) : orderDate,
      receiptUrl,
      locale,
    });
    window.open(buildWhatsAppLink(trimmed, message), "_blank", "noopener,noreferrer");
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <PhoneInput
        value={phone}
        onChange={(value) => setPhone(value ?? "")}
        defaultCountry="ID"
        placeholder={t("pos.history.whatsappPhonePlaceholder")}
        className="w-48"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        disabled={updatePhone.isPending}
        onClick={handleSend}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {t("pos.history.sendWhatsappLink")}
      </Button>
    </div>
  );
}
