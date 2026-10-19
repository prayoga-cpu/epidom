import { requirePartnerPage } from "@/lib/auth/require-admin-page";
import {
  getMyPartnerDashboard,
  getOwnBankDetails,
  partnerPageChoices,
} from "@/lib/services/partner.service";
import { prisma } from "@/lib/prisma";
import { salesPageReportRangeSchema } from "@/lib/validation/sales-page.schemas";
import { MyReferrals } from "@/features/referrals/portal/my-referrals";

export const metadata = { title: "My referrals | Epidom" };

/**
 * A partner's own page, or one this account may see read-only (a viewer added
 * by an admin: it sees what the partner sees and earns nothing).
 */
export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; partner?: string }>;
}) {
  const { range, partner } = await searchParams;
  const { access, partnerId, readOnly } = await requirePartnerPage(partner);
  const [dashboard, choices, business, bankDetails] = await Promise.all([
    getMyPartnerDashboard(partnerId, salesPageReportRangeSchema.parse(range)),
    partnerPageChoices(access.viewablePartnerIds),
    prisma.business.findUnique({ where: { userId: access.user.id }, select: { id: true } }),
    // Where they're paid: on their own page only, never a read-only viewer's.
    readOnly ? Promise.resolve(null) : getOwnBankDetails(partnerId),
  ]);
  return (
    <MyReferrals
      dashboard={dashboard}
      readOnly={readOnly}
      partnerId={partnerId}
      choices={choices}
      // An invited partner with no store of their own has nowhere to go "back" to.
      backHref={business ? "/stores" : null}
      bankDetails={bankDetails}
    />
  );
}
