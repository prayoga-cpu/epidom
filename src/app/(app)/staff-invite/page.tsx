import type { Metadata } from "next";
import { StaffInviteClaimForm } from "@/features/auth/staff-invite/components/staff-invite-claim-form";

export const metadata: Metadata = {
  title: "Staff sign-in - EPIDOM",
  robots: { index: false, follow: false },
  // The bearer token is in this page's URL — never leak it in a Referer
  // header to anything the page loads or links to.
  referrer: "no-referrer",
};

export default async function StaffInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <StaffInviteClaimForm token={typeof token === "string" ? token : null} />;
}
