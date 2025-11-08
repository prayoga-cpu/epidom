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
      <TabsList className="bg-muted/50 grid h-auto w-full max-w-full grid-cols-2 gap-2 rounded-lg p-2 shadow-sm backdrop-blur-sm md:inline-flex md:h-9 md:max-w-none md:grid-cols-none md:justify-start md:gap-0 md:p-1.5">
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="materials"
        >
          {t("pages.materialsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="recipes"
        >
          {t("pages.recipesList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
          value="products"
        >
          {t("pages.productsList")}
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:bg-card h-10 w-full min-w-0 justify-center truncate px-2 text-xs transition-all data-[state=active]:shadow-md md:h-[calc(100%-1px)] md:w-auto md:min-w-fit md:px-3 md:text-sm"
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
