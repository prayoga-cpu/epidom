import { notFound } from "next/navigation";
import { storefrontService } from "@/lib/services";
import { PublicMenu } from "@/features/storefront/components/public-menu";
import { serializeProductOptionGroups } from "@/lib/utils/menu-item-options";
import { MenuStructuredData } from "@/components/seo/structured-data";
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

  const url = `https://epidom.fr/@${cleanSlug}/menu`;
  const description = `View the menu from ${storefront.displayName} and order directly via WhatsApp.`;

  return {
    title: `Menu - ${storefront.displayName} | Epidom Storefront`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${storefront.displayName} Menu`, description, url, type: "website" },
  };
}

export default async function MenuPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");

  const storefront = await storefrontService.getStorefrontBySlug(cleanSlug);

  if (!storefront || !storefront.isPublished) {
    notFound();
  }

  // The store's live resolved currency, not each item's persisted currency
  // snapshot — the latter goes stale the moment the owner changes it in
  // Fees & Taxes settings, since nothing re-saves existing menu items at that point.
  const ownerCurrency = storefront.store.currency;

  // Cast menu categories with items
  const menuCategories = storefront.menuCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: cat.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      currency: ownerCurrency,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      modifiers: item.modifiers,
      isCustom: item.product?.productLine === "CUSTOM",
      product: item.product
        ? { optionGroups: serializeProductOptionGroups(item.product.optionGroups) }
        : null,
    })),
  }));

  // Create cast storefront data
  const storefrontData = {
    id: storefront.id,
    slug: storefront.slug,
    displayName: storefront.displayName,
    whatsappNumber: storefront.whatsappNumber,
    themeColor: storefront.themeColor,
    fontFamily: storefront.fontFamily,
    acceptsReservations: storefront.acceptsReservations,
    // Heading for the optional second product line's own section (e.g.
    // "Hair Salon"). Null when the store doesn't run one.
    customProductsLabel: storefront.store.customProductsLabel,
  };

  return (
    <>
      <MenuStructuredData
        slug={cleanSlug}
        displayName={storefront.displayName}
        categories={menuCategories}
      />
      <PublicMenu storefront={storefrontData} menuCategories={menuCategories} />
    </>
  );
}
