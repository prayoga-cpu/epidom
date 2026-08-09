"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { ReceiptDocument } from "@/components/shared/receipt-document";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";

/**
 * Overrides the server-resolved `receipt.locale` (the store owner's
 * Business.locale) with the viewer's own language preference — the same
 * `useI18n()` cookie/localStorage value the POS checkout dialog and the
 * receipt-settings preview already use as "the user's language". Business
 * .locale isn't tied to any language switcher in the app, so it's only a
 * reasonable fallback for the very first (pre-hydration) paint here, not the
 * source of truth once the client takes over.
 */
export function ReceiptView({ receipt }: { receipt: ReceiptData }) {
  const { locale } = useI18n();
  return <ReceiptDocument data={{ ...receipt, locale }} className="print:shadow-none" />;
}
