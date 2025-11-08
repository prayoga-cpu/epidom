"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialsSection } from "@/features/dashboard/data/materials/components/materials-section";
import { RecipesSection } from "../recipes/components/recipes-section";
import { ProductsSection } from "../products/components/products-section";
import { SuppliersSection } from "../suppliers/components/suppliers-section";
import { useI18n } from "@/components/lang/i18n-provider";

export function DataView() {
  const { t } = useI18n();

  return (
    <Tabs defaultValue="materials" className="grid min-h-[calc(100vh-150px)] w-full gap-6">
      <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto rounded-lg p-1.5 px-1.5 whitespace-nowrap shadow-sm backdrop-blur-sm">
        <TabsTrigger
          className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
          value="materials"
        >
          {t("pages.materialsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
          value="recipes"
        >
          {t("pages.recipesList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
          value="products"
        >
          {t("pages.productsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card shrink-0 transition-all data-[state=active]:shadow-md"
          value="suppliers"
        >
          {t("pages.suppliersList")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="materials">
        <MaterialsSection />
      </TabsContent>
      <TabsContent value="recipes">
        <RecipesSection />
      </TabsContent>
      <TabsContent value="products">
        <ProductsSection />
      </TabsContent>
      <TabsContent value="suppliers">
        <SuppliersSection />
      </TabsContent>
    </Tabs>
  );
}
