import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { NewsletterBroadcastView } from "@/features/admin/components/newsletter-broadcast-view";

export const metadata = { title: "Newsletter | Admin | Epidom" };

export default async function AdminNewsletterPage() {
  await requireAdminSection("newsletter");
  return <NewsletterBroadcastView />;
}
