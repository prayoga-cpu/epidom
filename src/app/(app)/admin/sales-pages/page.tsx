import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
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
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, isAdmin: true },
  });

  if (!user || !isAdminUser(user.email, user.isAdmin)) redirect("/stores");

  const { range, lang } = await searchParams;
  const report = await getSalesPageReport(
    salesPageReportRangeSchema.parse(range),
    salesPageReportLangSchema.parse(lang)
  );

  return <SalesPageReportView report={report} />;
}
