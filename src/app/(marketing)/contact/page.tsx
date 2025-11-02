import { ContactInfo } from "@/features/marketing/contact/components/contact-info";
import { ContactMap } from "@/features/marketing/contact/components/contact-map";
import { generateMetadata as genMeta } from "@/lib/seo";
import { ContactHeader } from "@/features/marketing/contact/components/contact-header";

export const metadata = genMeta({
  title: "Contact Us - EPIDOM",
  description:
    "Get in touch with EPIDOM. Whether you're a potential client, interested in our food inventory management services, or have questions, we're here to help.",
  keywords: [
    "contact EPIDOM",
    "food inventory management support",
    "restaurant software contact",
    "customer support",
    "EPIDOM help",
  ],
  openGraph: {
    title: "Contact Us - EPIDOM",
    description: "Get in touch with EPIDOM for questions about our food inventory management solution.",
    url: "https://epidom.com/contact",
  },
});

export default function ContactPage() {
  return (
    <main
      className="bg-white pt-24 md:pt-32"
      style={{ color: "var(--color-brand-primary)" }}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        {/* Tablet Layout: Header Full Width + 2 Columns */}
        <div className="md:block lg:hidden">
          {/* Header Section - Full Width */}
          <div className="animate-slide-up py-8 md:py-4">
            <ContactHeader />
          </div>

          {/* Content Section - 2 Columns */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6 pb-8 md:pb-12">
            <div className="animate-slide-up-delayed">
            <ContactInfo />
          </div>
            <div className="animate-slide-up-delayed">
              <ContactMap />
            </div>
          </div>
        </div>

        {/* Desktop Layout: Original - Grid 2 Columns with ContactInfo containing header */}
        <div className="hidden lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:pb-16">
          <div className="animate-slide-up">
            <ContactInfoWithHeader />
          </div>
          <div className="animate-slide-up-delayed flex items-center justify-center h-full pt-8 lg:pt-16">
            <ContactMap />
          </div>
        </div>
      </div>
    </main>
  );
}

// Desktop version with header inside ContactInfo
function ContactInfoWithHeader() {
  return (
    <div className="py-8 md:py-12 lg:py-16">
      <ContactHeader />
      <ContactInfo />
    </div>
  );
}
