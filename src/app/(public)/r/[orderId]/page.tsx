import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildReceiptData } from "@/lib/receipts/build-receipt-data";
import { ReceiptView } from "./receipt-view";
import { ReceiptPrintButton } from "./receipt-print-button";

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title: `Struk ${orderId.slice(-6).toUpperCase()} | Epidom`,
  };
}

/**
 * Public, unauthenticated receipt/invoice view — the destination for the
 * WhatsApp "Detailnya kami cantumkan di sini ya" link and the "View Receipt"
 * action in order history / storefront order status. Same trust model as
 * the existing `(public)/[slug]/order/[orderId]` status page: an
 * unguessable cuid is the only gate. Deliberately NOT nested under a
 * storefront slug — walk-in POS orders have no storefrontId, so this route
 * works for both order sources.
 */
export default async function ReceiptPage({ params }: PageProps) {
  const { orderId } = await params;
  const built = await buildReceiptData(orderId);
  if (!built) notFound();

  return (
    <div className="bg-muted/30 flex min-h-[calc(100vh/var(--app-zoom,1))] flex-col items-center gap-4 px-4 py-8 print:bg-white print:p-0">
      <div className="print:hidden">
        <ReceiptPrintButton />
      </div>
      <ReceiptView receipt={built.receipt} />
    </div>
  );
}
