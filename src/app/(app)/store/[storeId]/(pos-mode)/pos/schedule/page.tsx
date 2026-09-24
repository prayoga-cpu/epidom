import { redirect } from "next/navigation";

// My Schedule is now the Schedule tab of POS Mode's Operational page (with the
// Shift and Clock In / Out). Kept as a redirect rather than deleted: "/pos/schedule"
// is still the permission key that grants that tab, a staff landing page
// (STAFF_HOME_PAGES) and a /go launch target, and old cookies hold the URL.
export default async function PosModeSchedulePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  redirect(`/store/${storeId}/pos/operational?tab=schedule`);
}
