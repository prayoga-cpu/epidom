"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePosCart } from "../hooks/use-pos-cart";
import { useFinanceSettings } from "@/features/dashboard/profile/hooks/use-finance-settings";
import { useReceiptSettings } from "@/features/dashboard/profile/hooks/use-receipt-settings";
import { useKdsSettings } from "../hooks/use-kds-settings";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Printer, WifiOff, Loader2, Clock } from "lucide-react";
import { enqueueOrder } from "@/lib/pwa/offline-queue";
import {
  isBluetoothSupported,
  isPrinterConnected,
  printReceipt,
  type ReceiptData,
} from "@/lib/pwa/thermal-printer";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { useLastReceipt, type LastReceiptMeta } from "../hooks/use-last-receipt";
import { PaymentMethodChip } from "./payment-method-chip";
import { GuestCountStepper } from "./guest-count-stepper";
import { mapPaymentMethodLabel, orderPaymentMethodGroups } from "../lib/order-status-display";
import type { PaymentMethod } from "@prisma/client";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  // Every monetary value flowing through the POS (cart totals, menu item
  // prices, modifiers, amountTendered) is stored and computed literally in
  // the store's own display currency — see pos-order-builder.ts, which
  // derives unitPrice straight from `menuItem.price` with no conversion.
  // Passing `currency` as the (otherwise IDR-defaulting) `fromCurrency` arg
  // makes formatPrice a pure display formatter here, matching that model.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const cart = usePosCart();
  const { data: financeSettings } = useFinanceSettings(storeId);
  const { data: receiptSettings } = useReceiptSettings(storeId);
  // Drives the "when does stock move" hint at the bottom of the form. Defaults
  // to the kitchen-display-on wording while the setting loads, since that is
  // the deferred (and more surprising) of the two behaviours.
  const kdsEnabled = useKdsSettings(storeId).data?.kitchenDisplayEnabled ?? true;
  const autoPrint = usePrinterSettings((s) => s.autoPrint);
  const paperWidth = usePrinterSettings((s) => s.paperWidth);
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
        selectedOptions: i.modifiers,
        notes: i.notes,
      })),
      paymentMethod: "CASH",
      orderType: "DINE_IN",
      guestCount: 1,
      amountTendered: undefined,
      customerName: "",
      customerPhone: "",
      bankCode: "BNI",
      notes: "",
      paymentNote: "",
    },
  });

  // The market group matching the dashboard's own language leads the list —
  // e.g. an "id" locale surfaces QRIS/GoPay/etc. right after Cash/Card. Each
  // group is then filtered down to what this store actually accepts (see
  // Fees & Taxes settings) — PAY_LATER is excluded from enabledPaymentMethods
  // by design and keeps its own dedicated button below.
  const enabledMethods = new Set(financeSettings?.enabledPaymentMethods ?? []);
  const paymentMethodGroups = orderPaymentMethodGroups(locale)
    .map((group) => ({
      ...group,
      methods: group.methods.filter((method) => enabledMethods.has(method as PaymentMethod)),
    }))
    .filter((group) => group.methods.length > 0);

  // useWatch (not form.watch) so this component reliably re-renders when the
  // payment method changes (shows/hides the cash vs. bank-transfer section).
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  // Pax is a dine-in-only concept — the stepper below is hidden for takeaway,
  // and the server nulls guestCount out for non-DINE_IN regardless.
  const orderType = useWatch({ control: form.control, name: "orderType" });
  // Only used to gate the Confirm button below — the live Change/error text
  // next to the input itself is computed from that FormField's own
  // field.value directly, not from this, so it can never lag a keystroke.
  const amountTendered = useWatch({ control: form.control, name: "amountTendered" });
  const isCashUnderpaid =
    paymentMethod === "CASH" && (amountTendered == null || amountTendered < cart.total);

  useEffect(() => {
    if (open) {
      form.setValue(
        "items",
        cart.items.map((i: any) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          selectedOptions: i.modifiers,
          notes: i.notes,
        }))
      );
    }
  }, [open, cart.items]);

  const buildReceipt = (data: CreatePosOrderInput, orderNumber: string): ReceiptData => ({
    storeName: storeName ?? "Epidom POS",
    currency,
    locale,
    tagline: receiptSettings?.tagline ?? undefined,
    address: receiptSettings?.address ?? undefined,
    email: receiptSettings?.email ?? undefined,
    phone: receiptSettings?.phone ?? undefined,
    instagramHandle:
      receiptSettings?.showSocialLinks !== false
        ? (receiptSettings?.instagramHandle ?? undefined)
        : undefined,
    tiktokHandle:
      receiptSettings?.showSocialLinks !== false
        ? (receiptSettings?.tiktokHandle ?? undefined)
        : undefined,
    facebookHandle:
      receiptSettings?.showSocialLinks !== false
        ? (receiptSettings?.facebookHandle ?? undefined)
        : undefined,
    footerMessage: receiptSettings?.footerMessage ?? undefined,
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
      optionNames: i.modifiers.map((m: any) => m.optionName),
      notes: i.notes,
    })),
    subtotal: cart.subtotal,
    tax: cart.tax > 0 ? cart.tax : undefined,
    taxLabel: financeSettings?.taxLabel ?? undefined,
    serviceCharge: cart.serviceCharge > 0 ? cart.serviceCharge : undefined,
    discountAmount: cart.discountAmount > 0 ? cart.discountAmount : undefined,
    discountReason: cart.discountReason ?? undefined,
    total: cart.total,
    // "OTHER" alone tells the customer nothing — print what the cashier
    // actually typed instead.
    paymentMethod:
      data.paymentMethod === "OTHER" && data.paymentNote ? data.paymentNote : data.paymentMethod,
    amountTendered: data.amountTendered,
    change: data.amountTendered ? Math.max(0, data.amountTendered - cart.total) : undefined,
    cashierName,
    tableLabel: data.tableNumber ?? undefined,
    notes: data.notes ?? undefined,
    width: paperWidth,
  });

  const handlePrint = async (receipt: ReceiptData) => {
    if (!isBluetoothSupported()) {
      toast.error(t("pos.print.bluetoothUnsupported"));
      return;
    }
    setIsPrinting(true);
    try {
      if (!isPrinterConnected()) {
        // Routed through the printer-settings store (not connectPrinter()
        // directly) so a pairing done from this dialog also updates the
        // header's connected badge — otherwise that badge would stay stuck
        // on "Not connected" until the cashier happened to open it.
        const connected = await usePrinterSettings.getState().connect();
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

  // Called on every successful order (any payment method, offline queue).
  // Silently auto-prints when the cashier has both opted in and
  // already paired a printer this session — pairing itself needs a live
  // click (Web Bluetooth's requestDevice requires user activation), so it
  // can't be triggered from here. Anything short of that falls back to the
  // manual print-or-skip prompt.
  const finishWithReceipt = (receipt: ReceiptData, meta: LastReceiptMeta | null) => {
    setLastReceipt(receipt);
    // Shared across the app (not just this dialog's local state) so the
    // printer menu's "Reprint Last Order" action can offer it later, even
    // after this dialog closes. `meta` is null for an offline-queued order
    // — it has no server-assigned id yet, so there's no /r/[orderId] link
    // to send until it syncs.
    if (meta) useLastReceipt.getState().setLastReceipt(receipt, meta);
    if (autoPrint && isPrinterConnected()) {
      handlePrint(receipt);
    } else {
      setShowPrint(true);
    }
  };

  const onSubmit = async (data: CreatePosOrderInput) => {
    setIsSubmitting(true);
    try {
      // amountTendered is typed by the cashier in the store's display
      // currency — same units as cart.total and every menu item price, none
      // of which are converted anywhere in this flow (see pos-order-builder.ts).
      // The server compares/subtracts it against charges.total directly, so
      // it must be submitted as-is.
      // discountAmount/discountReason live in the cart store (applied from
      // the cart footer's popover, not a form field on this dialog) — merged
      // in here rather than through react-hook-form's defaultValues.
      const submitData: CreatePosOrderInput = {
        ...data,
        discountAmount: cart.discountAmount > 0 ? cart.discountAmount : undefined,
        discountReason: cart.discountReason ?? undefined,
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
        finishWithReceipt(receipt, null);
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

      const result = await apiClient.post<{ orderId: string; orderNumber: string }>(endpoint, {
        ...submitData,
        shiftId,
      });

      const orderId = (result as any)?.orderId as string | undefined;
      const orderNumber = (result as any)?.orderNumber ?? "—";

      const receipt = buildReceipt(submitData, orderNumber);
      setLastReceipt(receipt);

      // Read before clearCart() wipes cart.items/cart.total below.
      trackEvent("purchase", {
        event_category: "pos_order",
        transaction_id: orderNumber,
        value: cart.total,
        currency,
        items: cart.items.map((i: any) => ({
          item_id: i.menuItemId,
          item_name: i.name,
          price: i.unitPrice,
          quantity: i.quantity,
        })),
      });

      cart.clearCart();
      onOpenChange(false);

      finishWithReceipt(
        receipt,
        orderId
          ? {
              orderId,
              customerName: submitData.customerName ?? "",
              customerPhone: submitData.customerPhone ?? null,
            }
          : null
      );
      toast.success(t("pos.checkout.success"));
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
          maxWidth="lg"
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
                        className="flex flex-row gap-4"
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

              {orderType === "DINE_IN" && (
                <FormField
                  control={form.control}
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>{t("pos.checkout.guestCount")}</FormLabel>
                      <FormControl>
                        <GuestCountStepper
                          idPrefix="checkout"
                          value={field.value ?? 1}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>{t("pos.checkout.paymentMethod")}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (value !== "OTHER") form.setValue("paymentNote", "");
                        }}
                        value={field.value === "PAY_LATER" ? "" : field.value}
                        className="space-y-4"
                      >
                        {paymentMethodGroups.map((group) => (
                          <div key={group.key} className="space-y-2">
                            {group.key !== "common" && (
                              <p className="text-muted-foreground text-xs font-semibold uppercase">
                                {t(`pos.checkout.market${capitalize(group.key)}`)}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {group.methods.map((method) => (
                                <PaymentMethodChip
                                  key={method}
                                  idPrefix="checkout-payment"
                                  value={method}
                                  selected={field.value === method}
                                  label={mapPaymentMethodLabel(t, method)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <PaymentMethodChip
                            idPrefix="checkout-payment"
                            value="OTHER"
                            selected={field.value === "OTHER"}
                            label={t("pos.checkout.other")}
                          />
                        </div>
                      </RadioGroup>
                    </FormControl>
                    {field.value === "OTHER" && (
                      <FormField
                        control={form.control}
                        name="paymentNote"
                        render={({ field: noteField }) => (
                          <FormItem>
                            <FormLabel className="sr-only">
                              {t("pos.checkout.customPaymentMethodLabel")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("pos.checkout.customPaymentMethodPlaceholder")}
                                {...noteField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {financeSettings?.payLaterEnabled && (
                      <button
                        type="button"
                        onClick={() => field.onChange("PAY_LATER")}
                        className={cn(
                          "flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium transition-colors",
                          field.value === "PAY_LATER"
                            ? "border-primary bg-primary/10 text-primary"
                            : "text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        )}
                      >
                        <Clock className="h-4 w-4" />
                        {t("pos.checkout.payLater")}
                      </button>
                    )}
                  </FormItem>
                )}
              />

              {paymentMethod === "PAY_LATER" && (
                <div className="bg-muted/20 space-y-1 rounded-md border p-4">
                  <p className="text-sm font-medium">{t("pos.checkout.payLaterNoteTitle")}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("pos.checkout.payLaterNoteDesc")}
                  </p>
                </div>
              )}

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
                      // field.value is what the cashier typed in the store's
                      // display currency — the same units as cart.total, so
                      // no conversion is needed before subtracting.
                      const change = field.value ? Math.max(0, field.value - cart.total) : 0;
                      const isUnderpaid = field.value != null && field.value < cart.total;
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
                        <Input placeholder={t("pos.checkout.customerNamePlaceholder")} {...field} />
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
                        <PhoneInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          defaultCountry="ID"
                        />
                      </FormControl>
                      {["GOPAY", "OVO", "DANA", "SHOPEEPAY", "LINKAJA"].includes(paymentMethod) && (
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

              {/* When ingredients actually leave inventory is not obvious from
                  the till: stock is deducted at DELIVERED, so with the kitchen
                  display on, ringing an order up moves nothing yet. A merchant
                  read that gap as "the POS doesn't deduct at all" and filed it
                  as a bug (production feedback "Ticket id #01"). */}
              <p className="text-muted-foreground text-xs">
                {kdsEnabled
                  ? t("pos.checkout.stockDeductedOnDelivery")
                  : t("pos.checkout.stockDeductedOnPayment")}
              </p>
            </form>
          </Form>
        </FormDialogLayout>
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
