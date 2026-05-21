"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePosCart } from "../hooks/use-pos-cart";
import { createPosOrderSchema, type CreatePosOrderInput } from "@/lib/validation/pos.schemas";
import { formatCurrency } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Printer, WifiOff, Loader2 } from "lucide-react";
import { enqueueOrder } from "@/lib/pwa/offline-queue";
import {
  isBluetoothSupported,
  isPrinterConnected,
  connectPrinter,
  printReceipt,
  type ReceiptData,
} from "@/lib/pwa/thermal-printer";

interface PosCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName?: string;
  cashierName?: string;
}

export function PosCheckoutDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  cashierName,
}: PosCheckoutDialogProps) {
  const { t } = useI18n();
  const { currency } = useCurrency();
  const cart = usePosCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const form = useForm<CreatePosOrderInput>({
    resolver: zodResolver(createPosOrderSchema),
    defaultValues: {
      items: cart.items.map((i: any) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        modifierSelections: i.modifiers,
      })),
      paymentMethod: "CASH",
      orderType: "DINE_IN",
      amountTendered: undefined,
      customerName: "",
      customerPhone: "",
      notes: "",
    },
  });

  const paymentMethod = form.watch("paymentMethod");
  const amountTendered = form.watch("amountTendered");
  const change = amountTendered ? Math.max(0, amountTendered - cart.total) : 0;

  // Sync form items when cart changes
  useState(() => {
    if (open) {
      form.setValue(
        "items",
        cart.items.map((i: any) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          modifierSelections: i.modifiers,
        }))
      );
    }
  });

  const buildReceipt = (data: CreatePosOrderInput, orderNumber: string): ReceiptData => ({
    storeName: storeName ?? "Epidom POS",
    orderNumber,
    date: new Intl.DateTimeFormat("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date()),
    items: cart.items.map((i: any) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.lineTotal,
    })),
    subtotal: cart.subtotal,
    total: cart.total,
    paymentMethod: data.paymentMethod,
    amountTendered: data.amountTendered,
    change: data.amountTendered ? Math.max(0, data.amountTendered - cart.total) : undefined,
    cashierName,
    tableLabel: data.tableNumber ?? undefined,
    notes: data.notes ?? undefined,
  });

  const handlePrint = async (receipt: ReceiptData) => {
    if (!isBluetoothSupported()) {
      toast.error("Browser ini tidak mendukung cetak Bluetooth. Gunakan Chrome di Android/Desktop.");
      return;
    }
    setIsPrinting(true);
    try {
      if (!isPrinterConnected()) {
        const connected = await connectPrinter();
        if (!connected) {
          toast.error("Gagal terhubung ke printer. Pastikan printer Bluetooth menyala.");
          return;
        }
      }
      await printReceipt(receipt);
      toast.success(t("pos.print.success"));
    } catch (err: any) {
      toast.error(err?.message ?? t("pos.print.failed"));
    } finally {
      setIsPrinting(false);
    }
  };

  const onSubmit = async (data: CreatePosOrderInput) => {
    setIsSubmitting(true);
    try {
      if (!navigator.onLine) {
        const localId = await enqueueOrder(storeId, data);
        const receipt = buildReceipt(data, `OFFLINE-${localId.slice(0, 8).toUpperCase()}`);
        setLastReceipt(receipt);
        setShowPrint(true);
        toast(t("pos.offline.queued"), {
          description: t("pos.offline.queuedDesc"),
          icon: <WifiOff className="h-4 w-4" />,
        });
        cart.clearCart();
        onOpenChange(false);
        return;
      }

      const result = await apiClient.post<{ orderNumber: string }>(
        `/stores/${storeId}/pos/orders`,
        data
      );

      const orderNumber = (result as any)?.orderNumber ?? "—";
      const receipt = buildReceipt(data, orderNumber);
      setLastReceipt(receipt);
      setShowPrint(true);

      toast.success(t("pos.checkout.success"));
      cart.clearCart();
      onOpenChange(false);
    } catch (error) {
      toast.error("Gagal membuat pesanan. Coba lagi.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("pos.checkout.title")}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipe Pesanan</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="DINE_IN" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("pos.checkout.dineIn")}
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="TAKEAWAY" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("pos.checkout.takeaway")}
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>{t("pos.checkout.paymentMethod")}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="CASH" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("pos.checkout.cash")}
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="QRIS" />
                            </FormControl>
                            <FormLabel className="font-normal">QRIS</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {paymentMethod === "CASH" && (
                <div className="rounded-md border bg-muted/20 p-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="amountTendered"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("pos.checkout.amountTendered")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">
                              Rp
                            </span>
                            <Input
                              type="number"
                              placeholder="0"
                              className="pl-8 text-lg font-medium"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? Number(e.target.value) : undefined
                                )
                              }
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">
                      {t("pos.checkout.change")}:
                    </span>
                    <span className={change > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>
                      {formatCurrency(change, currency)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pos.checkout.customerName")}</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tableNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pos.checkout.table")} (opsional)</FormLabel>
                      <FormControl>
                        <Input placeholder="A1, B2..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("pos.checkout.notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Catatan untuk dapur..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("pos.checkout.processing")}
                    </>
                  ) : (
                    `${t("pos.checkout.confirm")} • ${formatCurrency(cart.total, currency)}`
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Post-checkout print prompt */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("pos.print.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("pos.print.prompt")}{" "}
            <span className="font-semibold">{lastReceipt?.orderNumber}</span>
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowPrint(false)}
              className="w-full sm:w-auto"
            >
              {t("pos.print.skip")}
            </Button>
            <Button
              onClick={async () => {
                if (lastReceipt) await handlePrint(lastReceipt);
                setShowPrint(false);
              }}
              disabled={isPrinting}
              className="w-full sm:w-auto"
            >
              {isPrinting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {isPrinting ? t("pos.print.printing") : t("pos.print.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
