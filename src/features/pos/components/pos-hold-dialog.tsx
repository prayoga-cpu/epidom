"use client";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

const holdFormSchema = z.object({
  customerName: z.string().optional(),
  orderType: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type HoldFormValues = z.infer<typeof holdFormSchema>;

interface PosHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HoldFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
}

/** Minimal label-only dialog for parking a cart — no payment method, that's decided at finalize. */
export function PosHoldDialog({ open, onOpenChange, onSubmit, isSubmitting }: PosHoldDialogProps) {
  const { t } = useI18n();

  const form = useForm<HoldFormValues>({
    resolver: zodResolver(holdFormSchema),
    defaultValues: {
      customerName: "",
      orderType: "DINE_IN",
      tableNumber: "",
      notes: "",
    },
  });

  const handleSubmit = async (data: HoldFormValues) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("pos.hold.title")}
        maxWidth="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.actions.cancel")}
            </Button>
            {/* form="pos-hold-form" (not a wrapping <form>): DialogContent
                renders through a Portal, so a <form> wrapping
                FormDialogLayout never actually contains this button in the
                real DOM. */}
            <Button type="submit" form="pos-hold-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("pos.hold.submit")}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="pos-hold-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("pos.hold.label")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("pos.hold.labelPlaceholder")} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orderType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t("pos.checkout.orderType")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <FormItem className="flex items-center space-y-0 space-x-2">
                        <FormControl>
                          <RadioGroupItem value="DINE_IN" />
                        </FormControl>
                        <FormLabel className="font-normal">{t("pos.checkout.dineIn")}</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-y-0 space-x-2">
                        <FormControl>
                          <RadioGroupItem value="TAKEAWAY" />
                        </FormControl>
                        <FormLabel className="font-normal">{t("pos.checkout.takeaway")}</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tableNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("pos.checkout.tableOptional")}</FormLabel>
                  <FormControl>
                    <Input placeholder="A1, B2..." {...field} />
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
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
