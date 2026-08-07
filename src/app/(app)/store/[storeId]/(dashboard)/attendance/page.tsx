import { redirect } from "next/navigation";

// Attendance (clock-in/out audit log) merged into the unified Schedule
// page's Log & History section — see schedule-log.tsx. Kept as a redirect
// rather than deleted outright so old bookmarks/links don't dead-end.
export default async function AttendancePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  redirect(`/store/${storeId}/schedule`);
}
