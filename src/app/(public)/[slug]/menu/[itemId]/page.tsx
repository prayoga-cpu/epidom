import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicItemDetail } from "@/features/storefront/components/public-item-detail";
import { isBuildYourOwnItem, serializeProductOptionGroups } from "@/lib/utils/menu-item-options";
import { storefrontRobots } from "@/features/storefront/lib/indexing";
import {
  cleanStorefrontSlug,
  getPublicStorefront,
  storefrontLocaleOf,
} from "@/features/storefront/lib/public-storefront";
import { storefrontItemDescription } from "@/features/storefront/lib/storefront-metadata";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string; itemId: string }>;
}

// One lookup per request, shared by generateMetadata and the page — they used
// to run the same `where` back to back. Metadata only reads name/description,
// so the page's richer shape serves both.
const getStorefrontItem = cache((storefrontId: string, itemId: string) =>
  prisma.menuItem.findFirst({
    where: {
      id: itemId,
      storefrontId,
    },
    include: {
      product: {
        select: {
          productLine: true,
          buildYourOwn: true,
          optionGroups: {
            orderBy: { displayOrder: "asc" },
            // Name and price only: the stock link stays server-side.
            include: {
              options: {
                orderBy: { displayOrder: "asc" },
                select: { name: true, priceAdjustment: true },
              },
            },
          },
        },
      },
    },
  })
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, itemId } = await params;
  const cleanSlug = cleanStorefrontSlug(slug);
  const storefront = await getPublicStorefront(cleanSlug);

  if (!storefront) {
    return { title: "Store Not Found | Epidom" };
  }

  const item = await getStorefrontItem(storefront.id, itemId);

  if (!item) {
    return { title: `Item Not Found | ${storefront.displayName}` };
  }

  return {
    title: `${item.name} - ${storefront.displayName} | Epidom`,
    description:
      item.description ||
      storefrontItemDescription(item.name, storefront.displayName, storefrontLocaleOf(storefront)),
    robots: storefrontRobots(storefront),
  };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { slug, itemId } = await params;
  const cleanSlug = cleanStorefrontSlug(slug);

  const storefront = await getPublicStorefront(cleanSlug);

  if (!storefront || !storefront.isPublished) {
    notFound();
  }

  const item = await getStorefrontItem(storefront.id, itemId);

  if (!item) {
    notFound();
  }

  // Cast item and storefront data for serializability
  const castItem = {
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    currency: storefront.store.currency,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    modifiers: item.modifiers,
    isCustom: item.product?.productLine === "CUSTOM",
    buildYourOwn: isBuildYourOwnItem(item, item.product),
    product: item.product
      ? { optionGroups: serializeProductOptionGroups(item.product.optionGroups) }
      : null,
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
