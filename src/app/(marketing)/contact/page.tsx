/**
 * Contact Page
 *
 * Contact information and location map for EPIDOM.
 * Responsive layout: tablet shows 2-column grid, desktop shows extended map.
 *
 * @page
 */

import { ContactInfo } from "@/features/marketing/contact/components/contact-info";
import { generateMetadata as genMeta } from "@/lib/seo";
import { ContactHeader } from "@/features/marketing/contact/components/contact-header";

export const metadata = genMeta({
  title: "Kontak - EPIDOM",
  description:
    "Hubungi tim Epidom. Kami siap membantu warung, kafe, dan resto Indonesia berkembang dengan platform digital.",
  keywords: [
    "kontak epidom",
    "platform F&B Indonesia",
    "dukungan epidom",
    "warung digital",
    "hubungi epidom",
  ],
  openGraph: {
    title: "Kontak - EPIDOM",
    description: "Hubungi tim Epidom untuk pertanyaan seputar platform F&B Indonesia.",
    url: "https://epidom.com/contact",
  },
});

export default function ContactPage() {
  return (
    <main className="w-full overflow-x-hidden bg-bg-warm pt-20 md:pt-24 lg:pt-20">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        {/* Tablet Layout: Header Full Width + 2 Columns */}
        <div className="md:block lg:hidden">
          {/* Header Section - Full Width */}
          <div className="animate-slide-up py-8 md:py-4">
            <ContactHeader />
          </div>

          {/* Content Section - Centered */}
          <div className="flex justify-center pb-8 md:pb-12">
            <div className="animate-slide-up-delayed w-full max-w-lg">
              <ContactInfo />
            </div>
          </div>
        </div>

        {/* Desktop Layout: Centered ContactInfo */}
        <div className="hidden lg:flex lg:justify-center lg:items-start lg:min-h-[calc(100vh-4rem)]">
          <div className="animate-slide-up flex flex-col justify-center h-full w-full max-w-2xl">
            <ContactInfoWithHeader />
          </div>
        </div>
      </div>
    </main>
  );
}

// Desktop version with header inside ContactInfo
function ContactInfoWithHeader() {
  return (
    <div className="py-8 md:py-12 lg:py-8">
      <ContactHeader />
      <ContactInfo />
    </div>
  );
}
