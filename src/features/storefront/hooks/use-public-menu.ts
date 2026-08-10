"use client";

import { useQuery } from "@tanstack/react-query";
import { serializeProductOptionGroups } from "@/lib/utils/menu-item-options";

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  modifiers: unknown;
  product: { optionGroups: ReturnType<typeof serializeProductOptionGroups> } | null;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

/**
 * Polls the public storefront menu so a customer who already has the page
 * open sees a merchant's price/availability/option changes without a manual
 * reload — this data is customer-facing (unlike most of the dashboard) but
 * doesn't need sub-5s freshness the way POS/Tables do, so a light interval
 * keeps server load sane. Checkout still re-validates price/availability
 * server-side regardless, so this is a UX improvement, not a correctness
 * dependency.
 */
export function usePublicStorefrontMenu(slug: string, initialCategories?: PublicMenuCategory[]) {
  return useQuery<PublicMenuCategory[]>({
    queryKey: ["public-storefront-menu", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/storefront/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error("Failed to fetch menu");
      const json = await res.json();
      const storefront = json?.data;
      const categories: any[] = storefront?.menuCategories ?? [];
      // Same source the initial server render uses (storefront.service.ts's
      // getStorefrontBySlug) — the store's live resolved currency, not a
      // per-item snapshot, so a currency change in Fees & Taxes settings is
      // reflected here too.
      const currency: string = storefront?.store?.currency ?? "IDR";

      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        items: (cat.items ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          currency,
          imageUrl: item.imageUrl,
          isAvailable: item.isAvailable,
          isFeatured: item.isFeatured,
          modifiers: item.modifiers,
          product: item.product
            ? { optionGroups: serializeProductOptionGroups(item.product?.optionGroups) }
            : null,
        })),
      }));
    },
    initialData: initialCategories,
    enabled: !!slug,
    staleTime: 20 * 1000,
    refetchInterval: 45 * 1000,
    // A customer's phone shouldn't keep polling in the background once they
    // switch apps/tabs — unlike staff-facing screens, battery/data cost here
    // is a real, direct concern.
    refetchIntervalInBackground: false,
  });
}
