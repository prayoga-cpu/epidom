import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { getSalesPageReport } from "@/lib/services/sales-page.service";
import {
  salesPageReportLangSchema,
  salesPageReportRangeParamSchema,
} from "@/lib/validation/sales-page.schemas";
import { resolveReportRange } from "@/lib/report-range";
import { SalesPageReportView } from "@/features/admin/components/sales-page-report";

export const metadata = { title: "Sales Pages | Admin | Epidom" };

export default async function AdminSalesPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; lang?: string; from?: string; to?: string }>;
}) {
  await requireAdminSection("sales-pages");

  const { range, lang, from, to } = await searchParams;
  const report = await getSalesPageReport(
    resolveReportRange(salesPageReportRangeParamSchema.parse(range), { from, to }, "30"),
    salesPageReportLangSchema.parse(lang)
  );

  return <SalesPageReportView report={report} />;
}
