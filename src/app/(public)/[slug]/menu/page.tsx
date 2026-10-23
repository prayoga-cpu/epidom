import { notFound } from "next/navigation";
import { PublicMenu } from "@/features/storefront/components/public-menu";
import { isBuildYourOwnItem, serializeProductOptionGroups } from "@/lib/utils/menu-item-options";
import { MenuStructuredData } from "@/components/seo/structured-data";
import { storefrontRobots } from "@/features/storefront/lib/indexing";
import {
  cleanStorefrontSlug,
  getPublicStorefront,
  storefrontLocaleOf,
} from "@/features/storefront/lib/public-storefront";
import {
  storefrontMenuDescription,
  storefrontMenuTitle,
} from "@/features/storefront/lib/storefront-metadata";
import { OG_LOCALE } from "@/lib/seo";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = cleanStorefrontSlug(slug);
  const storefront = await getPublicStorefront(cleanSlug);

  if (!storefront) {
    return {
      title: "Store Not Found | Epidom",
    };
  }

  // In the store's language, naming real dishes: they are what people search.
  const locale = storefrontLocaleOf(storefront);
  const facts = {
    displayName: storefront.displayName,
    city: storefront.store.city,
    acceptsOrders: storefront.acceptsOrders,
  };
  const itemNames = storefront.menuCategories
    .flatMap((c) => c.items)
    .filter((i) => i.isAvailable)
    .map((i) => i.name);
  const url = `https://epidom.fr/@${cleanSlug}/menu`;
  const title = storefrontMenuTitle(facts, locale);
  const description = storefrontMenuDescription(facts, itemNames, locale);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: storefrontRobots(storefront),
    openGraph: { title, description, url, type: "website", locale: OG_LOCALE[locale] },
  };
}

export default async function MenuPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = cleanStorefrontSlug(slug);

  const storefront = await getPublicStorefront(cleanSlug);

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
      buildYourOwn: isBuildYourOwnItem(item, item.product),
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
