import { notFound } from "next/navigation";
import { storefrontService } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { PublicItemDetail } from "@/features/storefront/components/public-item-detail";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string; itemId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, itemId } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");
  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);

  if (!storefront) {
    return { title: "Store Not Found | Epidom" };
  }

  const item = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      storefrontId: storefront.id,
    },
  });

  if (!item) {
    return { title: `Item Not Found | ${storefront.displayName}` };
  }

  return {
    title: `${item.name} - ${storefront.displayName} | Epidom`,
    description:
      item.description ||
      `Pesan ${item.name} dari ${storefront.displayName} langsung via WhatsApp.`,
  };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { slug, itemId } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");

  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);

  if (!storefront || !storefront.isPublished) {
    notFound();
  }

  const item = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      storefrontId: storefront.id,
    },
  });

  if (!item) {
    notFound();
  }

  // Cast item and storefront data for serializability
  const castItem = {
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    currency: item.currency,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    modifiers: item.modifiers,
  };

  const storefrontData = {
    id: storefront.id,
    slug: storefront.slug,
    displayName: storefront.displayName,
    themeColor: storefront.themeColor,
    fontFamily: storefront.fontFamily,
  };

  return <PublicItemDetail storefront={storefrontData} item={castItem} />;
}
