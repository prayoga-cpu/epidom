import { notFound } from "next/navigation";
import { storefrontService } from "@/lib/services";
import { PublicProfile } from "@/features/storefront/components/public-profile";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");
  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);
  
  if (!storefront) {
    return {
      title: "Store Not Found | Epidom",
    };
  }
  
  return {
    title: `${storefront.displayName} | Epidom Storefront`,
    description: storefront.description || `${storefront.displayName} on Epidom. Lihat menu dan hubungi kami langsung.`,
  };
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");
  
  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);
  
  if (!storefront || !storefront.isPublished) {
    notFound();
  }
  
  return <PublicProfile storefront={storefront} />;
}
