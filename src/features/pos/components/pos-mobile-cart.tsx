"use client";

import { useState } from "react";
import { Store } from "@prisma/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePosSession } from "../hooks/use-pos-session";
import { PosCart } from "./pos-cart";
import { PosCheckoutDialog } from "./pos-checkout-dialog";

interface PosMobileCartProps {
  store: Pick<Store, "id" | "name">;
  /** Controlled from PosShell — the trigger for this now lives in
   * PosHeader's cart button, not a floating bottom bar owned here. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PosMobileCart({ store, open, onOpenChange }: PosMobileCartProps) {
  const { t } = useI18n();
  const { staffName, shiftId } = usePosSession();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <>
      {/* Dialog (not Sheet/bottom-drawer): a bottom Sheet only ever gets
          `height: auto` clamped by `max-height`, never a truly definite
          height, which repeatedly failed to reliably size/scroll a long
          cart list through the nested flex chain. Dialog + this same
          manual flex/overflow shape is the pattern already proven across
          every other dialog fixed this session. */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[85dvh] flex-col overflow-hidden rounded-3xl p-0 md:hidden"
          showCloseButton={false}
        >
          {/* Radix requires a DialogTitle (and warns without a Description)
              for screen readers even when the dialog has its own visible
              header — PosCart's header is a plain div, not a DialogTitle,
              so these stay visually hidden rather than duplicated
              on-screen. */}
          <DialogTitle className="sr-only">{t("pos.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("pos.title")}</DialogDescription>
          <PosCart
            storeId={store.id}
            storeName={store.name}
            onRequestCheckout={() => {
              onOpenChange(false);
              setCheckoutOpen(true);
            }}
            onClose={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>

      <PosCheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        storeId={store.id}
        storeName={store.name}
        cashierName={staffName ?? undefined}
        shiftId={shiftId ?? undefined}
      />
    </>
  );
}
