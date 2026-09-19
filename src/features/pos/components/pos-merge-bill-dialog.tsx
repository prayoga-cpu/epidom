"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckSquare, Info, Loader2, Search, Square } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { usePosCart } from "../hooks/use-pos-cart";
import { usePosOrdersSnapshot } from "../hooks/use-pos-orders-snapshot";
import { cartToHoldInput, useHoldOrder } from "../hooks/use-hold-order";
import { useMergeOrders } from "../hooks/use-merge-orders";
import { resumeOrderIntoCart } from "../hooks/use-resume-order";
import type { ResumableOrder } from "../lib/order-to-cart";
import type { PosOrderDisplay } from "../types/pos.types";

interface PosMergeBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  shiftId?: string;
}

/** Case-insensitive match on bill number, customer name or table — what a
 * cashier calling out "table A1" or "Budi's bill" would type. */
export function matchesMergeQuery(order: PosOrderDisplay, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [order.orderNumber, order.customerName, order.tableNumber, order.tableLabel].some((v) =>
    v?.toLowerCase().includes(q)
  );
}

/**
 * Merge saved (HELD) bills into the current one — Luna's "Merge Bill".
 *
 * The merge target is the bill on screen:
 *  - a cart with lines is saved first (creating the bill, or refreshing the one
 *    being resumed) so the server merges exactly what the cashier sees, then the
 *    ticked bills fold into it;
 *  - an EMPTY cart has no bill of its own, so the first ticked bill becomes the
 *    target and the rest fold into it.
 * After the merge the cart is reloaded from the merged order through the same
 * resume path a queue "Resume" uses, so what's on screen is what was persisted.
 *
 * HELD ↔ HELD only: merged-in bills are cancelled ("Merged into #X") and their
 * discounts are dropped — the dialog says so up front, because it can't be undone.
 */
export function PosMergeBillDialog({
  open,
  onOpenChange,
  storeId,
  shiftId,
}: PosMergeBillDialogProps) {
  const { t } = useI18n();
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const { data: orders, isLoading } = usePosOrdersSnapshot(storeId);
  const resumingOrderId = usePosCart((s) => s.resumingOrderId);
  const cartHasItems = usePosCart((s) => s.items.length > 0);
  const holdOrder = useHoldOrder(storeId);
  const mergeOrders = useMergeOrders(storeId);

  const [query, setQuery] = useState("");
  // A Set keeps the order the cashier ticked in — that order decides the target
  // when the cart is empty ("the first ticked bill").
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const held = useMemo(
    () => (orders ?? []).filter((o) => o.status === "HELD" && o.id !== resumingOrderId),
    [orders, resumingOrderId]
  );
  const visible = held.filter((o) => matchesMergeQuery(o, query));

  const reset = () => {
    setQuery("");
    setSelected([]);
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Merging needs at least two bills in play: the cart's plus one ticked, or
  // (empty cart) two ticked.
  const needed = cartHasItems ? 1 : 2;
  const participants = selected.length + (cartHasItems ? 1 : 0);
  const canMerge = selected.length >= needed && !busy;

  const handleMerge = async () => {
    if (!canMerge) return;
    setBusy(true);
    try {
      let targetId: string;
      let sourceIds: string[];

      if (cartHasItems) {
        // Save first so the target row holds what's on screen. From here on the
        // cart IS that bill: stamp its id immediately, so a merge failure below
        // can't lead to a second Save Bill creating a duplicate.
        const cart = usePosCart.getState();
        const saved = await holdOrder.mutateAsync(cartToHoldInput(cart, { shiftId }));
        cart.setResumingOrderId(saved.orderId);
        targetId = saved.orderId;
        sourceIds = selected;
      } else {
        [targetId, ...sourceIds] = selected;
      }

      const merged = await mergeOrders.mutateAsync({
        targetOrderId: targetId,
        sourceOrderIds: sourceIds,
      });

      const order = await apiClient.get<ResumableOrder>(
        `/stores/${storeId}/pos/orders/${merged.orderId}`
      );
      await resumeOrderIntoCart(storeId, order);

      toast.success(
        t("cashierCart.mergeDialog.success")
          .replace("{count}", String(merged.mergedCount))
          .replace("{number}", merged.orderNumber)
      );
      reset();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof ApiClientError ? error.response.error.message : null;
      toast.error(message || t("cashierCart.mergeDialog.failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (busy) return; // don't drop a half-finished merge on the floor
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FormDialogLayout
        title={t("cashierCart.mergeDialog.title")}
        maxWidth="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 touch-manipulation"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              className="h-11 touch-manipulation"
              disabled={!canMerge}
              onClick={handleMerge}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("cashierCart.mergeDialog.merge").replace("{count}", String(participants))}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {t(
                cartHasItems
                  ? "cashierCart.mergeDialog.intoCurrent"
                  : "cashierCart.mergeDialog.intoFirst"
              )}{" "}
              {t("cashierCart.mergeDialog.discountsDropped")}
            </span>
          </p>

          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              type="search"
              className="h-11 pl-9"
              placeholder={t("cashierCart.mergeDialog.searchPlaceholder")}
              aria-label={t("cashierCart.mergeDialog.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("cashierCart.customer.searching")}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t(
                held.length === 0
                  ? "cashierCart.mergeDialog.none"
                  : "cashierCart.mergeDialog.noMatch"
              )}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visible.map((order) => {
                const checked = selected.includes(order.id);
                const lineCount = order.items.reduce((sum, i) => sum + Number(i.quantity), 0);
                const who =
                  order.customerName && order.customerName !== "Walk-in"
                    ? order.customerName
                    : null;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(order.id)}
                      className={cn(
                        "flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-accent"
                      )}
                    >
                      {checked ? (
                        <CheckSquare className="text-primary h-5 w-5 shrink-0" />
                      ) : (
                        <Square className="text-muted-foreground h-5 w-5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {order.orderNumber}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {[
                            who,
                            order.tableNumber
                              ? t("cashierCart.header.tableShort").replace(
                                  "{table}",
                                  order.tableNumber
                                )
                              : null,
                            t("cashierCart.mergeDialog.itemCount").replace(
                              "{count}",
                              String(lineCount)
                            ),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatPrice(order.total)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
