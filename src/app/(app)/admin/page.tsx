import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";

export const metadata = { title: "Admin Panel | Epidom" };

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/stores");
  }
  return <AdminDashboard />;
}
