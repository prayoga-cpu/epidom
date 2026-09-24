import { redirect } from "next/navigation";

// The Shift page is now the Shift tab of POS Mode's Operational page (with My
// Schedule and Clock In / Out). Kept as a redirect rather than deleted so old
// bookmarks and resume cookies don't dead-end; the Operational page does its
// own access check.
export default async function PosModeShiftPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  redirect(`/store/${storeId}/pos/operational?tab=shift`);
}
