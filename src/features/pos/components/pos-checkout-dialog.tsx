"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useState, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePosCart } from "../hooks/use-pos-cart";
import { createPosOrderSchema, type CreatePosOrderInput } from "@/lib/validation/pos.schemas";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { QRCodeSVG } from "qrcode.react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
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
  shiftId?: string;
}

export function PosCheckoutDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  cashierName,
  shiftId,
}: PosCheckoutDialogProps) {
  const { t, locale } = useI18n();
  const { currency, formatPrice, convertToBase } = useCurrency();
  const cart = usePosCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showPaymentQr, setShowPaymentQr] = useState(false);
  const [currentQrString, setCurrentQrString] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const pendingPurchaseRef = useRef<{
    transaction_id: string;
    value: number;
    currency: string;
    items: Array<{ item_id: string; item_name: string; price: number; quantity: number }>;
  } | null>(null);

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
      bankCode: "BNI",
      notes: "",
    },
  });

  // useWatch (not form.watch) so this component reliably re-renders when the
  // payment method changes (shows/hides the cash vs. bank-transfer section).
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  // Only used to gate the Confirm button below — the live Change/error text
  // next to the input itself is computed from that FormField's own
  // field.value directly, not from this, so it can never lag a keystroke.
  const amountTendered = useWatch({ control: form.control, name: "amountTendered" });
  const isCashUnderpaid =
    paymentMethod === "CASH" &&
    (amountTendered == null || convertToBase(amountTendered) < cart.total);

  useEffect(() => {
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
  }, [open, cart.items]);

  useEffect(() => {
    if (!showPaymentQr || !currentOrderId) return;
    setIsPollingPayment(true);
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<{ status: string; paymentStatus: string }>(
          `/stores/${storeId}/pos/orders/${currentOrderId}`
        );
        const data = (res as any)?.data ?? res;
        if (data?.paymentStatus === "PAID") {
          setIsPollingPayment(false);
          setShowPaymentQr(false);
          setShowPrint(true);
          toast.success(t("pos.checkout.success"));
          if (pendingPurchaseRef.current) {
            trackEvent("purchase", {
              event_category: "pos_order",
              ...pendingPurchaseRef.current,
            });
            pendingPurchaseRef.current = null;
          }
        }
      } catch (e) {
        // ignore poll errors
      }
    }, 3000);
    return () => {
      clearInterval(interval);
      setIsPollingPayment(false);
    };
  }, [showPaymentQr, currentOrderId, storeId, t]);

  const buildReceipt = (data: CreatePosOrderInput, orderNumber: string): ReceiptData => ({
    storeName: storeName ?? "Epidom POS",
    orderNumber,
    date: new Intl.DateTimeFormat(locale === "id" ? "id-ID" : locale === "fr" ? "fr-FR" : "en-US", {
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
      toast.error(t("pos.print.bluetoothUnsupported"));
      return;
    }
    setIsPrinting(true);
    try {
      if (!isPrinterConnected()) {
        const connected = await connectPrinter();
        if (!connected) {
          toast.error(t("pos.print.connectFailed"));
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
      // amountTendered was typed by the cashier in their display currency,
      // but every other monetary value in this order (cart.total, subtotal,
      // menu item prices) is stored in the base currency (IDR) — the
      // server, the printed receipt, and buildReceipt's own change
      // calculation below all assume IDR. Convert once, up front, so
      // nothing downstream has to know this conversion happened. A no-op
      // for the (majority) case where the store's display currency is
      // already IDR.
      const submitData: CreatePosOrderInput = {
        ...data,
        amountTendered:
          data.amountTendered != null ? convertToBase(data.amountTendered) : undefined,
      };

      if (!navigator.onLine) {
        if (cart.resumingOrderId) {
          // The offline queue always creates a brand-new order on reconnect —
          // it has no concept of finalizing an existing HELD row, so queuing
          // here would leave the original held order dangling and create a
          // duplicate. Block it instead, same as Hold does when offline.
          toast.error(t("pos.cart.holdOffline"));
          return;
        }

        const localId = await enqueueOrder(storeId, submitData);
        const receipt = buildReceipt(submitData, `OFFLINE-${localId.slice(0, 8).toUpperCase()}`);
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

      const endpoint = cart.resumingOrderId
        ? `/stores/${storeId}/pos/orders/${cart.resumingOrderId}/finalize`
        : `/stores/${storeId}/pos/orders`;

      const result = await apiClient.post<{ orderNumber: string }>(endpoint, {
        ...submitData,
        shiftId,
      });

      const orderNumber = (result as any)?.orderNumber ?? "—";
      const qrStr = (result as any)?.qrString ?? null;
      const orderId = (result as any)?.orderId ?? null;

      const receipt = buildReceipt(submitData, orderNumber);
      setLastReceipt(receipt);

      // Snapshot the cart for the purchase event before clearCart() wipes it —
      // needed either immediately below (CASH) or later once async payment
      // methods (QRIS/e-wallet) confirm via polling.
      pendingPurchaseRef.current = {
        transaction_id: orderNumber,
        value: cart.total,
        currency,
        items: cart.items.map((i: any) => ({
          item_id: i.menuItemId,
          item_name: i.name,
          price: i.unitPrice,
          quantity: i.quantity,
        })),
      };

      cart.clearCart();
      onOpenChange(false);

      if (qrStr) {
        setCurrentQrString(qrStr);
        setCurrentOrderId(orderId);
        setShowPaymentQr(true);
      } else {
        setShowPrint(true);
        toast.success(t("pos.checkout.success"));
        if (pendingPurchaseRef.current) {
          trackEvent("purchase", { event_category: "pos_order", ...pendingPurchaseRef.current });
          pendingPurchaseRef.current = null;
        }
      }
    } catch (error) {
      // Surface the server's actual reason (e.g. "item no longer available",
      // "order is no longer held") instead of a blanket failure message —
      // ApiClientError already carries it via apiClient's error handling.
      // Fall back to the generic copy only for unexpected/network errors,
      // which don't carry an actionable, cashier-facing reason.
      const serverMessage = error instanceof ApiClientError ? error.response.error.message : null;
      toast.error(serverMessage || t("pos.checkout.orderFailed"));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <FormDialogLayout
          title={t("pos.checkout.title")}
          maxWidth="md"
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
              {/* form="pos-checkout-form" (not a wrapping <form> element):
                  DialogContent renders through a React Portal, so a <form>
                  wrapping FormDialogLayout never actually contains this
                  button in the real DOM — clicking it wouldn't submit
                  anything. The form attribute associates them by id
                  instead, which works regardless of DOM position. */}
              <Button
                type="submit"
                form="pos-checkout-form"
                disabled={isSubmitting || isCashUnderpaid}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pos.checkout.processing")}
                  </>
                ) : (
                  `${t("pos.checkout.confirm")} • ${formatPrice(cart.total)}`
                )}
              </Button>
            </>
          }
        >
          <Form {...form}>
            <form
              id="pos-checkout-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="grid gap-6 sm:grid-cols-2">
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
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="DINE_IN" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {t("pos.checkout.dineIn")}
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
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
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="CASH" />
                            </FormControl>
                            <FormLabel className="font-normal">{t("pos.checkout.cash")}</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="QRIS" />
                            </FormControl>
                            <FormLabel className="font-normal">QRIS</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="GOPAY" />
                            </FormControl>
                            <FormLabel className="font-normal">GoPay</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="OVO" />
                            </FormControl>
                            <FormLabel className="font-normal">OVO</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="DANA" />
                            </FormControl>
                            <FormLabel className="font-normal">DANA</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="SHOPEEPAY" />
                            </FormControl>
                            <FormLabel className="font-normal">ShopeePay</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="BANK_TRANSFER" />
                            </FormControl>
                            <FormLabel className="font-normal">Virtual Account</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-y-0 space-x-3">
                            <FormControl>
                              <RadioGroupItem value="STRIPE_CARD" />
                            </FormControl>
                            <FormLabel className="font-normal">Credit Card</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {paymentMethod === "CASH" && (
                <div className="bg-muted/20 space-y-4 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="amountTendered"
                    render={({ field }) => {
                      // Computed from this same field.value (not a separate
                      // top-level useWatch) so it's guaranteed to reflect
                      // exactly what's on screen on every keystroke — no
                      // separate subscription that can lag or go stale.
                      //
                      // field.value is what the cashier typed in *their*
                      // display currency, but cart.total is always stored
                      // in the base currency (IDR) — subtracting them
                      // directly mixes units. Convert the tendered amount
                      // to base first, do the subtraction in base units
                      // (matching cart.total), then let formatPrice convert
                      // the result back to the display currency, same as
                      // every other price in this dialog.
                      const tenderedBase = field.value ? convertToBase(field.value) : 0;
                      const change = tenderedBase ? Math.max(0, tenderedBase - cart.total) : 0;
                      const isUnderpaid = field.value != null && tenderedBase < cart.total;
                      return (
                        <>
                          <FormItem>
                            <FormLabel>{t("pos.checkout.amountTendered")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="text-muted-foreground absolute top-2.5 left-3 text-sm">
                                  {getCurrencySymbol(currency)}
                                </span>
                                <DecimalInput
                                  decimals={2}
                                  min={0}
                                  placeholder="0"
                                  className="pl-8 text-lg font-medium"
                                  value={field.value}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </div>
                            </FormControl>
                          </FormItem>
                          <div className="flex justify-between text-sm font-medium">
                            <span className="text-muted-foreground">
                              {t("pos.checkout.change")}:
                            </span>
                            <span
                              className={
                                isUnderpaid
                                  ? "text-destructive"
                                  : change > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : ""
                              }
                            >
                              {formatPrice(change)}
                            </span>
                          </div>
                          {isUnderpaid && (
                            <p className="text-destructive text-xs font-medium">
                              {t("pos.checkout.insufficientAmount")}
                            </p>
                          )}
                        </>
                      );
                    }}
                  />
                </div>
              )}

              {paymentMethod === "BANK_TRANSFER" && (
                <FormField
                  control={form.control}
                  name="bankCode"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Pilih Bank</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          {["BNI", "BRI", "MANDIRI", "PERMATA"].map((bank) => (
                            <FormItem key={bank} className="flex items-center space-y-0 space-x-2">
                              <FormControl>
                                <RadioGroupItem value={bank} />
                              </FormControl>
                              <FormLabel className="font-normal">{bank}</FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
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
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. WhatsApp / HP</FormLabel>
                      <FormControl>
                        <Input placeholder="0812..." {...field} />
                      </FormControl>
                      {["GOPAY", "OVO", "DANA", "SHOPEEPAY"].includes(paymentMethod) && (
                        <p className="text-muted-foreground mt-1 text-[10px]">
                          Wajib untuk e-wallet
                        </p>
                      )}
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
              </div>

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

      {/* Payment QR prompt */}
      <Dialog open={showPaymentQr} onOpenChange={setShowPaymentQr}>
        <DialogContent className="text-center sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Instruksi Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {currentQrString && currentQrString.includes(":") ? (
              <div className="w-full border-b p-2 text-center sm:rounded-xl sm:border-2 sm:border-slate-100 sm:bg-white sm:p-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                  Nomor Virtual Account
                </p>
                <p className="font-mono text-xl font-bold tracking-widest break-all sm:text-slate-800">
                  {currentQrString.split(":")[1]}
                </p>
              </div>
            ) : currentQrString ? (
              <div className="p-2 sm:rounded-xl sm:border-2 sm:border-slate-100 sm:bg-white sm:p-4">
                <QRCodeSVG value={currentQrString} size={200} level="M" includeMargin={false} />
              </div>
            ) : (
              <div className="w-full border-b p-2 text-center sm:rounded-xl sm:border-2 sm:border-slate-100 sm:bg-white sm:p-4">
                <p className="mb-2 text-sm font-medium sm:text-slate-800">
                  Notifikasi e-Wallet sudah dikirim!
                </p>
                <p className="text-muted-foreground text-xs">
                  Minta pembeli untuk cek aplikasi mereka.
                </p>
              </div>
            )}
            <p className="text-muted-foreground mt-2 animate-pulse text-sm">
              Menunggu pembayaran...
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentQr(false);
                setShowPrint(true); // skip waiting and let them print
              }}
              className="w-full"
            >
              Lewati / Selesai Manual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-checkout print prompt */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("pos.print.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
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
