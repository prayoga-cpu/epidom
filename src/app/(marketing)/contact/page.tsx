import type { Metadata } from "next";
import { ContactPageClient } from "@/features/marketing/contact/components/contact-page-client";

export const metadata: Metadata = {
  title: "Contact — EPIDOM",
  description:
    "Get in touch with the Epidom team. We're here to help F&B businesses get started, upgrade, or just ask a question.",
  openGraph: {
    title: "Contact EPIDOM",
    description: "Reach the Epidom team via email, WhatsApp, or our contact form.",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <ContactPageClient />
    </main>
  );
}
