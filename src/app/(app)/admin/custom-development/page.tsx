import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { AdminCustomDevelopmentTable } from "@/features/admin/components/admin-custom-development-table";

export const metadata = { title: "Custom Development | Admin | Epidom" };

export default async function AdminCustomDevelopmentPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, isAdmin: true },
  });

  if (!user || !isAdminUser(user.email, user.isAdmin)) redirect("/stores");

  return <AdminCustomDevelopmentTable />;
}
