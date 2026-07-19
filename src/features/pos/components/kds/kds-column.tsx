"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { KdsOrderCard } from "./kds-order-card";
import type { PosOrderDisplay } from "../../types/pos.types";

interface KdsColumnProps {
  title: string;
  orders: PosOrderDisplay[];
  storeId: string;
  emptyLabel?: string;
}

export function KdsColumn({ title, orders, storeId, emptyLabel }: KdsColumnProps) {
  const { t } = useI18n();

  return (
    <div className="flex max-w-sm min-w-[300px] flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <span className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
          {orders.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto pb-4">
        {orders.length === 0 ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center rounded-xl border border-dashed text-sm">
            {emptyLabel ?? t("pos.kds.emptyDefault")}
          </div>
        ) : (
          orders.map((order) => <KdsOrderCard key={order.id} order={order} storeId={storeId} />)
        )}
      </div>
    </div>
  );
}
