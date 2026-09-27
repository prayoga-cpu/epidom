import { redirect } from "next/navigation";

// The Owner dashboard became Finance's "All outlets" scope. This route stays
// so bookmarks, old nav cookies and the bare /owner → /go/owner hop still
// land somewhere real; Finance's own layout and page apply the plan and
// staff-access checks, and fall back to this outlet's report for a viewer
// who can't see the roll-up.
export default async function OwnerPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  redirect(`/store/${storeId}/finance?scope=all`);
}
