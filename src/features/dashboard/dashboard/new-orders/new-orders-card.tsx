"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ShoppingBag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePosOrders } from "@/features/pos/hooks/use-pos-orders";

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

const VISIBLE_LIMIT = 5;

interface NewOrdersCardProps {
  storeId: string;
}

/**
 * Highlights orders that still need a payment follow-up (paymentStatus
 * PENDING) — Pay Later tabs and online payments that never confirmed — so an
 * operator sees them without having to go check the Order Queue first. Held
 * carts are excluded: they're parked, unpaid because no payment method has
 * been chosen yet, not because a payment is outstanding. Reuses
 * `usePosOrders`, which already has SSE + polling wired up, so this card
 * updates live as orders come in.
 *
 * Deliberately a plain `Card` (not the shared `h-full`/stretch-grid
 * `DashboardCard`) — this renders as a standalone full-width banner, not a
 * tile in a stretched grid row, so it should just size to its own content.
 */
export function NewOrdersCard({ storeId }: NewOrdersCardProps) {
  const { t, formatRelativeTime } = useI18n();
  // order.total is already literal in the owner's own currency, not IDR.
  // Bare formatPrice() defaults to converting from IDR, which would wrongly
  // re-scale it by the exchange rate for any non-IDR store.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const { data: orders, isLoading, isError } = usePosOrders(storeId);

  const pendingOrders = useMemo(
    () =>
      (orders ?? [])
        .filter((o) => o.paymentStatus === "PENDING" && o.status !== "HELD")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const storefrontCount = useMemo(
    () => pendingOrders.filter((o) => o.source === "STOREFRONT").length,
    [pendingOrders]
  );

  const hasPending = pendingOrders.length > 0;
  const hiddenCount = pendingOrders.length - VISIBLE_LIMIT;

  const description = isLoading
    ? undefined
    : isError
      ? t("dashboard.newOrders.errorDescription")
      : !hasPending
        ? t("dashboard.newOrders.description")
        : storefrontCount > 0
          ? t("dashboard.newOrders.pendingWithStorefront")
              .replace("{count}", String(pendingOrders.length))
              .replace("{storefrontCount}", String(storefrontCount))
          : t("dashboard.newOrders.pendingCount").replace("{count}", String(pendingOrders.length));

  return (
    <Card
      className={
        hasPending
          ? "border-amber-400/70 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-500/5"
          : undefined
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{t("dashboard.newOrders.title")}</CardTitle>
              {hasPending && (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                  {pendingOrders.length}
                </Badge>
              )}
            </div>
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
          <Link href={`/store/${storeId}/pos/orders`} className="shrink-0">
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              {t("dashboard.newOrders.viewQueue")}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center">
            <AlertCircle className="h-6 w-6" />
            <p className="text-sm">{t("dashboard.newOrders.errorBody")}</p>
          </div>
        ) : !hasPending ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="bg-muted rounded-full p-3">
              <ShoppingBag className="text-muted-foreground h-6 w-6" />
            </div>
            <p className="text-muted-foreground text-sm">{t("dashboard.newOrders.empty")}</p>
          </div>
        ) : (
          <div className="divide-border divide-y">
            {pendingOrders.slice(0, VISIBLE_LIMIT).map((order) => (
              <Link
                key={order.id}
                href={`/store/${storeId}/pos/orders`}
                className="hover:bg-muted/40 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition-colors"
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
            {hiddenCount > 0 && (
              <Link
                href={`/store/${storeId}/pos/orders`}
                className="text-muted-foreground hover:text-foreground block py-2 text-center text-xs font-medium transition-colors"
              >
                {t("dashboard.newOrders.andMore").replace("{count}", String(hiddenCount))}
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
