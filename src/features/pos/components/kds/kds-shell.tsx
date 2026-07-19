"use client";

import { usePosOrders } from "../../hooks/use-pos-orders";
import { KdsColumn } from "./kds-column";
import { Skeleton } from "@/components/ui/skeleton";
import { ChefHat } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import type { PosOrderDisplay } from "../../types/pos.types";

interface KdsShellProps {
  storeId: string;
}

export function KdsShell({ storeId }: KdsShellProps) {
  const { t } = useI18n();
  const { data: orders, isLoading } = usePosOrders(storeId);

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex min-w-[300px] flex-col gap-3">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const activeOrders = (orders ?? []) as PosOrderDisplay[];

  const preparing = activeOrders.filter(
    (o) => o.status === "PENDING" || o.status === "CONFIRMED" || o.status === "IN_PRODUCTION"
  );
  const ready = activeOrders.filter((o) => o.status === "READY");

  if (activeOrders.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="bg-muted rounded-full p-6">
          <ChefHat className="h-10 w-10 opacity-40" />
        </div>
        <p className="text-foreground text-lg font-medium">{t("pos.kds.allDone")}</p>
        <p className="text-sm">{t("pos.kds.noActiveOrders")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      <KdsColumn
        title={t("pos.kds.processingColumn")}
        orders={preparing}
        storeId={storeId}
        emptyLabel={t("pos.kds.emptyProcessing")}
      />
      <KdsColumn
        title={t("pos.kds.readyColumn")}
        orders={ready}
        storeId={storeId}
        emptyLabel={t("pos.kds.emptyReady")}
      />
    </div>
  );
}
