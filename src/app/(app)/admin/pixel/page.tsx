import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { getPixelReport } from "@/lib/services/tracking-event.service";
import { pixelReportRangeParamSchema } from "@/lib/validation/tracking-event.schemas";
import { resolveReportRange } from "@/lib/report-range";
import { META_PIXEL_ID } from "@/components/analytics/tracking-vendors";
import { PixelReportView } from "@/features/admin/components/pixel-report";

export const metadata = { title: "Meta Pixel | Admin | Epidom" };

export default async function AdminPixelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireAdminSection("pixel");

  const { range, from, to } = await searchParams;
  const report = await getPixelReport(
    resolveReportRange(pixelReportRangeParamSchema.parse(range), { from, to }, "7")
  );

  return <PixelReportView report={report} pixelId={META_PIXEL_ID} />;
}
