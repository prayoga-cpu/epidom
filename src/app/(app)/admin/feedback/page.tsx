import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { AdminFeedbackTable } from "@/features/admin/components/admin-feedback-table";

export const metadata = { title: "Feedback | Admin | Epidom" };

export default async function AdminFeedbackPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, isAdmin: true },
  });

  if (!user || !isAdminUser(user.email, user.isAdmin)) redirect("/stores");

  return <AdminFeedbackTable />;
}
