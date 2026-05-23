"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { usePosOrders } from "../hooks/use-pos-orders";
import { PosOrderCard } from "./pos-order-card";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { UtensilsCrossed } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface PosOrderQueueProps {
  storeId: string;
}

export function PosOrderQueue({ storeId }: PosOrderQueueProps) {
  const { t } = useI18n();
  const { data: orders, isLoading } = usePosOrders(storeId);
  const queryClient = useQueryClient();

  const handleUpdateStatus = async (orderId: string, status: string) => {
    // Optimistic update
    queryClient.setQueryData(["pos", "orders", storeId], (oldData: any[]) => {
      if (!oldData) return [];
      // If completed, remove from active queue
      if (status === "DELIVERED" || status === "CANCELLED") {
        return oldData.filter((o) => o.id !== orderId);
      }
      return oldData.map((o) => (o.id === orderId ? { ...o, status } : o));
    });

    try {
      await apiClient.patch(`/stores/${storeId}/pos/orders/${orderId}`, { status });
    } catch (error) {
      toast.error(t("pos.queue.updateFailed"));
      // Revert will happen automatically on next SSE poll
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center text-muted-foreground">
        <div className="mb-4 rounded-full bg-muted p-6">
          <UtensilsCrossed className="h-10 w-10 opacity-50" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-foreground">
          {t("pos.queue.empty")}
        </h3>
        <p>{t("pos.queue.emptyDesc")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start content-start">
      {orders.map((order: any) => (
        <PosOrderCard 
          key={order.id} 
          order={order} 
          onUpdateStatus={handleUpdateStatus} 
        />
      ))}
    </div>
  );
}
