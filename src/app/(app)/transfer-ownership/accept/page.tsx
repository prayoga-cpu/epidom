import type { Metadata } from "next";
import { AcceptTransferClient } from "@/features/store-transfer/components/accept-transfer-client";

export const metadata: Metadata = {
  title: "Store ownership transfer - EPIDOM",
  robots: { index: false, follow: false },
  // The bearer token is in this page's URL — never leak it in a Referer
  // header to anything the page loads or links to.
  referrer: "no-referrer",
};

export default async function AcceptTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <AcceptTransferClient token={typeof token === "string" ? token : null} />;
}
