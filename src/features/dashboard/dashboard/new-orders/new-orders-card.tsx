"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePosOrders } from "@/features/pos/hooks/use-pos-orders";
import { formatRelativeTime } from "@/lib/utils/format-date";
import { DashboardCard } from "../components/dashboard-card";

// Not translated, matching the existing SOURCE_LABELS precedent in
// src/app/api/stores/[id]/finance/channels/route.ts.
const SOURCE_LABELS: Record<string, string> = {
  STOREFRONT: "Storefront",
  POS: "POS",
  MANUAL: "Manual",
  GOFOOD: "GoFood",
  GRABFOOD: "GrabFood",
  SHOPEEFOOD: "ShopeeFood",
  TOKOPEDIA: "Tokopedia",
};

interface NewOrdersCardProps {
  storeId: string;
}

/**
 * Highlights orders awaiting confirmation — mainly the ones a customer just
 * placed through the storefront — so an operator sees them without having
 * to go check the Order Queue first. Reuses `usePosOrders`, which already
 * has SSE + polling wired up, so this card updates live as orders come in.
 */
export function NewOrdersCard({ storeId }: NewOrdersCardProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { data: orders, isLoading } = usePosOrders(storeId);

  const pendingOrders = useMemo(
    () =>
      (orders ?? [])
        .filter((o) => o.status === "PENDING")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const storefrontCount = useMemo(
    () => pendingOrders.filter((o) => o.source === "STOREFRONT").length,
    [pendingOrders]
  );

  const hasPending = pendingOrders.length > 0;

  const cardContent = (
    <div className="flex min-h-[220px] flex-1 flex-col">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      ) : !hasPending ? (
        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <ShoppingBag className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-muted-foreground text-sm">{t("dashboard.newOrders.empty")}</p>
        </div>
      ) : (
        <div className="divide-border flex-1 divide-y overflow-y-auto">
          {pendingOrders.slice(0, 5).map((order) => (
            <Link
              key={order.id}
              href={`/store/${storeId}/pos/orders`}
              className="hover:bg-muted/30 -mx-1 flex items-center justify-between gap-3 rounded-md px-1 py-2.5 text-sm transition-colors"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{order.customerName || order.orderNumber}</p>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">
                    {SOURCE_LABELS[order.source] ?? order.source}
                  </Badge>
                  <span>{formatRelativeTime(order.createdAt)}</span>
                </div>
              </div>
              <span className="shrink-0 font-semibold">{formatPrice(order.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const cardOther = (
    <Link href={`/store/${storeId}/pos/orders`}>
      <Button variant="ghost" size="sm" className="h-8 gap-1">
        {t("dashboard.newOrders.viewQueue")}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  const description = !hasPending
    ? t("dashboard.newOrders.description")
    : storefrontCount > 0
      ? t("dashboard.newOrders.pendingWithStorefront")
          .replace("{count}", String(pendingOrders.length))
          .replace("{storefrontCount}", String(storefrontCount))
      : t("dashboard.newOrders.pendingCount").replace("{count}", String(pendingOrders.length));

  return (
    <DashboardCard
      cardTitle={t("dashboard.newOrders.title")}
      cardDescription={description}
      cardOther={cardOther}
      cardContent={cardContent}
      cardClassName={hasPending ? "border-amber-400/70 dark:border-amber-500/50" : undefined}
    />
  );
}
