import { redirect } from "next/navigation";

// The Owner dashboard became Finance's "All outlets" scope. This bare route
// stays only so existing bookmarks/shared links don't dead-end: /go/* resolves
// the signed-in user's store server-side and carries ?scope=all onto
// /store/{storeId}/finance. (It used to go to /go/owner, which is no longer a
// launchable section and would have fallen back to the default landing page.)
export default function OwnerPage() {
  redirect("/go/finance?scope=all");
}
