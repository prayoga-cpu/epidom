"use client";

import { useState } from "react";
import { Check, CircleCheckBig, Clock, Loader2, Mail, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn } from "@/lib/utils";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";
import type { SendReceiptBody, SendReceiptEmailBody } from "@/types/api/cashier";
import { usePrintReceipt } from "../hooks/use-print-receipt";

export interface OrderCompleteResult {
  /** null for an order queued offline — it has no server id (and no receipt page) until it syncs. */
  orderId: string | null;
  orderNumber: string;
  total: number;
  /** Cash change owed, or null when the sale had no cash hand-over to make change from. */
  change: number | null;
  /** "Cash", "QRIS", or "Cash €10.00 · QRIS €5.00" for a split. */
  paymentSummary: string;
  receipt: ReceiptData;
  /** Prefills the two send fields. Any part may be missing. */
  customer?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  /** False for a Pay Later order, which is placed but not yet paid. Default true. */
  paid?: boolean;
}

interface PosOrderCompleteDialogProps {
  open: boolean;
  storeId: string;
  result: OrderCompleteResult;
  onNewSale: () => void;
  /** Overrides the primary button's text (e.g. "Next bill" between split bills). */
  newSaleLabel?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Default calling-code country for the WhatsApp field, from the store's own market. */
function defaultPhoneCountry(currency: string): string {
  if (currency === "EUR") return "FR";
  if (currency === "USD") return "US";
  return "ID";
}

/**
 * The screen after a sale (Moka's "send receipt" step): the money, the change to
 * hand back, ways to get the customer their receipt, and one big button for the
 * next sale.
 *
 * It only closes through its own buttons — not on Escape or an outside tap — so a
 * stray touch while the cashier is counting out change can't dismiss the very
 * number they are reading off it. SMS is deliberately not offered (no provider).
 */
export function PosOrderCompleteDialog({
  open,
  storeId,
  result,
  onNewSale,
  newSaleLabel,
}: PosOrderCompleteDialogProps) {
  const { t } = useI18n();
  const { print, isPrinting } = usePrintReceipt();

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // 90dvh/app-zoom (not vh): iOS Safari's vh ignores the toolbar, and CSS
        // zoom on <html> does not scale viewport units — see AGENTS.md.
        className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("cashierCheckout.complete.title")}</DialogTitle>
          <DialogDescription>{result.orderNumber}</DialogDescription>
        </DialogHeader>

        {/* Keyed by order so a later sale never inherits the last one's typed address. */}
        <CompleteBody key={result.orderNumber} storeId={storeId} result={result} />

