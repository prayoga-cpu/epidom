"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import { useI18n } from "@/components/lang/i18n-provider";
import type { CartItem } from "../types/pos.types";

interface PosCartItemProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function PosCartItem({ item, onUpdateQuantity, onRemove }: PosCartItemProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();

  return (
    <div className="flex flex-col gap-2 border-b p-4 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium leading-none">{item.name}</h4>
          {item.modifiers.length > 0 && (
            <ul className="mt-1 text-sm text-muted-foreground">
              {item.modifiers.map((mod, i) => (
                <li key={i}>
                  + {mod.name} ({formatCurrency(mod.priceAdd, currency)})
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1.5 text-sm font-medium text-primary">
            {formatCurrency(item.unitPrice + item.modifiers.reduce((sum, m) => sum + m.priceAdd, 0), currency)}
          </div>
        </div>
        <div className="text-right font-medium">
          {formatCurrency(item.lineTotal, currency)}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-sm"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          >
            {item.quantity === 1 ? (
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">Decrease</span>
          </Button>
          <span className="w-8 text-center text-sm font-medium">
            {item.quantity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-sm"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only">Increase</span>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(item.id)}
        >
          {t("common.actions.remove")}
        </Button>
      </div>
    </div>
  );
}
