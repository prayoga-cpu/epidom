"use client";

import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintReportShellProps {
  title: string;
  storeName: string;
  generatedAt: string;
  /** Shown under the store/account block, e.g. "Filters applied" or a date-range summary. */
  subtitle?: ReactNode;
  children: ReactNode;
}

/**
 * Shared branded shell for every printable/PDF-exportable report page
 * (Schedule, Attendance, ...), factored out of the original
 * OrderHistoryPrintView so every export gets the same Epidom header,
 * repeating diagonal watermark, and repeating footer — not a one-off look
 * per feature. Auto-triggers the browser print dialog on mount; "export to
 * PDF" for these reports means "print → Save as PDF," matching how
 * OrderHistoryPrintView already works, rather than a separate jsPDF
 * pipeline that would have to re-implement this same branding by hand.
 */
export function PrintReportShell({
  title,
  storeName,
  generatedAt,
  subtitle,
  children,
}: PrintReportShellProps) {
  const { t, formatDateTime } = useI18n();

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="print-report min-h-screen bg-white text-black print:bg-white">
      {/* Diagonal watermark — repeats behind the content, very low opacity so it never
          interferes with reading the table. Fixed so it also appears on every printed page. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden print:fixed"
      >
        <span
          className="text-8xl font-black whitespace-nowrap text-black/[0.04]"
          style={{ transform: "rotate(-30deg)" }}
        >
          {storeName} · {storeName} · {storeName}
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-8 py-8 print:px-0 print:py-0">
        {/* Non-printing toolbar */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <p className="text-sm text-gray-500">{t("pos.printReport.toolbarHint")}</p>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t("pos.printReport.printAgain")}
          </Button>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <EpidomMark size={36} />
            <div>
              <p className="text-lg font-bold tracking-wide text-black">EPIDOM</p>
              <p className="text-sm text-gray-800">{title}</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-700">
            <p>{t("pos.printReport.generatedAt")}</p>
            <p className="font-medium text-black">{formatDateTime(generatedAt)}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold tracking-wide text-gray-700 uppercase">
            {t("pos.printReport.storeLabel")}
          </p>
          <p className="font-semibold text-black">{storeName}</p>
        </div>

        {subtitle && (
          <div className="mb-6 rounded border border-gray-300 bg-gray-50 p-3 text-xs print:bg-gray-50">
            {subtitle}
          </div>
        )}

        {children}

        {/* Spacer so content doesn't sit under the fixed print footer */}
        <div className="h-16 print:block" />
      </div>

      {/* Repeating print footer */}
      <div className="hidden border-t border-gray-300 bg-white px-8 py-2 text-[10px] text-gray-800 print:fixed print:right-0 print:bottom-0 print:left-0 print:flex print:items-center print:justify-between">
        <span>
          {t("pos.printReport.systemBy")} · {storeName}
        </span>
        <span>{t("pos.printReport.poweredBy")}</span>
      </div>
    </div>
  );
}
