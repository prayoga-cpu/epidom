import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { AdminFeedbackTable } from "@/features/admin/components/admin-feedback-table";

export const metadata = { title: "Feedback | Admin | Epidom" };

export default async function AdminFeedbackPage() {
  await requireAdminSection("feedback");

  return <AdminFeedbackTable />;
}
