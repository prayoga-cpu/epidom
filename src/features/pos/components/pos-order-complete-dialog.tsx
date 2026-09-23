"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CircleCheckBig,
  Clipboard,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Printer,
} from "lucide-react";
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
import type { SendReceiptBody } from "@/types/api/cashier";
import { usePrintReceipt } from "../hooks/use-print-receipt";
import { useHasOrderPrinters, usePrintOrder, type OrderPrintInput } from "../hooks/use-print-order";
import {
  deriveEmailReceiptStatus,
  useOrderReceiptSends,
  useSendOrderReceiptEmail,
} from "../hooks/use-order-receipt-sends";
import { ReceiptEmailStatus } from "./receipt-email-status";

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
  /** What the kitchen / bar tickets and labels are built from — lets this screen reprint them. */
  printInput?: OrderPrintInput;
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

/**
 * How long this screen keeps looking for a receipt email that is sending itself.
 * The background job runs a moment after the order is created; past this, "not
 * sent yet" is the honest answer (the job skipped it, or mail isn't set up).
 */
export const AUTO_EMAIL_WAIT_MS = 15_000;

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
  const { printOrder, isPrinting: isPrintingTickets } = usePrintOrder(storeId);
  const hasOrderPrinters = useHasOrderPrinters();

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

        <div className="flex shrink-0 flex-col gap-2 border-t px-5 py-4">
          {/* Only for a shop that has set up a kitchen / bar / label printer. The
              ticket already printed by itself when the order was placed, so this
              is the second copy — for a printer that was off, or a ticket that
              jammed. */}
          {result.printInput && hasOrderPrinters && (
            <Button
              type="button"
              variant="outline"
              className="h-12 touch-manipulation gap-2"
              disabled={isPrintingTickets}
              onClick={() =>
                void printOrder(
                  {
                    ...result.printInput!,
                    context: { ...result.printInput!.context, reprint: true },
                  },
                  { interactive: true }
                )
              }
            >
              {isPrintingTickets ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Clipboard className="size-4" />
              )}
              {isPrintingTickets ? t("pos.print.printing") : t("pos.printers.printTickets")}
            </Button>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
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
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());

  // A paid order that already carries an address (typed on the customer screen,
  // or on their customer record) emails itself. Say so instead of showing "not
  // sent" for the few seconds before it goes, and read the log until it lands.
  const autoEmailTo =
    paid && canSend && EMAIL_RE.test((result.customer?.email ?? "").trim())
      ? (result.customer?.email ?? "").trim()
      : null;
  const [waitingForAuto, setWaitingForAuto] = useState(autoEmailTo !== null);
  useEffect(() => {
    if (!waitingForAuto) return;
    const timer = setTimeout(() => setWaitingForAuto(false), AUTO_EMAIL_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waitingForAuto]);

  const { data: sends } = useOrderReceiptSends(storeId, result.orderId ?? undefined, {
    pollForEmail: waitingForAuto,
  });
  const emailStatus = deriveEmailReceiptStatus(sends);
  useEffect(() => {
    if (emailStatus.state !== "not_sent") setWaitingForAuto(false);
  }, [emailStatus.state]);

  const sendReceiptEmail = useSendOrderReceiptEmail(storeId);
  const sendingEmail = sendReceiptEmail.isPending;

  const failMessage = (error: unknown) =>
    (error instanceof ApiClientError ? error.response.error.message : null) ||
    t("cashierCheckout.complete.sendFailed");

  const sendEmail = async () => {
    if (!result.orderId) return;
    try {
      await sendReceiptEmail.mutateAsync({ orderId: result.orderId, email: email.trim() });
      toast.success(t("cashierCheckout.complete.sentToast"));
    } catch (error) {
      toast.error(failMessage(error));
    }
  };

  const sendWhatsapp = async () => {
    if (!result.orderId) return;
    setSendingWhatsapp(true);
    try {
      const body: SendReceiptBody = { phone };
      await apiClient.post(`/stores/${storeId}/pos/orders/${result.orderId}/send-receipt`, body);
      setWhatsappSent(true);
      toast.success(t("cashierCheckout.complete.sentToast"));
    } catch (error) {
      toast.error(failMessage(error));
    } finally {
      setSendingWhatsapp(false);
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
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 touch-manipulation gap-1.5"
            disabled={!canSend || !emailValid || sendingEmail || sendingWhatsapp}
            onClick={() => void sendEmail()}
          >
            {sendingEmail ? (
              <Loader2 className="size-4 animate-spin" />
            ) : emailStatus.state === "sent" ? (
              <Check className="size-4" />
            ) : (
              <Mail className="size-4" />
            )}
            {emailStatus.state === "sent"
              ? t("cashierCheckout.complete.resendEmail")
              : t("cashierCheckout.complete.sendEmail")}
          </Button>
        </div>

        {/* Whether the emailed receipt actually went out — read from the order's
            send log, so it survives closing and reopening this screen. */}
        {canSend && (
          <ReceiptEmailStatus sends={sends} sendingTo={waitingForAuto ? autoEmailTo : null} />
        )}

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
                setWhatsappSent(false);
              }}
              defaultCountry={defaultPhoneCountry(currency)}
              disabled={!canSend}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 touch-manipulation gap-1.5"
            disabled={!canSend || !phone || sendingWhatsapp || sendingEmail || whatsappSent}
            onClick={() => void sendWhatsapp()}
          >
            {sendingWhatsapp ? (
              <Loader2 className="size-4 animate-spin" />
            ) : whatsappSent ? (
              <Check className="size-4" />
            ) : (
              <MessageCircle className="size-4" />
            )}
            {whatsappSent
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
