import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { getPixelReport } from "@/lib/services/tracking-event.service";
import { pixelReportRangeSchema } from "@/lib/validation/tracking-event.schemas";
import { META_PIXEL_ID } from "@/components/analytics/tracking-vendors";
import { PixelReportView } from "@/features/admin/components/pixel-report";

export const metadata = { title: "Meta Pixel | Admin | Epidom" };

export default async function AdminPixelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdminSection("pixel");

  const { range } = await searchParams;
  const report = await getPixelReport(pixelReportRangeSchema.parse(range));

  return <PixelReportView report={report} pixelId={META_PIXEL_ID} />;
}
