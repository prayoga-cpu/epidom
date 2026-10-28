import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { NewsletterCampaignsView } from "@/features/admin/newsletter/components/newsletter-campaigns-view";

export const metadata = { title: "Newsletter | Admin | Epidom" };

export default async function AdminNewsletterPage() {
  await requireAdminSection("newsletter");
  return <NewsletterCampaignsView />;
}
