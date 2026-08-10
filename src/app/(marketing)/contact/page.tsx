import { generateMetadata } from "@/lib/seo";
import { ContactPageClient } from "@/features/marketing/contact/components/contact-page-client";

export const metadata = generateMetadata({
  title: "Contact — EPIDOM",
  description:
    "Get in touch with the Epidom team. We're here to help F&B businesses get started, upgrade, or just ask a question.",
  canonical: "https://epidom.fr/contact",
  openGraph: {
    title: "Contact Epidom",
    description: "Reach the Epidom team via email, WhatsApp, or our contact form.",
    url: "https://epidom.fr/contact",
  },
});

export default function ContactPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <ContactPageClient />
    </main>
  );
}
