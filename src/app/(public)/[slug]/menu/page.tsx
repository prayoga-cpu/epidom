import { notFound } from "next/navigation";
import { storefrontService } from "@/lib/services";
import { PublicMenu } from "@/features/storefront/components/public-menu";
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
    title: `Menu - ${storefront.displayName} | Epidom Storefront`,
    description: `Lihat menu makanan dan minuman dari ${storefront.displayName} dan pesan langsung lewat WhatsApp.`,
  };
}

export default async function MenuPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");
  
  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);
  
  if (!storefront || !storefront.isPublished) {
    notFound();
  }
  
  // Cast menu categories with items
  const menuCategories = storefront.menuCategories.map(cat => ({
    id: cat.id,
    name: cat.name,
    items: cat.items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      currency: item.currency,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      modifiers: item.modifiers,
    }))
  }));

  // Create cast storefront data
  const storefrontData = {
    id: storefront.id,
    slug: storefront.slug,
    displayName: storefront.displayName,
    whatsappNumber: storefront.whatsappNumber,
    themeColor: storefront.themeColor,
    fontFamily: storefront.fontFamily,
  };

  return <PublicMenu storefront={storefrontData} menuCategories={menuCategories} />;
}
