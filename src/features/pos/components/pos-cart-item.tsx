"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { formatPrice } = useCurrency();

  return (
    <div className="flex flex-col gap-2 border-b p-4 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="leading-none font-medium">{item.name}</h4>
          {item.modifiers.length > 0 && (
            <ul className="text-muted-foreground mt-1 text-sm">
              {item.modifiers.map((mod, i) => (
                <li key={i}>
                  + {mod.name} ({formatPrice(mod.priceAdd)})
                </li>
              ))}
            </ul>
          )}
          <div className="text-primary mt-1.5 text-sm font-medium">
            {formatPrice(item.unitPrice + item.modifiers.reduce((sum, m) => sum + m.priceAdd, 0))}
          </div>
        </div>
        <div className="text-right font-medium">{formatPrice(item.lineTotal)}</div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="bg-muted/50 flex items-center gap-1 rounded-md border p-0.5">
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
            <span className="sr-only">Decrease</span>
          </Button>
          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 touch-manipulation rounded-sm"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Increase</span>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-11 touch-manipulation"
          onClick={() => onRemove(item.id)}
        >
          {t("common.actions.remove")}
        </Button>
      </div>
    </div>
  );
}
