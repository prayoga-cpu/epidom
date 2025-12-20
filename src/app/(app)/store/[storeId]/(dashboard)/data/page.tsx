import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  fetchMaterialsForPage,
  fetchRecipesForPage,
  fetchProductsForPage,
  fetchSuppliersForPage,
} from "@/lib/server/data-fetchers";
import { DataViewClient } from "@/features/dashboard/data/components/data-view-client";
import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import type { RecipeWithIngredients } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type { Product } from "@/features/dashboard/data/products/hooks/use-products";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";

export default async function DataPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch initial data for all tabs in parallel for better performance
  const [materialsResult, recipesResult, productsResult, suppliersResult] = await Promise.all([
    fetchMaterialsForPage(storeId),
    fetchRecipesForPage(storeId),
    fetchProductsForPage(storeId),
    fetchSuppliersForPage(storeId),
  ]);

  return (
    <DataViewClient
      initialMaterials={materialsResult.materials}
      initialRecipes={recipesResult.recipes}
      initialProducts={productsResult.products}
      initialSuppliers={suppliersResult.suppliers}
      storeId={storeId}
    />
  );
}
