import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getActiveStaffSession } from "@/lib/staff-session";
import { getStoreViewer } from "@/lib/auth/store-viewer";
import { isWithinNewStoreWindow } from "@/lib/services/setup-progress.service";
import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/features/dashboard/home/components/home-client";

export const metadata: Metadata = {
  title: "Home - Epidom",
  description: "Start here: search, quick actions, recent pages and setup progress.",
};

/**
 * Store Dashboard start page. Open to every member of the store (like Help):
 * it grants nothing itself, each tile is filtered by plan and by the persona's
 * page grants on the client.
 */
export default async function HomePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [staffSession, viewer, store] = await Promise.all([
    getActiveStaffSession(),
    getStoreViewer(storeId),
    prisma.store.findUnique({ where: { id: storeId }, select: { createdAt: true } }),
  ]);

  // Same rule as the Overview page: the checklist is for the owner, or a
  // MANAGER persona on the owner's device.
  const personaRole =
    staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER"
      ? staffSession.role
      : null;
  const showSetupGuide =
    viewer.kind === "owner" && (personaRole === null || personaRole === "MANAGER");
  const isNewStore = store ? isWithinNewStoreWindow(store.createdAt) : false;

  const isOwner = viewer.kind === "owner" && personaRole === null;

  return (
    <HomeClient
      storeId={storeId}
      showSetupGuide={showSetupGuide}
      isOwner={isOwner}
      isNewStore={isNewStore}
    />
  );
}
