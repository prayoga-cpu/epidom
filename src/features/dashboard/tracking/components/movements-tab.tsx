"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, ArrowDownCircle, ArrowUpCircle, Minus } from "lucide-react";
import { formatDateTime } from "@/lib/utils/formatting";
import { MovementType } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";

interface Movement {
  id: string;
  type: MovementType;
  quantity: number;
  unit: string;
  notes: string | null;
  createdAt: string;
  material?: { name: string; sku: string | null } | null;
  product?: { name: string; sku: string | null } | null;
  order?: { orderNumber: string } | null;
  productionBatch?: { batchNumber: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  SALE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PRODUCTION: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  ADJUSTMENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  PURCHASE: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  LOSS: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  RETURN: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

function sourceLabel(m: Movement): string {
  if (m.order) return `POS #${m.order.orderNumber}`;
  if (m.productionBatch) return `Batch #${m.productionBatch.batchNumber}`;
  if (m.notes) return m.notes;
  return "—";
}

interface MovementsTabProps {
  storeId: string;
}

export function MovementsTab({ storeId }: MovementsTabProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const params = new URLSearchParams({ take: "50" });
  if (typeFilter !== "ALL") params.set("type", typeFilter);

  const { data, isLoading } = useQuery<{ movements: Movement[]; total: number }>({
    queryKey: ["stock-movements", storeId, "all", typeFilter],
    queryFn: () =>
      fetch(`/api/stores/${storeId}/stock-movements?${params.toString()}`)
        .then((r) => r.json()),
    enabled: !!storeId,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const movements = (data?.movements ?? []).filter((m) => {
    if (!search) return true;
    const name = m.material?.name ?? m.product?.name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
          <Input
            placeholder={t("tracking.movements.searchPlaceholder") || "Search item…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("filters.allTypes") || "All types"}</SelectItem>
            {Object.values(MovementType).map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : movements.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {t("tracking.movements.empty") || "No movements found"}
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {movements.map((m) => {
            const qty = Number(m.quantity);
            const isOut = qty < 0;
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`rounded-full p-1.5 ${isOut ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                  {isOut
                    ? <ArrowDownCircle className="h-4 w-4" />
                    : qty === 0
                    ? <Minus className="h-4 w-4 text-muted-foreground" />
                    : <ArrowUpCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.material?.name ?? m.product?.name ?? "—"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{sourceLabel(m)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`text-sm font-semibold ${isOut ? "text-red-600" : "text-green-600"}`}>
                    {qty > 0 ? "+" : ""}{qty} {m.unit}
                  </span>
                  <Badge className={`text-xs ${TYPE_COLORS[m.type] ?? ""}`}>{m.type}</Badge>
                </div>
                <p className="text-muted-foreground hidden shrink-0 text-xs sm:block">
                  {formatDateTime(m.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
