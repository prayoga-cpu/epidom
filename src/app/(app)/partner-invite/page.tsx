import type { Metadata } from "next";
import { PartnerInviteClient } from "@/features/referrals/invite/partner-invite-client";

export const metadata: Metadata = {
  title: "Partner invitation - EPIDOM",
  robots: { index: false, follow: false },
  // The bearer token is in this page's URL: never leak it in a Referer.
  referrer: "no-referrer",
};

export default async function PartnerInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <PartnerInviteClient token={typeof token === "string" ? token : null} />;
}
