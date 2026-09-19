"use client";

import { Minus, Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/components/providers/currency-provider";
import { useI18n } from "@/components/lang/i18n-provider";
import type { CartItem } from "../types/pos.types";

interface PosCartItemProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onEdit?: (item: CartItem) => void;
}

/**
 * One line of the live bill, laid out like a receipt: `qty ×  name` on the left,
 * the line total right-aligned, with the modifiers and note underneath. The
 * steppers stay always-visible (no tap-to-reveal): a cashier on a tablet needs
 * them without a second gesture, and every control here is >= 40px.
 */
export function PosCartItem({ item, onUpdateQuantity, onRemove, onEdit }: PosCartItemProps) {
  const { t } = useI18n();
  // Cart amounts (unit price, modifiers, line total) are literal in the
  // store's display currency, never IDR — passing `currency` skips
  // formatPrice's default base-currency conversion. See pos-order-builder.ts.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const unitWithModifiers =
    item.unitPrice + item.modifiers.reduce((sum, m) => sum + m.priceAdjustment, 0);
  const departmentLabel =
    item.isCustom && item.department
      ? t(
          item.department === "BAR"
            ? "cashierCart.customItem.bar"
            : "cashierCart.customItem.kitchen"
        )
      : null;

  return (
    <div className="border-b border-dashed px-3 py-2 last:border-0 sm:px-4">
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground w-7 shrink-0 pt-px text-sm font-medium tabular-nums">
          {item.quantity}×
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <h4 className="min-w-0 text-sm leading-snug font-medium break-words">{item.name}</h4>
            {item.isCustom && (
              <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide uppercase">
                {t("cashierCart.item.custom")}
                {departmentLabel ? ` · ${departmentLabel}` : ""}
              </span>
            )}
          </div>
          {item.modifiers.length > 0 && (
            <ul className="text-muted-foreground mt-0.5 text-xs">
              {item.modifiers.map((mod, i) => (
                <li key={i}>
                  + {mod.optionName}
                  {mod.priceAdjustment !== 0 ? ` (${formatPrice(mod.priceAdjustment)})` : ""}
                </li>
              ))}
            </ul>
          )}
          {item.notes && (
            <p className="text-muted-foreground mt-0.5 text-xs break-words italic">
              “{item.notes}”
            </p>
          )}
          {item.quantity > 1 && (
            <div className="text-muted-foreground mt-0.5 text-xs tabular-nums">
              @ {formatPrice(unitWithModifiers)}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right text-sm font-medium tabular-nums">
          {formatPrice(item.lineTotal)}
        </div>
      </div>

      {/* Controls row. flex-wrap as a safety net for the narrowest panel: the
          stepper + edit + remove need ~250px, and a wrap beats a clipped
          control. pl-9 lines them up under the name, past the qty gutter. */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-1 pl-9">
        <div className="bg-muted/50 flex items-center gap-0.5 rounded-md border p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 touch-manipulation rounded-sm"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          >
            {item.quantity === 1 ? (
              <Trash2 className="text-destructive h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span className="sr-only">{t("cashierCart.item.decrease")}</span>
          </Button>
          <span className="w-8 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 touch-manipulation rounded-sm"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">{t("cashierCart.item.increase")}</span>
          </Button>
        </div>
        <div className="flex items-center gap-0.5">
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-11 w-11 touch-manipulation"
              onClick={() => onEdit(item)}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">{t("common.actions.edit")}</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-11 w-11 touch-manipulation"
            onClick={() => onRemove(item.id)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.actions.remove")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
