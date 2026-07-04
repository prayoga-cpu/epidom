import { notFound } from "next/navigation";
import { storefrontService } from "@/lib/services";
import { MyOrdersClient } from "@/features/storefront/components/my-orders-client";
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
    title: `My Orders - ${storefront.displayName} | Epidom`,
  };
}

export default async function MyOrdersPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");

  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);

  if (!storefront || !storefront.isPublished) {
    notFound();
  }

  return (
    <MyOrdersClient
      storefront={{
        slug: storefront.slug,
        displayName: storefront.displayName,
        themeColor: storefront.themeColor,
      }}
    />
  );
}
