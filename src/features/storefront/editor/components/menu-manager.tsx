"use client";

import { useQuery } from "@tanstack/react-query";
import { storefrontApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuEditor } from "./menu-editor";

interface MenuManagerProps {
  storeId: string;
}

/**
 * Fetches the store's storefront (for its menu categories/items) and renders
 * MenuEditor. Shared by the Storefront "Menu" tab and the standalone POS+
 * "/menu" page so both surfaces edit the exact same MenuItem/MenuCategory data.
 */
export function MenuManager({ storeId }: MenuManagerProps) {
  const {
    data: storefront,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["storefront", storeId],
    queryFn: () => storefrontApi.getStorefront(storeId),
  });

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full rounded-xl" />;
  }

  return (
    <MenuEditor
      storeId={storeId}
      storefrontId={storefront?.id}
      categories={storefront?.menuCategories || []}
      onSuccess={() => refetch()}
    />
  );
}
