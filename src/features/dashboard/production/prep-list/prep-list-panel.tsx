"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChefHat, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePrepList, useQuickLogProduction, type PrepListItem } from "./hooks/use-prep-list";

interface PrepListPanelProps {
  storeId: string;
}

/**
 * "Today's prep" — the operational half of the two-tier stock model.
 *
 * A batch-produced item only stays in stock if somebody actually prepares it,
 * and the existing four-field start/complete flow is exactly the friction that
 * stops people logging prep at all. One row, one number, one tap.
 */
export function PrepListPanel({ storeId }: PrepListPanelProps) {
  const { t } = useI18n();
  const { data, isLoading } = usePrepList(storeId);
  const quickLog = useQuickLogProduction(storeId);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const items = data?.items ?? [];

  const handleLog = async (item: PrepListItem) => {
    const typed = amounts[item.productId];
    const quantity = typed !== undefined && typed !== "" ? Number(typed) : item.suggested;
    if (!(quantity > 0)) return;

    setPendingId(item.productId);
    try {
      const result = await quickLog.mutateAsync({ productId: item.productId, quantity });
      // Never silently credit less stock than the number the user typed — if
      // part of this run had already been sold, say so.
      if (result.settledQuantity > 0) {
        toast.success(
          t("production.prepList.loggedWithSettlement")
            .replace("{count}", String(quantity))
            .replace("{name}", item.name)
            .replace("{settled}", String(result.settledQuantity))
        );
      } else {
        toast.success(
          t("production.prepList.logged")
            .replace("{count}", String(quantity))
            .replace("{name}", item.name)
        );
      }
      setAmounts((prev) => ({ ...prev, [item.productId]: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("production.prepList.logFailed"));
    } finally {
      setPendingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ChefHat className="h-4 w-4 shrink-0" />
          {t("production.prepList.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-6">
        {items.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t("production.prepList.allStocked")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const isPending = pendingId === item.productId;
              const value = amounts[item.productId] ?? String(item.suggested);
              return (
                <li
                  key={item.productId}
                  className="border-border flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{item.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {item.recipeName}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                      {t("production.prepList.onHand")
                        .replace("{count}", String(item.currentStock))
                        .replace("{par}", String(item.parLevel))
                        .replace("{unit}", item.unit)}
                    </p>
                    {item.outstandingShortfall > 0 && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t("production.prepList.alreadySold").replace(
                          "{count}",
                          String(item.outstandingShortfall)
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={value}
                      onChange={(e) =>
                        setAmounts((prev) => ({ ...prev, [item.productId]: e.target.value }))
                      }
                      aria-label={t("production.prepList.quantityLabel").replace(
                        "{name}",
                        item.name
                      )}
                      className="h-11 w-24 tabular-nums"
                    />
                    {/* flex-1, never w-full: w-full ignores the sibling input
                        and overflows the row by exactly its width. */}
                    <Button
                      onClick={() => handleLog(item)}
                      disabled={isPending}
                      className="h-11 flex-1 sm:flex-none"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">{t("production.prepList.madeIt")}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
