"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePosCart } from "../hooks/use-pos-cart";
import { useFinanceSettings } from "@/features/dashboard/profile/hooks/use-finance-settings";
import { useReceiptSettings } from "@/features/dashboard/profile/hooks/use-receipt-settings";
import { useKdsSettings } from "../hooks/use-kds-settings";
import {
  clearCustomerPhone,
  markCustomerDisplayPaid,
  useCustomerPhone,
} from "../hooks/use-customer-display";
import { paymentMethodEnum } from "@/lib/validation/pos.schemas";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { Dialog } from "@/components/ui/dialog";
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
import { DecimalInput } from "@/components/shared/decimal-input";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { WifiOff, Loader2, Clock } from "lucide-react";
import { enqueueOrder } from "@/lib/pwa/offline-queue";
import { isPrinterConnected, type ReceiptData } from "@/lib/pwa/thermal-printer";
import { RECEIPT_INTL_LOCALE } from "@/lib/receipts/receipt-labels";
import {
  normalizeTenders,
  type TenderInput,
  type TenderMethod,
} from "@/lib/finance/order-payments";
import type { PosOrderCreatedDto } from "@/types/api/cashier";
import { usePrinterSettings } from "../hooks/use-printer-settings";
import { usePrintReceipt } from "../hooks/use-print-receipt";
import { useLastReceipt, type LastReceiptMeta } from "../hooks/use-last-receipt";
import { PaymentMethodChip } from "./payment-method-chip";
import { PosCashPresets } from "./pos-cash-presets";
import { PosTenderList, makeDraftTender } from "./pos-tender-list";
import { PosOrderCompleteDialog, type OrderCompleteResult } from "./pos-order-complete-dialog";
import { mapPaymentMethodLabel, orderPaymentMethodGroups } from "../lib/order-status-display";
import {
  buildCheckoutPayload,
  cashChangeOf,
  settledPaymentFromServer,
  type CheckoutDiscountInput,
  type CheckoutPayment,
} from "../lib/checkout-payload";
import { getCurrencyDecimals } from "../lib/currency-decimals";
import type { CartItem, DraftTender } from "../types/pos.types";
import type { PaymentMethod } from "@prisma/client";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const round2 = (n: number) => Math.round(n * 100) / 100;

const BANK_CODES = ["BNI", "BRI", "MANDIRI", "PERMATA"] as const;

/**
 * What a by-items split bill is priced from instead of the whole cart — the
 * PosSplitBillDialog builds one per bill. `splitGroupId` ties the bills of one
 * split together; `guestCount` is set on Bill 1 only, so the table's pax is
 * counted once.
 */
export interface CheckoutBasis {
  items: CartItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason: string | null;
  total: number;
  splitGroupId?: string;
  guestCount?: number | null;
}

interface PosCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName?: string;
  cashierName?: string;
  shiftId?: string;
  /**
   * Price and pay this instead of the cart (one bill of a split-by-items). With a
   * basis the dialog sends `splitGroupId`, leaves the cart and the customer
   * display untouched, and calls `onPaid` once the order is created.
   */
  basis?: CheckoutBasis;
  onPaid?: () => void;
  /** Called when the cashier dismisses the order-complete screen (New Sale / Next bill). */
  onDone?: () => void;
  /** Replaces the dialog title (e.g. "Bill 2 — Confirm Payment"). */
  title?: string;
}

/** Only the fields that are still the dialog's own; order type, pax, table, customer and discount live in the cart. */
const makeFormSchema = (t: (key: string) => string) =>
  z
    .object({
      paymentMethod: paymentMethodEnum,
      amountTendered: z.number().optional(),
      bankCode: z.enum(BANK_CODES).optional(),
      notes: z.string().optional(),
      paymentNote: z.string().max(200).optional(),
    })
    .refine((data) => data.paymentMethod !== "OTHER" || !!data.paymentNote?.trim(), {
      message: t("pos.checkout.customPaymentMethodRequired"),
      path: ["paymentNote"],
    });

type CheckoutFormValues = z.infer<ReturnType<typeof makeFormSchema>>;

const toTenderInput = (row: DraftTender): TenderInput => ({
  method: row.method,
  amount: row.amount ?? 0,
  amountTendered: row.method === "CASH" ? row.amountTendered : null,
  note: row.note,
});

