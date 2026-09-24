"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, MapPin, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/use-confirm";
import { useI18n } from "@/components/lang/i18n-provider";
import { useStores, type Store } from "@/features/stores/stores/hooks/use-stores";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { cn } from "@/lib/utils";

interface PosModeStoreSwitcherProps {
  storeId: string;
  /** Called just before navigating, so the More menu can close itself. */
  onNavigate: () => void;
}

/** Where a store opens in POS Mode, or null when this account has nowhere to go there. */
function posDestination(store: Store): string | null {
  // A linked staff account opens the page its role can reach. A role with no
  // POS page has none — the /stores card says so rather than linking anywhere.
  if (store.accessRole === "staff") return store.staffHomePath ?? null;
  return `/store/${store.id}/pos`;
}

/**
 * Store switcher for the POS Mode More menu — the Back Office Topbar's
 * StoreSwitcher, rebuilt for this surface rather than reused:
 *   - it opens the other store's POS, not its Back Office landing page;
 *   - it expands inline instead of in a Popover, which would stack a second
 *     layer (and a search box, and the soft keyboard with it) on top of this
 *     already-scrolling dialog;
 *   - it guards the cart, see handleSelect.
 *
 * The caller decides who may see this. A restricted staff PIN persona is
 * scoped to the store it logged into, so the menu never mounts it for one.
 */
export function PosModeStoreSwitcher({ storeId, onNavigate }: PosModeStoreSwitcherProps) {
  const { t } = useI18n();
  const router = useRouter();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const { data: stores, isLoading } = useStores();
  const cartLineCount = usePosCart((state) => state.items.length);
  const clearCart = usePosCart((state) => state.clearCart);
  const { confirm, confirmDialog } = useConfirm();

  if (isLoading) return <Skeleton className="h-11 w-full rounded-md" />;
  // Nothing to show on a failed load — "Back to Stores" below is still there.
  if (!stores || stores.length === 0) return null;

  const current = stores.find((store) => store.id === storeId);
  const label = t("dashboard.storeSelector.label");

  const handleSelect = async (store: Store) => {
    const href = posDestination(store);
    if (!href) return;
    if (store.id === storeId) {
      setExpanded(false);
      return;
    }
    // The cart lives in localStorage with no store on it, so it would follow
    // the cashier into the other store: lines that don't exist on that menu,
    // priced for this one. Never drop a sale silently — ask first.
    if (cartLineCount > 0) {
      const ok = await confirm({
        title: t("pos.switchStore.confirmTitle"),
        description: t("pos.switchStore.confirmDesc").replace("{store}", store.name),
        confirmText: t("pos.switchStore.confirmAction"),
        variant: "destructive",
        // This switcher lives in the More sheet (z-[70]). A z-50 confirm would
        // open under the sheet's backdrop and freeze the till.
        layerClassName: "z-[80]",
      });
      if (!ok) return;
      clearCart();
    }
    onNavigate();
    router.push(href);
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="h-11 w-full justify-between gap-2"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-label={current ? `${label}: ${current.name}` : label}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <StoreIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{current?.name ?? label}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </Button>

      {expanded && (
        <div id={listId} className="rounded-xl border p-1">
          <p className="text-muted-foreground px-2 pt-1 pb-1.5 text-xs font-medium tracking-wide uppercase">
            {t("dashboard.storeSelector.yourStores")}
          </p>
          {/* Capped and scrolling, not growing: a long list would otherwise
              push Log Out off the bottom of an already-tall menu. */}
          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {stores.map((store) => {
              const isCurrent = store.id === storeId;
              const unreachable = posDestination(store) === null;
              return (
                <li key={store.id}>
                  <button
                    type="button"
                    disabled={unreachable}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => void handleSelect(store)}
                    className="hover:bg-accent flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Check
                      className={cn("size-4 shrink-0", isCurrent ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{store.name}</span>
                      {store.city && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <MapPin className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{store.city}</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