        <div className="flex shrink-0 flex-col gap-2 border-t px-5 py-4 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-12 touch-manipulation gap-2 sm:flex-1"
            disabled={isPrinting}
            onClick={() => void print(result.receipt)}
          >
            {isPrinting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            {isPrinting ? t("pos.print.printing") : t("pos.print.confirm")}
          </Button>
          <Button
            type="button"
            className="h-12 touch-manipulation text-base font-semibold sm:flex-[1.4]"
            onClick={onNewSale}
          >
            {newSaleLabel ?? t("cashierCheckout.complete.newSale")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompleteBody({ storeId, result }: { storeId: string; result: OrderCompleteResult }) {
  const { t } = useI18n();
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  // Literal in the store's display currency — never IDR-converted.
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const paid = result.paid !== false;
  const canSend = !!result.orderId;

  const [email, setEmail] = useState(result.customer?.email ?? "");
  const [phone, setPhone] = useState<string | undefined>(result.customer?.phone ?? undefined);
  const [sending, setSending] = useState<"email" | "whatsapp" | null>(null);
  const [sent, setSent] = useState<{ email: boolean; whatsapp: boolean }>({
    email: false,
    whatsapp: false,
  });

  const emailValid = EMAIL_RE.test(email.trim());

  const send = async (channel: "email" | "whatsapp") => {
    if (!result.orderId) return;
    setSending(channel);
    try {
      if (channel === "email") {
        const body: SendReceiptEmailBody = { email: email.trim() };
        await apiClient.post(
          `/stores/${storeId}/pos/orders/${result.orderId}/send-receipt-email`,
          body
        );
      } else {
        const body: SendReceiptBody = { phone };
        await apiClient.post(`/stores/${storeId}/pos/orders/${result.orderId}/send-receipt`, body);
      }
      setSent((s) => ({ ...s, [channel]: true }));
      toast.success(t("cashierCheckout.complete.sentToast"));
    } catch (error) {
      const serverMessage = error instanceof ApiClientError ? error.response.error.message : null;
      toast.error(serverMessage || t("cashierCheckout.complete.sendFailed"));
    } finally {
      setSending(null);
    }
  };

  return (
    // min-h-0 on this scroll region: it is a flex item of the dialog column, and
    // without it the browser refuses to shrink it below its content — the footer
    // buttons would be pushed off-screen instead of this area scrolling.
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-6 pb-4">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span
          className={cn(
            "mb-1 flex size-16 items-center justify-center rounded-full",
            paid
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          )}
        >
          {paid ? <CircleCheckBig className="size-9" /> : <Clock className="size-9" />}
        </span>
        <p className="text-2xl font-bold tabular-nums">
          {paid
            ? t("cashierCheckout.complete.paid").replace("{amount}", formatPrice(result.total))
            : t("cashierCheckout.complete.orderPlaced")}
        </p>
        <p className="text-muted-foreground text-sm">
          {t("cashierCheckout.complete.orderNumber").replace("{number}", result.orderNumber)}
        </p>
      </div>

      {result.change !== null ? (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-4 text-center">
          <p className="text-muted-foreground text-sm font-medium">{t("pos.checkout.change")}</p>
          <p
            data-testid="complete-change"
            className="text-5xl font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400"
          >
            {formatPrice(result.change)}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border px-4 py-3 text-center">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            {paid
              ? t("cashierCheckout.complete.paymentLabel")
              : t("cashierCheckout.complete.amountDue")}
          </p>
          <p data-testid="complete-summary" className="mt-0.5 text-base font-semibold">
            {paid ? result.paymentSummary : formatPrice(result.total)}
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        <p className="text-sm font-medium">{t("cashierCheckout.complete.sendReceipt")}</p>

        <div className="flex items-center gap-2">
          <Input
            type="email"
            inputMode="email"
            autoComplete="off"
            aria-label={t("cashierCheckout.complete.emailLabel")}
            placeholder={t("cashierCheckout.complete.emailPlaceholder")}
            className="h-11 min-w-0 flex-1"
            value={email}
            disabled={!canSend}
            onChange={(e) => {
              setEmail(e.target.value);
              setSent((s) => ({ ...s, email: false }));
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 touch-manipulation gap-1.5"
            disabled={!canSend || !emailValid || sending !== null || sent.email}
            onClick={() => void send("email")}
          >
            {sending === "email" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : sent.email ? (
              <Check className="size-4" />
            ) : (
              <Mail className="size-4" />
            )}
            {sent.email
              ? t("cashierCheckout.complete.sent")
              : t("cashierCheckout.complete.sendEmail")}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* PhoneInput doesn't forward aria-label/placeholder to its <input>, so the
              group carries the accessible name. flex-1 on this wrapper (not w-full
              on the input) so the Send button keeps its own width. */}
          <div
            role="group"
            aria-label={t("cashierCheckout.complete.whatsappLabel")}
            className="min-w-0 flex-1"
          >
            <PhoneInput
              value={phone ?? ""}
              onChange={(value) => {
                setPhone(value);
                setSent((s) => ({ ...s, whatsapp: false }));
              }}
              defaultCountry={defaultPhoneCountry(currency)}
              disabled={!canSend}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 touch-manipulation gap-1.5"
            disabled={!canSend || !phone || sending !== null || sent.whatsapp}
            onClick={() => void send("whatsapp")}
          >
            {sending === "whatsapp" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : sent.whatsapp ? (
              <Check className="size-4" />
            ) : (
              <MessageCircle className="size-4" />
            )}
            {sent.whatsapp
              ? t("cashierCheckout.complete.sent")
              : t("cashierCheckout.complete.sendWhatsapp")}
          </Button>
        </div>

        {!canSend && (
          <p className="text-muted-foreground text-xs">
            {t("cashierCheckout.complete.offlineHint")}
          </p>
        )}
      </div>
    </div>
  );
}
