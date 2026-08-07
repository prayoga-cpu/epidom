import { redirect } from "next/navigation";

// Shifts (POS till cash sessions) merged into the unified Schedule page —
// see schedule-log.tsx's Log tab (Cash In/Out rows) and my-schedule-list.tsx
// (the staff self-service Cash In/Cash Out action). Kept as a redirect
// rather than deleted outright so old bookmarks/links don't dead-end.
export default async function ShiftsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  redirect(`/store/${storeId}/schedule`);
}
