"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/lang/i18n-provider";
import { Activity, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils/formatting";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { MovementType } from "@prisma/client";

interface Movement {
  id: string;
  type: MovementType;
  quantity: number;
  unit: string;
  notes: string | null;
  createdAt: string;
  material?: { name: string } | null;
  product?: { name: string } | null;
  order?: { orderNumber: string } | null;
  productionBatch?: { batchNumber: string } | null;
}

const TYPE_COLORS: Partial<Record<MovementType, string>> = {
  SALE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PRODUCTION: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  ADJUSTMENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  PURCHASE: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};

function sourceLabel(m: Movement): string {
  if (m.order) return `POS #${m.order.orderNumber}`;
  if (m.productionBatch) return `Batch #${m.productionBatch.batchNumber}`;
  if (m.notes) return m.notes;
  return "—";
}

export function RecentMovementsCard() {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  const { data, isLoading } = useQuery<{ movements: Movement[] }>({
    queryKey: ["stock-movements", storeId, "dashboard", 8],
    queryFn: () =>
      fetch(`/api/stores/${storeId}/stock-movements?take=8`)
        .then((r) => r.json()),
    enabled: !!storeId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const movements = data?.movements ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4" />
          {t("dashboard.recentMovements.title") || "Recent Movements"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted h-10 animate-pulse rounded-md" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t("dashboard.recentMovements.empty") || "No movements yet"}
          </p>
        ) : (
          movements.map((m) => {
            const qty = Number(m.quantity);
            const isOut = qty < 0;
            return (
              <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                <div className={`rounded-full p-1 ${isOut ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                  {isOut
                    ? <ArrowDownCircle className="h-3.5 w-3.5" />
                    : <ArrowUpCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {m.material?.name ?? m.product?.name ?? "—"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{sourceLabel(m)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className={`text-xs font-semibold ${isOut ? "text-red-600" : "text-green-600"}`}>
                    {qty > 0 ? "+" : ""}{qty} {m.unit}
                  </span>
                  <Badge className={`text-[10px] px-1 py-0 ${TYPE_COLORS[m.type] ?? ""}`}>{m.type}</Badge>
                </div>
                <p className="text-muted-foreground hidden w-24 shrink-0 text-right text-xs sm:block">
                  {formatDateTime(m.createdAt)}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
