import { requirePartnerPage } from "@/lib/auth/require-admin-page";
import { getMyPartnerDashboard, partnerPageChoices } from "@/lib/services/partner.service";
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
  const [dashboard, choices] = await Promise.all([
    getMyPartnerDashboard(partnerId, salesPageReportRangeSchema.parse(range)),
    partnerPageChoices(access.viewablePartnerIds),
  ]);
  return (
    <MyReferrals
      dashboard={dashboard}
      readOnly={readOnly}
      partnerId={partnerId}
      choices={choices}
    />
  );
}
