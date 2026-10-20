import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { getSalesPageReport } from "@/lib/services/sales-page.service";
import {
  salesPageReportLangSchema,
  salesPageReportRangeParamSchema,
} from "@/lib/validation/sales-page.schemas";
import { resolveReportRange } from "@/lib/report-range";
import { SalesPageReportView } from "@/features/admin/components/sales-page-report";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Sales Pages | Admin | Epidom" };

export default async function AdminSalesPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; lang?: string; from?: string; to?: string }>;
}) {
  await requireAdminSection("sales-pages");

  const { range, lang, from, to } = await searchParams;
  const [report, salesLeads, subscribers] = await Promise.all([
    getSalesPageReport(
      resolveReportRange(salesPageReportRangeParamSchema.parse(range), { from, to }, "30"),
      salesPageReportLangSchema.parse(lang)
    ),
    prisma.salesLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        page: true,
        locale: true,
        source: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        createdAt: true,
      },
    }),
    prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        email: true,
        source: true,
        page: true,
        locale: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <SalesPageReportView
      report={report}
      salesLeads={salesLeads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
      subscribers={subscribers.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
    />
  );
}
