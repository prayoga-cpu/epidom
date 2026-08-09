"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { toast } from "sonner";
import { ReceiptDocument } from "@/components/shared/receipt-document";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";
import { RECEIPT_INTL_LOCALE } from "@/lib/receipts/receipt-labels";
import {
  useUpdateReceiptSettings,
  type ReceiptSettingsData,
} from "../hooks/use-receipt-settings";

interface EditReceiptSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  settings: ReceiptSettingsData;
}

interface FormValues {
  footerMessage: string;
  facebookUrl: string;
  showSocialLinks: boolean;
  autoSendWhatsappReceipt: boolean;
}

function toFormValues(settings: ReceiptSettingsData): FormValues {
  return {
    footerMessage: settings.footerMessage ?? "",
    facebookUrl: settings.facebookHandle ?? "",
    showSocialLinks: settings.showSocialLinks,
    autoSendWhatsappReceipt: settings.autoSendWhatsappReceipt,
  };
}

const SAMPLE_ITEMS: ReceiptData["items"] = [
  { name: "Salt Bread", quantity: 1, unitPrice: 25000, total: 25000 },
  { name: "Americano", quantity: 1, unitPrice: 22000, total: 22000 },
  { name: "Iced Latte", quantity: 1, unitPrice: 26000, total: 26000 },
];

export function EditReceiptSettingsDialog({
  open,
  onOpenChange,
  storeId,
  settings,
}: EditReceiptSettingsDialogProps) {
  const { t, locale } = useI18n();
  const { currency } = useCurrency();
  const updateSettings = useUpdateReceiptSettings(storeId);

  const form = useForm<FormValues>({ defaultValues: toFormValues(settings) });

  useEffect(() => {
    if (open) form.reset(toFormValues(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings]);

  async function onSubmit(data: FormValues) {
    try {
      await updateSettings.mutateAsync({
        footerMessage: data.footerMessage,
        facebookUrl: data.facebookUrl,
        showSocialLinks: data.showSocialLinks,
        autoSendWhatsappReceipt: data.autoSendWhatsappReceipt,
      });
      toast.success(t("profile.toasts.receiptSettingsUpdated.title"), {
        description: t("profile.toasts.receiptSettingsUpdated.description"),
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(t("common.error"), {
        description:
          error instanceof Error ? error.message : t("profile.errors.receiptSettingsUpdateFailed"),
      });
    }
  }

  const showSocialLinks = useWatch({ control: form.control, name: "showSocialLinks" });
  const autoSendWhatsappReceipt = useWatch({
    control: form.control,
    name: "autoSendWhatsappReceipt",
  });
  const footerMessage = useWatch({ control: form.control, name: "footerMessage" });
  const facebookUrl = useWatch({ control: form.control, name: "facebookUrl" });

  const previewData: ReceiptData = {
    storeName: settings.storeName,
    currency,
    locale,
    tagline: settings.tagline ?? undefined,
    address: settings.address ?? undefined,
    email: settings.email ?? undefined,
    phone: settings.phone ?? undefined,
    instagramHandle: showSocialLinks ? (settings.instagramHandle ?? undefined) : undefined,
    tiktokHandle: showSocialLinks ? (settings.tiktokHandle ?? undefined) : undefined,
    facebookHandle: showSocialLinks && facebookUrl ? facebookUrl : undefined,
    footerMessage: footerMessage || undefined,
    orderNumber: "POS-PREVIEW-0001",
    date: new Intl.DateTimeFormat(RECEIPT_INTL_LOCALE[locale], {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date()),
    items: SAMPLE_ITEMS,
    subtotal: 73000,
    tax: 7300,
    taxLabel: "PB1 (10%)",
    total: 80300,
    paymentMethod: "CASH",
    amountTendered: 100000,
    change: 19700,
    cashierName: "Dinda",
    tableLabel: "07",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("profile.forms.editReceiptSettings")}
        description={t("profile.forms.editReceiptSettingsDescription")}
        maxWidth="3xl"
        footer={
          <FormDialogFooter
            formId="edit-receipt-settings-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("profile.actions.save")}
            isPending={updateSettings.isPending}
            variant="full-width"
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <form
            id="edit-receipt-settings-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <p className="text-muted-foreground text-xs">{t("profile.receiptSettings.brandingNote")}</p>

            <section className="space-y-1">
              <Label htmlFor="footerMessage">{t("profile.receiptSettings.footerMessage")}</Label>
              <Textarea
                id="footerMessage"
                rows={3}
                placeholder={t("profile.receiptSettings.footerMessagePlaceholder")}
                className="resize-none"
                {...form.register("footerMessage")}
              />
            </section>

            <section className="space-y-1">
              <Label htmlFor="facebookUrl">{t("profile.receiptSettings.facebookUrl")}</Label>
              <Input
                id="facebookUrl"
                placeholder={t("profile.receiptSettings.facebookUrlPlaceholder")}
                className="h-11"
                {...form.register("facebookUrl")}
              />
            </section>

            <Separator />

            <section className="flex items-center justify-between gap-4 py-1">
              <div>
                <Label htmlFor="showSocialLinks" className="text-base font-semibold">
                  {t("profile.receiptSettings.showSocialLinks")}
                </Label>
                <p className="text-muted-foreground text-xs">
                  {t("profile.receiptSettings.showSocialLinksDesc")}
                </p>
              </div>
              <Switch
                id="showSocialLinks"
                checked={showSocialLinks}
                onCheckedChange={(checked) => form.setValue("showSocialLinks", checked)}
              />
            </section>

            <Separator />

            <section className="space-y-1">
              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <Label htmlFor="autoSendWhatsappReceipt" className="text-base font-semibold">
                    {t("profile.receiptSettings.autoSendWhatsapp")}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {t("profile.receiptSettings.autoSendWhatsappDesc")}
                  </p>
                </div>
                <Switch
                  id="autoSendWhatsappReceipt"
                  checked={autoSendWhatsappReceipt}
                  onCheckedChange={(checked) => form.setValue("autoSendWhatsappReceipt", checked)}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {t("profile.receiptSettings.autoSendWhatsappUnavailable")}
              </p>
            </section>
          </form>

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t("profile.receiptSettings.preview")}
            </p>
            <div className="bg-muted/30 max-h-[70dvh] overflow-y-auto rounded-lg border p-3">
              <ReceiptDocument data={previewData} />
            </div>
          </div>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
