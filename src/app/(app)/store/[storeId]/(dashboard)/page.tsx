import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDefaultLanding } from "@/lib/last-visited";

/**
 * Store index. `/store/{storeId}` had no page at all, so every link that
 * dropped the section — a shared URL trimmed by hand, a bookmark saved
 * mid-refactor, the store picker's own href — 404'd on a store the user
 * legitimately owns.
 *
 * It resolves to the same place the /go launcher would: the section the user
 * nominated as their landing page. Ownership of `storeId` is already settled
 * by the (dashboard) layout above (it redirects a store the user doesn't own
 * to /stores), so this only has to answer "which section".
 */
export default async function StoreIndexPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { defaultLanding: true },
  });

  redirect(`/store/${storeId}/${normalizeDefaultLanding(user?.defaultLanding)}`);
}
