import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { NewsletterEditor } from "@/features/admin/newsletter/components/newsletter-editor";

export const metadata = { title: "New newsletter | Admin | Epidom" };

export default async function AdminNewNewsletterPage() {
  await requireAdminSection("newsletter");
  return <NewsletterEditor />;
}
