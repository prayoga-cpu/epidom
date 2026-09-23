import { ContactPageClient } from "@/features/marketing/contact/components/contact-page-client";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("contact");

export default function ContactPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <ContactPageClient />
    </main>
  );
}
