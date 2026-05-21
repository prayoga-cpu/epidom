import { notFound } from "next/navigation";
import { storefrontService } from "@/lib/services";
import { CheckoutClient } from "@/features/storefront/components/checkout-client";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");
  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);

  if (!storefront) {
    return { title: "Store Not Found | Epidom" };
  }

  return {
    title: `Checkout - ${storefront.displayName} | Epidom`,
    description: `Selesaikan pesanan Anda di ${storefront.displayName}.`,
  };
}

export default async function OrderPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");

  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);

  if (!storefront || !storefront.isPublished) {
    notFound();
  }

  if (!storefront.acceptsOrders) {
    notFound();
  }

  const menuCategories = storefront.menuCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: cat.items
      .filter((i) => i.isAvailable)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        currency: item.currency,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        modifiers: item.modifiers,
      })),
  }));

  return (
    <CheckoutClient
      storefront={{
        id: storefront.id,
        slug: storefront.slug,
        displayName: storefront.displayName,
        themeColor: storefront.themeColor,
        fontFamily: storefront.fontFamily,
        whatsappNumber: storefront.whatsappNumber,
      }}
      menuCategories={menuCategories}
    />
  );
}
