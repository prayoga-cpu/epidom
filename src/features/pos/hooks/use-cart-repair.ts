import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { repairCartItems, unavailableLinesFromError, type CartRepair } from "../lib/cart-repair";
import type { PosMenuCategory } from "../types/pos.types";
import { usePosCart } from "./use-pos-cart";
import { fetchPosMenu, posMenuKey, type PosMenuData } from "./use-pos-menu";

/**
 * Handles a checkout / Save Bill the server refused because lines in the cart
 * are no longer on the menu: fetches the current menu, repairs the cart
 * (lib/cart-repair.ts) and tells the cashier what changed.
 *
 * Returns the repair when `error` was that refusal, and null for any other
 * failure so the caller keeps its own handling. It never re-submits by itself:
 * a removed line or a new price changes the total the customer was quoted, so
 * the cashier confirms the amount and presses the button again.
 */
export function useCartRepair(storeId: string) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useCallback(
    async (error: unknown): Promise<CartRepair | null> => {
      const unavailable = unavailableLinesFromError(error);
      if (!unavailable) return null;

      // The menu on screen is the one that let the stale line through, so ask
      // again. If that fails (the connection dropped between the two calls)
      // the cached copy still tells available items apart; the refused ids are
      // excluded from it either way.
      let menu: PosMenuCategory[];
      try {
        const fresh = await queryClient.fetchQuery({
          queryKey: posMenuKey(storeId),
          queryFn: () => fetchPosMenu(storeId),
          staleTime: 0,
        });
        menu = fresh.categories;
      } catch {
        menu = queryClient.getQueryData<PosMenuData>(posMenuKey(storeId))?.categories ?? [];
      }

      const repair = repairCartItems(usePosCart.getState().items, unavailable, menu);
      usePosCart.getState().replaceItems(repair.items);

      if (repair.items.length === 0) {
        toast.warning(t("pos.checkout.cartRepaired.title"), {
          description: t("pos.checkout.cartRepaired.emptied"),
          duration: 10_000,
        });
        return repair;
      }

      const lines = [
        repair.removed.length > 0 &&
          t("pos.checkout.cartRepaired.removed").replace("{names}", repair.removed.join(", ")),
        repair.relinked.length > 0 &&
          t("pos.checkout.cartRepaired.relinked").replace(
            "{names}",
            repair.relinked.map((line) => line.name).join(", ")
          ),
        t("pos.checkout.cartRepaired.review"),
      ].filter(Boolean);

      toast.warning(t("pos.checkout.cartRepaired.title"), {
        description: lines.join(" "),
        duration: 10_000,
      });
      return repair;
    },
    [queryClient, storeId, t]
  );
}
