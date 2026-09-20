"use client";

import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import {
  deriveEmailReceiptStatus,
  type OrderReceiptSendRecord,
} from "../hooks/use-order-receipt-sends";

interface ReceiptEmailStatusProps {
  /** The order's send log (most recent first). Undefined while it loads. */
  sends: OrderReceiptSendRecord[] | undefined;
  /**
   * The address a receipt is about to be sent to automatically, while that send
   * is still in flight. Shown as "sending…" instead of "not sent yet" — the
   * background job runs a moment after the order is created, and telling the
   * cashier nothing was sent, seconds before it is, would send them off to do it by hand.
   */
  sendingTo?: string | null;
  className?: string;
}

/**
 * One line answering "did the customer's emailed receipt go out?", shared by the
 * POS complete screen and the order-history detail so both read the same log the
 * same way: sent (to whom, when), failed (and why), on its way, or not sent yet.
 */
export function ReceiptEmailStatus({ sends, sendingTo, className }: ReceiptEmailStatusProps) {
  const { t, formatDateTimeWithTimezone } = useI18n();
  const status = deriveEmailReceiptStatus(sends);

  const sending = status.state === "not_sent" && !!sendingTo;
  const tone = sending
    ? "text-muted-foreground"
    : status.state === "sent"
      ? "text-emerald-600 dark:text-emerald-400"
      : status.state === "failed"
        ? "text-destructive"
        : "text-muted-foreground";

  const recipient = status.state === "not_sent" ? null : status.recipient;
  // Which address it went to: a receipt can be sent more than once, to
  // different addresses, and the status alone wouldn't say which.
  const detail = recipient ? ` (${recipient})` : "";

  let text: string;
  if (sending) {
    text = `${t("pos.receiptEmail.sending")} (${sendingTo})`;
  } else if (status.state === "sent") {
    text = `${t("pos.receiptEmail.sent")}${detail} · ${formatDateTimeWithTimezone(status.at)}`;
  } else if (status.state === "failed") {
    text = `${t("pos.receiptEmail.failed")}${detail}${status.error ? `: ${status.error}` : ""}`;
  } else {
    text = t("pos.receiptEmail.notSent");
  }

  return (
    <p
      role="status"
      data-testid="receipt-email-status"
      data-state={sending ? "sending" : status.state}
      className={cn("flex items-start gap-1.5 text-xs", tone, className)}
    >
      {sending ? (
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : status.state === "sent" ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : status.state === "failed" ? (
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}
