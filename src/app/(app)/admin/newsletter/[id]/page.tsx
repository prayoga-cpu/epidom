import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { NewsletterEditor } from "@/features/admin/newsletter/components/newsletter-editor";

export const metadata = { title: "Newsletter | Admin | Epidom" };

export default async function AdminNewsletterCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSection("newsletter");
  const { id } = await params;
  return <NewsletterEditor campaignId={id} />;
}
