import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { RevenueDashboard } from "@/features/admin/components/revenue-dashboard";

export const metadata = { title: "Revenue Report | Epidom" };

export default async function RevenuePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, isAdmin: true },
  });

  if (!user || !isAdminUser(user.email, user.isAdmin)) redirect("/stores");

  return <RevenueDashboard />;
}