export function PosCheckoutDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  cashierName,
  shiftId,
  basis,
  onPaid,
  onDone,
  title,
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
  const decimals = getCurrencyDecimals(currency);
  const cart = usePosCart();
  const { data: financeSettings } = useFinanceSettings(storeId);
  const { data: receiptSettings } = useReceiptSettings(storeId);
  // Drives the "when does stock move" hint at the bottom of the form. Defaults
  // to the kitchen-display-on wording while the setting loads, since that is
  // the deferred (and more surprising) of the two behaviours.
  const kdsEnabled = useKdsSettings(storeId).data?.kitchenDisplayEnabled ?? true;
  const autoPrint = usePrinterSettings((s) => s.autoPrint);
  const paperWidth = usePrinterSettings((s) => s.paperWidth);
  const { print } = usePrintReceipt();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState<{
    result: OrderCompleteResult;
    /** A split bill with more bills still to pay — the screen's button says "Next bill", not "New Sale". */
    nextBill: boolean;
  } | null>(null);

  // What this dialog charges: the cart, or — for one bill of a split-by-items —
  // that bill's own lines and totals.
  const priced = basis
    ? {
        items: basis.items,
        subtotal: basis.subtotal,
        tax: basis.tax,
        serviceCharge: basis.serviceCharge,
        discountAmount: basis.discountAmount,
        discountReason: basis.discountReason,
        total: basis.total,
      }
    : {
        items: cart.items,
        subtotal: cart.subtotal,
        tax: cart.tax,
        serviceCharge: cart.serviceCharge,
        discountAmount: cart.discountAmount,
        discountReason: cart.discountReason,
        total: cart.total,
      };
  const total = priced.total;

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
  // The same list, flattened, for the split-payment rows. CASH until settings load.
  const flatMethods = paymentMethodGroups.flatMap((g) => g.methods) as TenderMethod[];
  const tenderMethods: TenderMethod[] = flatMethods.length > 0 ? flatMethods : ["CASH"];
  const defaultMethod: TenderMethod = tenderMethods.includes("CASH") ? "CASH" : tenderMethods[0];

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(makeFormSchema(t)),
    defaultValues: {
      paymentMethod: defaultMethod,
      amountTendered: undefined,
      bankCode: "BNI",
      notes: "",
      paymentNote: "",
    },
  });

  // useWatch (not form.watch) so this component reliably re-renders when the
  // payment method changes (shows/hides the cash vs. bank-transfer section).
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  // Only used to gate the Confirm button below — the live Change/error text
  // next to the input itself is computed from that FormField's own
  // field.value directly, not from this, so it can never lag a keystroke.
  const amountTendered = useWatch({ control: form.control, name: "amountTendered" });

  // Split payment: rows live in the cart store (persisted, so a reload doesn't
  // lose them) — except for a split-by-items bill, whose rows are its own.
  // Seeded from the store so a dialog that MOUNTS already open over waiting draft
  // rows doesn't flash the single-method form first; reopening is handled by the
  // effect below.
  const [splitMode, setSplitMode] = useState(() => open && !basis && cart.draftTenders.length > 0);
  const [billTenders, setBillTenders] = useState<DraftTender[]>([]);
  const tenders = basis ? billTenders : cart.draftTenders;
  const setTenders = basis ? setBillTenders : cart.setDraftTenders;

  // A fresh sale must not inherit the last one's payment method, tendered
  // amount or note (the dialog stays mounted between sales), and reopening with
  // draft tender rows — the equal-split flow pre-fills them — lands straight in
  // split-payment mode.
  useEffect(() => {
    if (!open) return;
    form.reset({
      paymentMethod: defaultMethod,
      amountTendered: undefined,
      bankCode: "BNI",
      notes: "",
      paymentNote: "",
    });
    setSplitMode(!basis && usePosCart.getState().draftTenders.length > 0);
    setBillTenders([]);
    // Deliberately keyed on `open` alone: re-running when settings or the cart
    // change would wipe what the cashier is in the middle of entering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The store's payment settings arrive after the dialog can already be open; if
  // the default (CASH) turns out not to be accepted here, fall back to what is.
  useEffect(() => {
    if (!open || flatMethods.length === 0) return;
    const current = form.getValues("paymentMethod");
    if (current === "PAY_LATER" || current === "OTHER") return;
    if (!flatMethods.includes(current as TenderMethod)) {
      form.setValue("paymentMethod", defaultMethod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flatMethods.join(",")]);

  // A number the customer typed on the customer-facing screen, if one is open.
  // It is only a fallback for the order's phone: an attached customer's own
  // number always wins, and it is cleared once the order is placed so the next
  // customer never inherits it.
  const displayPhone = useCustomerPhone((state) => state.phone);

  const onToggleSplit = (on: boolean) => {
    setSplitMode(on);
    if (on) {
      // A single-method choice can't carry into split mode: PAY_LATER has no
      // tender, and a half-typed "Other" label would fail the hidden form's
      // validation with no field on screen to blame.
      form.setValue("paymentMethod", defaultMethod);
      form.setValue("paymentNote", "");
      form.setValue("amountTendered", undefined);
      if (tenders.length === 0) {
        setTenders([
          makeDraftTender(defaultMethod),
          makeDraftTender(tenderMethods[1] ?? defaultMethod),
        ]);
      }
    } else {
      setTenders([]);
    }
  };

  // A bill discounted to nothing (100% off) takes no payment: the server writes no
  // payment row for it, so the payment area is skipped and the cashier just
  // confirms — requiring a tender here would make it impossible to ring up.
  const isFree = total <= 0;
  const tendersCheck =
    splitMode && !isFree ? normalizeTenders(total, tenders.map(toTenderInput)) : null;
  const tendersError = tendersCheck && !tendersCheck.ok ? tendersCheck.error : null;
  const isCashUnderpaid =
    !splitMode &&
    !isFree &&
    paymentMethod === "CASH" &&
    (amountTendered == null || round2(amountTendered) < round2(total));
  const cannotSubmit =
    isSubmitting || priced.items.length === 0 || isCashUnderpaid || (splitMode && !!tendersError);

  // Order type, pax, table and customer are owned by the cart; the dialog just
  // reads them back to the cashier so nothing is charged blind.
  const guests = basis ? basis.guestCount : cart.guestCount;
  const customerLabel = cart.customer?.name || cart.customer?.phone || displayPhone || null;
  const summary = [
    cart.orderType === "DINE_IN" ? t("pos.checkout.dineIn") : t("pos.checkout.takeaway"),
    cart.orderType === "DINE_IN" && guests
      ? t("cashierCheckout.summary.pax").replace("{count}", String(guests))
      : null,
    cart.tableNumber ? `${t("pos.checkout.table")} ${cart.tableNumber}` : null,
    customerLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const buildReceipt = (args: {
    orderNumber: string;
    payment: CheckoutPayment;
    notes: string | undefined;
    /** What was really charged — the server's figure once it has answered. */
    total: number;
    discountAmount: number;
    change: number | null;
  }): ReceiptData => {
    const { orderNumber, payment, notes } = args;
    const single = payment.kind === "single" ? payment : null;
    return {
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
      date: new Intl.DateTimeFormat(RECEIPT_INTL_LOCALE[locale] ?? "en-US", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),
      items: priced.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.lineTotal,
        optionNames: i.modifiers.map((m) => m.optionName),
        notes: i.notes,
      })),
      subtotal: priced.subtotal,
      tax: priced.tax > 0 ? priced.tax : undefined,
      taxLabel: financeSettings?.taxLabel ?? undefined,
      serviceCharge: priced.serviceCharge > 0 ? priced.serviceCharge : undefined,
      discountAmount: args.discountAmount > 0 ? args.discountAmount : undefined,
      discountReason: priced.discountReason ?? undefined,
      total: args.total,
      // "OTHER" alone tells the customer nothing — print what the cashier
      // actually typed instead. A split prints one line per tender instead.
      paymentMethod: single
        ? single.method === "OTHER" && single.paymentNote
          ? single.paymentNote
          : single.method
        : "SPLIT",
      amountTendered: single?.method === "CASH" ? (single.amountTendered ?? undefined) : undefined,
      change: single ? (args.change ?? undefined) : undefined,
      payments:
        payment.kind === "split"
          ? payment.tenders.map((tender) => ({
              method: tender.method === "OTHER" && tender.note ? tender.note : tender.method,
              amount: tender.amount,
              ...(tender.amountTendered != null ? { amountTendered: tender.amountTendered } : {}),
              ...(tender.change != null ? { change: tender.change } : {}),
            }))
          : undefined,
      cashierName,
      tableLabel: cart.tableNumber || undefined,
      notes: notes || undefined,
      width: paperWidth,
    };
  };

  const paymentSummaryOf = (payment: CheckoutPayment): string => {
    if (payment.kind === "split") {
      return payment.tenders
        .map((tender) => {
          const label =
            tender.method === "OTHER" && tender.note
              ? tender.note
              : mapPaymentMethodLabel(t, tender.method);
          return `${label} ${formatPrice(tender.amount)}`;
        })
        .join(" · ");
    }
    if (payment.method === "PAY_LATER") return t("pos.checkout.payLater");
    if (payment.method === "OTHER" && payment.paymentNote) return payment.paymentNote;
    return mapPaymentMethodLabel(t, payment.method);
  };

  // Called on every successful order (any payment method, offline queue).
  // Silently auto-prints when the cashier has both opted in and
  // already paired a printer this session — pairing itself needs a live
  // click (Web Bluetooth's requestDevice requires user activation), so it
  // can't be triggered from here; the order-complete screen's Print button is
  // the manual path.
  const finishWithReceipt = (receipt: ReceiptData, meta: LastReceiptMeta | null) => {
    // Shared across the app (not just this dialog's local state) so the
    // printer menu's "Reprint Last Order" action can offer it later, even
    // after this dialog closes. `meta` is null for an offline-queued order
    // — it has no server-assigned id yet, so there's no /r/[orderId] link
    // to send until it syncs.
    if (meta) useLastReceipt.getState().setLastReceipt(receipt, meta);
    if (autoPrint && isPrinterConnected()) void print(receipt);
  };

  const onSubmit = async (values: CheckoutFormValues) => {
    setIsSubmitting(true);
    try {
      const offline = !navigator.onLine;

      // amountTendered is typed by the cashier in the store's display
      // currency — same units as the total and every menu item price, none of
      // which are converted anywhere in this flow (see pos-order-builder.ts).
      // The server compares/subtracts it against charges.total directly, so it
      // must be submitted as-is.
      let payment: CheckoutPayment;
      if (splitMode && !isFree) {
        const check = normalizeTenders(total, tenders.map(toTenderInput));
        if (!check.ok) {
          toast.error(check.error.message);
          return;
        }
        payment = { kind: "split", tenders: check.tenders };
      } else if (isFree) {
        // Nothing to collect. The schema still wants a method; the server records
        // no payment row for a zero total, so Cash is just the neutral default.
        payment = { kind: "single", method: "CASH" };
      } else {
        payment = {
          kind: "single",
          method: values.paymentMethod,
          amountTendered: values.amountTendered,
          paymentNote: values.paymentNote,
          bankCode: values.bankCode,
        };
      }

      // A split bill's discount is its own flat share; the server must not
      // re-price a preset against a fraction of the cart.
      const discount: CheckoutDiscountInput = basis
        ? {
            source: null,
            primaryAmount: 0,
            totalAmount: basis.discountAmount,
            totalReason: basis.discountReason,
            redeemPoints: 0,
            flat: { amount: basis.discountAmount, reason: basis.discountReason },
          }
        : {
            source: cart.discountSource,
            primaryAmount: cart.primaryDiscountAmount,
            totalAmount: cart.discountAmount,
            totalReason: cart.discountReason,
            redeemPoints: cart.pointsRedeemed,
          };

      const payload = buildCheckoutPayload({
        items: priced.items,
        orderType: cart.orderType,
        guestCount: basis ? (basis.guestCount ?? null) : cart.guestCount,
        tableNumber: cart.tableNumber,
        customer: cart.customer,
        fallbackPhone: displayPhone,
        notes: values.notes ?? "",
        // The offline queue never carried the shift (it may be closed by the time
        // the order replays); keep queued payloads exactly as they always were.
        shiftId: offline ? undefined : shiftId,
        splitGroupId: basis?.splitGroupId,
        discount,
        payment,
        offline,
      });

      // Everything the success path needs from the cart, read BEFORE it is
      // cleared or (for a split bill) has this bill's lines taken out.
      const customerSnapshot = cart.customer
        ? { name: cart.customer.name, phone: cart.customer.phone, email: cart.customer.email }
        : displayPhone
          ? { name: null, phone: displayPhone, email: null }
          : null;
      const finishSale = (args: {
        orderId: string | null;
        orderNumber: string;
        /** The server's answer (online only) — preferred over anything computed here. */
        server?: Partial<PosOrderCreatedDto> & { paymentStatus?: string };
      }) => {
        const { server } = args;
        // What the server says settled the bill beats a client-side recompute: a
        // preset / coupon / points discount is re-priced there, and a tender may be
        // rounded, so the screen and the paper must show the ledger's figures.
        const settled = settledPaymentFromServer(server?.payments, payment);
        const finalTotal = typeof server?.total === "number" ? server.total : total;
        const finalDiscount =
          typeof server?.discountAmount === "number"
            ? server.discountAmount
            : priced.discountAmount;
        const change =
          server && server.change !== undefined ? server.change : cashChangeOf(settled, finalTotal);
        const paid = server?.paymentStatus
          ? server.paymentStatus === "PAID"
          : !(payment.kind === "single" && payment.method === "PAY_LATER");

        const receipt = buildReceipt({
          orderNumber: args.orderNumber,
          payment: settled,
          notes: values.notes,
          total: finalTotal,
          discountAmount: finalDiscount,
          change,
        });
        const result: OrderCompleteResult = {
          orderId: args.orderId,
          orderNumber: args.orderNumber,
          total: finalTotal,
          change: isFree ? null : change,
          paymentSummary: isFree
            ? t("cashierCheckout.complete.noPaymentDue")
            : paymentSummaryOf(settled),
          receipt,
          customer: customerSnapshot,
          paid,
        };

        if (basis) {
          // The cart keeps the unpaid bills; the split dialog takes this one's
          // lines out of it.
          onPaid?.();
        } else {
          // Before clearCart(), which wipes the total this reads.
          markCustomerDisplayPaid(args.orderNumber, finalTotal);
          // This customer's number must not survive onto the next order.
          clearCustomerPhone();
          cart.clearCart();
        }
        onOpenChange(false);

        finishWithReceipt(
          receipt,
          args.orderId
            ? {
                orderId: args.orderId,
                customerName: payload.customerName ?? "",
                customerPhone: payload.customerPhone ?? null,
              }
            : null
        );
        setCompleted({
          result,
          // Read after onPaid: by now the bill's lines are out of the cart.
          nextBill: !!basis && usePosCart.getState().items.length > 0,
        });
      };

      if (offline) {
        if (cart.resumingOrderId && !basis) {
          // The offline queue always creates a brand-new order on reconnect —
          // it has no concept of finalizing an existing HELD row, so queuing
          // here would leave the original held order dangling and create a
          // duplicate. Block it instead, same as Hold does when offline.
          toast.error(t("pos.cart.holdOffline"));
          return;
        }

        const localId = await enqueueOrder(storeId, payload);
        finishSale({ orderId: null, orderNumber: `OFFLINE-${localId.slice(0, 8).toUpperCase()}` });
        toast(t("pos.offline.queued"), {
          description: t("pos.offline.queuedDesc"),
          icon: <WifiOff className="h-4 w-4" />,
        });
        return;
      }

      // A bill of a split-by-items is always a brand-new order: finalizing a
      // resumed HELD order would settle ALL of its lines, not this bill's.
      const endpoint =
        cart.resumingOrderId && !basis
          ? `/stores/${storeId}/pos/orders/${cart.resumingOrderId}/finalize`
          : `/stores/${storeId}/pos/orders`;

      const created = await apiClient.post<
        Partial<PosOrderCreatedDto> & { paymentStatus?: string }
      >(endpoint, payload);
      const orderId = created?.orderId;
      const orderNumber = created?.orderNumber ?? "—";

      // Read before the cart is cleared below.
      trackEvent("purchase", {
        event_category: "pos_order",
        transaction_id: orderNumber,
        // What was actually charged: the server re-prices preset/coupon/points.
        value: typeof created?.total === "number" ? created.total : total,
        currency,
        items: priced.items.map((i) => ({
          item_id: i.menuItemId ?? "custom",
          item_name: i.name,
          price: i.unitPrice,
          quantity: i.quantity,
        })),
      });

      finishSale({ orderId: orderId ?? null, orderNumber, server: created ?? undefined });
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

  const tenderHint = tendersError
    ? tendersError.code === "SUM_MISMATCH" || tendersError.code === "EMPTY"
      ? null
      : t(`cashierCheckout.tender.err.${tendersError.code}`)
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <FormDialogLayout
          title={title ?? t("pos.checkout.title")}
          maxWidth="lg"
          footer={
            <>
              {/* h-11 (44px, not the Button default's 36px): the spec's own
                  floor for POS Mode, and this is its single most emphasized
                  control (docs/dashboard-revamp.md's wireframe calls out the
                  "Bayar" button by name) — not left to the shared dialog
                  footer's unstyled default. */}
              <Button
                type="button"
                variant="outline"
                className="h-11"
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
                className="h-11"
                disabled={cannotSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pos.checkout.processing")}
                  </>
                ) : (
                  `${t("pos.checkout.confirm")} • ${formatPrice(total)}`
                )}
              </Button>
            </>
          }
        >
          <Form {...form}>
            <form
              id="pos-checkout-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm" data-testid="checkout-summary">
                  {summary}
                </p>
                <div className="bg-muted/30 flex items-baseline justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-muted-foreground text-sm">
                    {t("cashierCheckout.totalDue")}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">{formatPrice(total)}</span>
                </div>
              </div>

              {isFree ? (
                <div className="bg-muted/20 space-y-1 rounded-md border p-4">
                  <p className="text-sm font-medium">{t("cashierCheckout.freeOrder.title")}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("cashierCheckout.freeOrder.desc")}
                  </p>
                </div>
              ) : (
                /* Tap target is the whole row, not just the small switch. */
                <label
                  htmlFor="checkout-split-toggle"
                  className="flex min-h-11 cursor-pointer touch-manipulation items-center justify-between gap-3 rounded-md border px-3 py-1.5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {t("cashierCheckout.split.toggle")}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {t("cashierCheckout.split.toggleHint")}
                    </span>
                  </span>
                  <Switch
                    id="checkout-split-toggle"
                    checked={splitMode}
                    onCheckedChange={onToggleSplit}
                    disabled={isSubmitting}
                  />
                </label>
              )}

              {isFree ? null : splitMode ? (
                <div className="space-y-2">
                  <PosTenderList
                    total={total}
                    tenders={tenders}
                    onChange={setTenders}
                    methods={tenderMethods}
                    currency={currency}
                    decimals={decimals}
                    formatPrice={formatPrice}
                  />
                  {tenderHint && (
                    <p className="text-destructive text-xs font-medium">{tenderHint}</p>
                  )}
                </div>
              ) : (
                <>
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
                                    className="h-11"
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
                              "flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium transition-colors",
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
                          // display currency — the same units as the total, so
                          // no conversion is needed before subtracting.
                          const change = field.value ? Math.max(0, field.value - total) : 0;
                          const isUnderpaid = field.value != null && field.value < total;
                          return (
                            <>
                              <FormItem>
                                <FormLabel>{t("pos.checkout.amountTendered")}</FormLabel>
                                <div className="relative">
                                  <span className="text-muted-foreground absolute top-3 left-3 text-sm">
                                    {getCurrencySymbol(currency)}
                                  </span>
                                  {/* FormControl wraps the input itself (not the div around
                                      it) so the label's htmlFor lands on a real input. */}
                                  <FormControl>
                                    <DecimalInput
                                      decimals={2}
                                      min={0}
                                      placeholder="0"
                                      className="h-11 pl-8 text-lg font-medium"
                                      value={field.value}
                                      onChange={field.onChange}
                                      onBlur={field.onBlur}
                                      name={field.name}
                                      ref={field.ref}
                                    />
                                  </FormControl>
                                </div>
                              </FormItem>
                              <PosCashPresets
                                total={total}
                                currency={currency}
                                value={field.value}
                                formatPrice={formatPrice}
                                onSelect={(amount) =>
                                  form.setValue("amountTendered", amount, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                }
                              />
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
                          <FormLabel>{t("cashierCheckout.chooseBank")}</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                            >
                              {BANK_CODES.map((bank) => (
                                <PaymentMethodChip
                                  key={bank}
                                  idPrefix="checkout-bank"
                                  value={bank}
                                  selected={field.value === bank}
                                  label={bank}
                                />
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

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

      {/* Rendered here (not by the caller) so it outlives this dialog closing:
          the sale is already recorded and the cart cleared by the time it shows. */}
      {completed && (
        <PosOrderCompleteDialog
          open
          storeId={storeId}
          result={completed.result}
          newSaleLabel={completed.nextBill ? t("cashierCheckout.complete.nextBill") : undefined}
          onNewSale={() => {
            setCompleted(null);
            onDone?.();
          }}
        />
      )}
    </>
  );
}
