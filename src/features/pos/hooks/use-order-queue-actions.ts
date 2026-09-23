"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useConfirm } from "@/components/ui/use-confirm";
import { usePosCart } from "./use-pos-cart";
import { useResumeOrderIntoCart } from "./use-resume-order";
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
  const resumeIntoCart = useResumeOrderIntoCart(storeId);

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

    // Lines, order type, pax, table, customer and the held discount all come
    // back together — see resumeOrderIntoCart for what is restored and why.
    await resumeIntoCart(order);
    toast.success(t("pos.orderCard.resumeSuccess"));
    router.push(`/store/${storeId}/pos`);
  };

  return { handleCancel, handleResume, confirmDialog };
}
