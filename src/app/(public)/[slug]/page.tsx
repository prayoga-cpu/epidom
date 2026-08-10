import { cache } from "react";
import { notFound } from "next/navigation";
import { storefrontService } from "@/lib/services";
import { PublicProfile } from "@/features/storefront/components/public-profile";
import { StorefrontStructuredData } from "@/components/seo/structured-data";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getStorefront = cache((slug: string) => storefrontService.getStorefrontBySlug(slug));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");
  const storefront = await getStorefront(cleanSlug);

  if (!storefront) {
    return {
      title: "Store Not Found | Epidom",
    };
  }

  const url = `https://epidom.fr/@${cleanSlug}`;
  const description =
    storefront.description ||
    storefront.tagline ||
    `${storefront.displayName} on Epidom. Lihat menu dan hubungi kami langsung.`;
  const image = storefront.heroImageUrl || storefront.logoUrl;

  return {
    title: `${storefront.displayName} | Epidom Storefront`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: storefront.displayName,
      description,
      url,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: storefront.displayName,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");

  const storefront = await getStorefront(cleanSlug);

  if (!storefront || !storefront.isPublished) {
    notFound();
  }

  // Fetch reservation-enabled tables for this store
  const { prisma } = await import("@/lib/prisma");
  const reservableTables = storefront.acceptsReservations
    ? await prisma.table.findMany({
        where: { storeId: storefront.storeId, reservationEnabled: true },
        select: { id: true, label: true, capacity: true },
        orderBy: { label: "asc" },
      })
    : [];

  // PublicProfile doesn't read menu data at all (it links out to /menu
  // instead) — drop menuCategories rather than passing its raw Prisma rows
  // (including Decimal priceAdjustment/materialQty on product option groups)
  // across the Server->Client boundary just to have them go unused, which is
  // exactly what was crashing with "Decimal objects are not supported."
  const { menuCategories: _menuCategories, ...storefrontWithoutMenu } = storefront;
  const serialized = {
    ...storefrontWithoutMenu,
    reservableTables,
  };

  return (
    <>
      <StorefrontStructuredData
        slug={cleanSlug}
        displayName={storefront.displayName}
        tagline={storefront.tagline}
        description={storefront.description}
        logoUrl={storefront.logoUrl}
        heroImageUrl={storefront.heroImageUrl}
        whatsappNumber={storefront.whatsappNumber}
        instagramUrl={storefront.instagramUrl}
        tiktokUrl={storefront.tiktokUrl}
        googleMapsUrl={storefront.googleMapsUrl}
        openingHours={storefront.openingHours}
      />
      <PublicProfile storefront={serialized as any} />
    </>
  );
}
