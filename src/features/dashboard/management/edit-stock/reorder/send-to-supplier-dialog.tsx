"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { useToast } from "@/hooks/use-toast";
import { useSupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { generatePDFBlob } from "@/lib/utils/export";
import { Loader2, Mail, MessageCircle, Send } from "lucide-react";

type Channel = "email" | "whatsapp" | "both";

interface SendToSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export function SendToSupplierDialog({ open, onOpenChange, orderId }: SendToSupplierDialogProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;

  const { data } = useSupplierOrder(storeId, orderId ?? "");
  const order = orderId ? data?.order : null;

  const [channel, setChannel] = useState<Channel>("email");
  const [sending, setSending] = useState(false);

  const hasEmail = !!order?.supplier.email;
  const hasPhone = !!order?.supplier.phone;

  const handleSend = async () => {
    if (!order) return;
    setSending(true);
    try {
      const pdfBlob = await generatePDFBlob(
        order.items.map((item) => ({
          material: `${item.material.name} (${item.material.sku})`,
          quantity: `${item.quantity} ${item.unit}`,
          unitPrice: formatPrice(item.unitPrice),
          total: formatPrice(item.total),
        })),
        [
          { key: "material", header: t("alerts.table.material") },
          { key: "quantity", header: t("alerts.quantity") || "Qty" },
          { key: "unitPrice", header: t("alerts.price") },
          { key: "total", header: t("alerts.total") },
        ],
        `${t("management.delivery.title")} — ${order.orderNumber}`
      );

      const formData = new FormData();
      formData.append("file", pdfBlob, `${order.orderNumber}.pdf`);
      formData.append("channel", channel);

      const response = await fetch(`/api/stores/${storeId}/supplier-orders/${order.id}/send`, {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to send");
      }

      const results = json.data as { email?: { success: boolean }; whatsapp?: { success: boolean } };
      if (results.email) {
        toast(
          results.email.success
            ? { title: t("management.delivery.sendEmailSuccess") }
            : { title: t("management.delivery.sendEmailFailed"), variant: "destructive" }
        );
      }
      if (results.whatsapp) {
        toast(
          results.whatsapp.success
            ? { title: t("management.delivery.sendWhatsappSuccess") }
            : { title: t("management.delivery.sendWhatsappFailed"), variant: "destructive" }
        );
      }
      if ((!results.email || results.email.success) && (!results.whatsapp || results.whatsapp.success)) {
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t("management.delivery.sendFailed"),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("management.delivery.sendToSupplier")}
        description={order ? `${order.supplier.name} — ${order.orderNumber}` : undefined}
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={handleSend} disabled={sending || !order}>
              {sending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              {t("management.delivery.send")}
            </Button>
          </div>
        }
      >
        <RadioGroup value={channel} onValueChange={(v) => setChannel(v as Channel)} className="space-y-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="email" id="send-email" disabled={!hasEmail} />
            <Label htmlFor="send-email" className="flex items-center gap-2 font-normal">
              <Mail className="h-4 w-4" />
              {t("management.delivery.viaEmail")}
              {!hasEmail && (
                <span className="text-muted-foreground text-xs">
                  ({t("management.delivery.noEmailOnFile")})
                </span>
              )}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="whatsapp" id="send-whatsapp" disabled={!hasPhone} />
            <Label htmlFor="send-whatsapp" className="flex items-center gap-2 font-normal">
              <MessageCircle className="h-4 w-4" />
              {t("management.delivery.viaWhatsapp")}
              {!hasPhone && (
                <span className="text-muted-foreground text-xs">
                  ({t("management.delivery.noPhoneOnFile")})
                </span>
              )}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="both" id="send-both" disabled={!hasEmail || !hasPhone} />
            <Label htmlFor="send-both" className="font-normal">
              {t("management.delivery.viaBoth")}
            </Label>
          </div>
        </RadioGroup>
      </FormDialogLayout>
    </Dialog>
  );
}
