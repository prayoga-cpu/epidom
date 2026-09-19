import { redirect } from "next/navigation";

// Shifts (POS till cash sessions) merged into the unified Schedule page —
// see schedule-log.tsx's Log tab (Cash In/Out rows). Opening and finishing a
// till now lives on POS Mode's own Shift page (/pos/shift), not here. Kept as a
// redirect rather than deleted outright so old bookmarks/links don't dead-end.
export default async function ShiftsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  redirect(`/store/${storeId}/schedule`);
}
