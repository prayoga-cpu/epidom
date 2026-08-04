"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useConfirm } from "@/components/ui/use-confirm";
import { usePosCart } from "./use-pos-cart";
import { toast } from "sonner";
import type { PosOrderDisplay } from "../types/pos.types";

export function useOrderQueueActions(
  order: PosOrderDisplay,
  storeId: string,
  onUpdateStatus: (orderId: string, status: string) => void
) {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirm();
  const router = useRouter();
  const cart = usePosCart();

  const handleCancel = async () => {
    const ok = await confirm({
      title: t("pos.orderCard.cancelConfirmTitle"),
      description: t("pos.orderCard.cancelConfirmDesc"),
      confirmText: t("pos.orderCard.cancel"),
      variant: "destructive",
    });
    if (ok) onUpdateStatus(order.id, "CANCELLED");
  };

  const handleResume = async () => {
    if (cart.items.length > 0) {
      const ok = await confirm({
        title: t("pos.orderCard.resumeConfirmTitle"),
        description: t("pos.orderCard.resumeConfirmDesc"),
        confirmText: t("pos.orderCard.resume"),
      });
      if (!ok) return;
    }

    const mapped = order.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId ?? "",
      name: item.menuItem?.name ?? item.name,
      // Number(...) defensively: these should already be plain numbers from
      // the API, but a Prisma Decimal that slips through unconverted
      // serializes as a *string*, which would silently turn every total
      // calculation downstream into string concatenation instead of addition.
      unitPrice: Number(item.unitPrice),
      quantity: Number(item.quantity),
      modifiers: item.selectedOptions ?? [],
      notes: item.notes ?? undefined,
      lineTotal: Number(item.total),
    }));

    cart.hydrateFromOrder(mapped, order.id);
    toast.success(t("pos.orderCard.resumeSuccess"));
    router.push(`/store/${storeId}/pos`);
  };

  return { handleCancel, handleResume, confirmDialog };
}
