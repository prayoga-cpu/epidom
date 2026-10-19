import { requirePartnerPage } from "@/lib/auth/require-admin-page";
import { getMyPartnerDashboard, getOwnBankDetails } from "@/lib/services/partner.service";
import { prisma } from "@/lib/prisma";
import { salesPageReportRangeParamSchema } from "@/lib/validation/sales-page.schemas";
import { resolveReportRange } from "@/lib/report-range";
import { MyReferrals } from "@/features/referrals/portal/my-referrals";

export const metadata = { title: "My referrals | Epidom" };

/** A partner's own page: their link, sales pages, customers and commission. */
export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { range, from, to } = await searchParams;
  const { access, partnerId } = await requirePartnerPage();
  const [dashboard, business, bankDetails] = await Promise.all([
    getMyPartnerDashboard(
      partnerId,
      resolveReportRange(salesPageReportRangeParamSchema.parse(range), { from, to }, "30")
    ),
    prisma.business.findUnique({ where: { userId: access.user.id }, select: { id: true } }),
    getOwnBankDetails(partnerId),
  ]);
  return (
    <MyReferrals
      dashboard={dashboard}
      // An invited partner with no store of their own has nowhere to go "back" to.
      backHref={business ? "/stores" : null}
      bankDetails={bankDetails}
    />
  );
}
