"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { StorefrontControls } from "@/features/storefront/components/storefront-controls";
import { readLocalOrders, writeLocalOrders, type LocalOrderRef } from "../lib/local-orders";
import { STATUS_CONFIG, type OrderStatus } from "../lib/order-status-config";

interface MyOrdersClientProps {
  storefront: {
    slug: string;
    displayName: string;
    themeColor: string;
  };
}

interface ServerOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  currency: string;
  createdAt: string;
  itemsSummary: string;
}

export function MyOrdersClient({ storefront }: MyOrdersClientProps) {
  const { t } = useI18n();
  const [refs, setRefs] = useState<LocalOrderRef[]>([]);
  const [hasReadLocalRefs, setHasReadLocalRefs] = useState(false);

  const themeStyle = {
    "--store-theme": storefront.themeColor,
  } as React.CSSProperties;

  const formatPrice = (amount: number, currency: string = "IDR") =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  // Read the locally-remembered order refs once on mount (client-only, not
  // derivable from props/SSR).
  useEffect(() => {
    setRefs(readLocalOrders(storefront.slug));
    setHasReadLocalRefs(true);
  }, [storefront.slug]);

  const orderIds = useMemo(() => refs.slice(0, 20).map((r) => r.orderId), [refs]);

  // A customer revisiting this list wants to see status changes without a
  // manual reload — inherits the app's default 30s staleTime + refetch-on-
  // focus/reconnect (see query-provider.tsx) rather than active polling: this
  // is a glance-at-history view, the individual order page (which does poll
  // every 2s) is where a customer actually watches a live order.
  const { data: lookupOrders, isLoading: isLookupLoading } = useQuery({
    queryKey: ["public-orders-lookup", storefront.slug, orderIds],
    queryFn: async () => {
      const res = await fetch("/api/public/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontSlug: storefront.slug, orderIds }),
      });
      if (!res.ok) throw new Error("Failed to look up orders");
      const data = await res.json();
      return (data?.data?.orders ?? []) as ServerOrderSummary[];
    },
    enabled: orderIds.length > 0,
  });

  const serverOrders = useMemo(() => {
    const byId: Record<string, ServerOrderSummary> = {};
    (lookupOrders ?? []).forEach((o) => {
      byId[o.id] = o;
    });
    return byId;
  }, [lookupOrders]);

  // Prune refs the server no longer knows about (e.g. order was removed).
  useEffect(() => {
    if (!lookupOrders) return;
    const known = new Set(lookupOrders.map((o) => o.id));
    setRefs((current) => {
      const pruned = current.filter((r) => known.has(r.orderId));
      if (pruned.length !== current.length) {
        writeLocalOrders(storefront.slug, pruned);
        return pruned;
      }
      return current;
    });
  }, [lookupOrders, storefront.slug]);

  const isLoading = !hasReadLocalRefs || (orderIds.length > 0 && isLookupLoading);

  return (
    <div className="bg-muted flex min-h-screen flex-col" style={themeStyle}>
      {/* Header */}
      <header className="bg-card sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 shadow-sm">
        <Link href={`/@${storefront.slug}`} className="hover:bg-muted rounded-full p-1 transition">
          <ArrowLeft className="text-foreground size-5" />
        </Link>
        <h1 className="text-foreground flex-1 truncate text-base font-bold">
          {t("publicOrder.myOrders.title")}
        </h1>
        <StorefrontControls />
      </header>

      <div className="mx-auto w-full max-w-lg space-y-3 px-4 py-6">
        {refs.length === 0
          ? !isLoading && (
              <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center">
                <ReceiptText className="text-muted-foreground size-10 stroke-1" />
                <div>
                  <h2 className="text-foreground font-bold">{t("publicOrder.myOrders.empty")}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("publicOrder.myOrders.emptyDesc")}
                  </p>
                </div>
                <Link href={`/@${storefront.slug}/menu`} className="block w-full">
                  <Button
                    className="w-full py-3 text-white"
                    style={{ backgroundColor: "var(--store-theme)" }}
                  >
                    {t("publicOrder.myOrders.browseMenu")}
                  </Button>
                </Link>
              </div>
            )
          : refs.map((ref) => {
              const server = serverOrders[ref.orderId];
              return (
                <Link
                  key={ref.orderId}
                  href={`/@${storefront.slug}/order/${ref.orderId}`}
                  className="bg-card block rounded-xl border p-4 shadow-sm transition hover:shadow"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground font-mono text-sm">
                      {server?.orderNumber ?? ref.orderNumber}
                    </span>
                    {server ? (
                      <span
                        className={`bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[server.status].color}`}
                      >
                        {t("publicOrder.orderStatus." + server.status)}
                      </span>
                    ) : (
                      <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                        {t("publicOrder.myOrders.statusUnavailable")}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs" suppressHydrationWarning>
                    {formatDate(server?.createdAt ?? ref.createdAt)}
                  </p>
                  {server?.itemsSummary && (
                    <p className="text-muted-foreground mt-2 truncate text-sm">
                      {server.itemsSummary}
                    </p>
                  )}
                  <p className="text-foreground mt-2 text-sm font-bold">
                    {formatPrice(server?.total ?? ref.total, server?.currency)}
                  </p>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
