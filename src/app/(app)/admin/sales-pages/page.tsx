import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { getSalesPageReport } from "@/lib/services/sales-page.service";
import {
  salesPageReportLangSchema,
  salesPageReportRangeSchema,
} from "@/lib/validation/sales-page.schemas";
import { SalesPageReportView } from "@/features/admin/components/sales-page-report";

export const metadata = { title: "Sales Pages | Admin | Epidom" };

export default async function AdminSalesPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; lang?: string }>;
}) {
  await requireAdminSection("sales-pages");

  const { range, lang } = await searchParams;
  const report = await getSalesPageReport(
    salesPageReportRangeSchema.parse(range),
    salesPageReportLangSchema.parse(lang)
  );

  return <SalesPageReportView report={report} />;
}
