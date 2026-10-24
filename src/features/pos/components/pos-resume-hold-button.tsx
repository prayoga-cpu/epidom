"use client";

import { ChevronDown, Play } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePosCart, type HeldSale } from "../hooks/use-pos-cart";

interface PosResumeHoldButtonProps {
  storeId: string;
  /** This store's held sales, oldest first (non-empty — the header only renders this then). */
  held: HeldSale[];
}

/** What a held sale is called in the list: who it is for, else its table, else its lines. */
function heldSaleTitle(sale: HeldSale, tableLabel: (table: string) => string): string {
  const { customer, tableNumber, items } = sale.cart;
  if (customer?.name) return customer.name;
  if (tableNumber.trim()) return tableLabel(tableNumber.trim());
  const more = items.length - 1;
  return more > 0 ? `${items[0]?.name ?? ""} +${more}` : (items[0]?.name ?? "");
}

/**
 * The cart header's "Resume hold", standing in for the Order Queue link while
 * this till has sales set aside with Hold (see usePosCart.heldSales).
 *
 * One held sale comes straight back on a tap. With more than one, the tap
 * opens the list, newest first, since "the last one" is rarely the customer
 * who just came back. Either way a cart that already has lines is held in its
 * place (resumeHeldSale), so switching between two customers loses nothing.
 *
 * A plain DropdownMenu, not a searchable Command list: it's a short list, and
 * a search box's autofocus would raise the keyboard on a phone.
 */
export function PosResumeHoldButton({ storeId, held }: PosResumeHoldButtonProps) {
  const { t, locale } = useI18n();
  // Cart amounts are literal in the store's display currency (see PosCart).
  const { currency, formatPrice } = useCurrency();

  const resume = (holdId: string) => {
    const result = usePosCart.getState().resumeHeldSale(storeId, holdId);
    if (result?.swapped) toast.success(t("cashierCart.hold.swapped"));
  };

  const label = (
    <>
      <Play className="h-4 w-4" />
      <span className="truncate">{t("cashierCart.header.resumeHold")}</span>
      <span
        data-testid="held-sales-count"
        className="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
      >
        {held.length}
      </span>
    </>
  );
  const buttonClass = "h-11 min-w-0 touch-manipulation gap-2 px-3";

  if (held.length === 1) {
    return (
      <Button
        type="button"
        variant="outline"
        className={buttonClass}
        onClick={() => resume(held[0].id)}
      >
        {label}
      </Button>
    );
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const tableLabel = (table: string) =>
    t("cashierCart.header.tableShort").replace("{table}", table);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={buttonClass}>
          {label}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      {/* Capped and scrolling, so a long list never runs off a short tablet screen. */}
      <DropdownMenuContent
        align="start"
        className="max-h-[calc(60dvh/var(--app-zoom,1))] w-72 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          {t("cashierCart.header.heldOnThisTill")}
        </DropdownMenuLabel>
        {[...held].reverse().map((sale) => (
          <DropdownMenuItem
            key={sale.id}
            className="min-h-11 touch-manipulation items-start gap-3"
            onSelect={() => resume(sale.id)}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {heldSaleTitle(sale, tableLabel)}
              </span>
              <span className="text-muted-foreground text-xs">
                {t("cashierCart.hold.heldAt").replace("{time}", time(sale.heldAt))}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular-nums">
              {formatPrice(sale.cart.total, currency)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
