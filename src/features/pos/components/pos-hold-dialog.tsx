"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Info, Loader2 } from "lucide-react";
import { formatPax } from "../lib/cart-format";
import { GUEST_COUNT_MAX, GUEST_COUNT_MIN } from "./guest-count-stepper";

const holdFormSchema = z.object({
  customerName: z.string().optional(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  guestCount: z.number().int().min(GUEST_COUNT_MIN).max(GUEST_COUNT_MAX).optional(),
  tableNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type HoldFormValues = z.infer<typeof holdFormSchema>;

/** What Save Bill starts from — everything the cart already knows. */
export interface HoldDialogDefaults {
  orderType: "DINE_IN" | "TAKEAWAY";
  guestCount: number;
  tableNumber: string;
  /** The attached customer's name, or null for a walk-in. */
  customerName: string | null;
}

interface PosHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HoldFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  defaults: HoldDialogDefaults;
  /** A coupon or redeemed points are on the bill — neither is saved with it. */
  dropsPromotions?: boolean;
}

/**
 * "Save Bill" (formerly "Hold order"): park the cart aside as a saved bill.
 *
 * Order type, guests and the customer are already set on the cart panel, so
 * they arrive pre-filled and are shown as a read-only summary — the dialog only
 * asks for what the cart doesn't have: a table (pre-filled if one was set),
 * notes and, for a walk-in, an optional label. All of it is optional; pressing
 * Save with nothing typed is the normal path.
 *
 * No payment method — that's decided when the bill is finally charged.
 */
export function PosHoldDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  defaults,
  dropsPromotions,
}: PosHoldDialogProps) {
  const { t } = useI18n();

  const form = useForm<HoldFormValues>({
    resolver: zodResolver(holdFormSchema),
    defaultValues: {
      customerName: "",
      orderType: defaults.orderType,
      guestCount: defaults.guestCount,
      tableNumber: defaults.tableNumber,
      notes: "",
    },
  });

  // Re-seed from the cart on every open: the cashier may have changed the
  // order type, pax or table since the last time this dialog was shown.
  useEffect(() => {
    if (open) {
      form.reset({
        customerName: "",
        orderType: defaults.orderType,
        guestCount: defaults.guestCount,
        tableNumber: defaults.tableNumber,
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (data: HoldFormValues) => {
    await onSubmit({
      ...data,
      // The cart owns these two; the form only carries them through.
      orderType: defaults.orderType,
      guestCount: defaults.orderType === "DINE_IN" ? defaults.guestCount : undefined,
      customerName: defaults.customerName ?? data.customerName,
    });
  };

  const summary = [
    t(defaults.orderType === "DINE_IN" ? "cashierCart.header.dineIn" : "cashierCart.header.takeAway"),
    defaults.orderType === "DINE_IN"
      ? formatPax(t, defaults.guestCount)
      : null,
    defaults.customerName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("cashierCart.saveBill.title")}
        maxWidth="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 touch-manipulation"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.actions.cancel")}
            </Button>
            {/* form="pos-hold-form" (not a wrapping <form>): DialogContent
                renders through a Portal, so a <form> wrapping
                FormDialogLayout never actually contains this button in the
                real DOM. */}
            <Button
              type="submit"
              form="pos-hold-form"
              className="h-11 touch-manipulation"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("cashierCart.saveBill.submit")}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="pos-hold-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div
              data-testid="hold-summary"
              className="bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-sm"
            >
              {summary}
            </div>

            {defaults.customerName === null && (
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pos.hold.label")}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-11"
                        placeholder={t("pos.hold.labelPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="tableNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("pos.checkout.tableOptional")}</FormLabel>
                  <FormControl>
                    <Input className="h-11" placeholder="A1, B2..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("pos.checkout.notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("pos.checkout.notesPlaceholder")}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {dropsPromotions && (
              <p className="text-muted-foreground flex items-start gap-2 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t("cashierCart.saveBill.dropsPromotions")}</span>
              </p>
            )}
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
