import { redirect } from "next/navigation";

// Owner now lives inside the store-scoped shell at
// /store/{storeId}/owner (see (dashboard)/owner/) — this bare route stays
// only so existing bookmarks/shared links don't dead-end. /go/* resolves
// the signed-in user's store server-side and redirects into the real page.
export default function OwnerPage() {
  redirect("/go/owner");
}
