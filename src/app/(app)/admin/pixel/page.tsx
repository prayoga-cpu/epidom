import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
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
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, isAdmin: true },
  });

  if (!user || !isAdminUser(user.email, user.isAdmin)) redirect("/stores");

  const { range } = await searchParams;
  const report = await getPixelReport(pixelReportRangeSchema.parse(range));

  return <PixelReportView report={report} pixelId={META_PIXEL_ID} />;
}
