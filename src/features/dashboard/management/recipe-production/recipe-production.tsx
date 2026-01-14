"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, PlayCircle, Clock, Package, AlertCircle, ChefHat } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { StartProductionDialog } from "./start-production-dialog";
import { ProductionBatchCard } from "./production-batch-card";
import { MaterialAvailabilityCheck } from "./material-availability-check";
import { formatCurrency } from "@/lib/utils/formatting";
import {
  useRecipes,
  RecipeWithIngredients,
} from "@/features/dashboard/data/recipes/hooks/use-recipes";
import { useProductionBatches } from "./hooks/use-production-batches";
import { useCurrency } from "@/components/providers/currency-provider";
import { hasMaterialStockChanged } from "./utils/recipe-helpers";
import { getTranslatedCategory } from "@/features/dashboard/data/recipes/utils/category-helpers";
import { convertStockToIngredientUnit } from "@/lib/utils/unit-conversion";

export function RecipeProductionCard() {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const storeId = params?.storeId as string;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithIngredients | null>(null);
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);

  // Fetch recipes from API
  const { data: recipesData, isLoading: recipesLoading } = useRecipes(storeId, {
    sortBy: "name",
    sortOrder: "asc",
    skip: 0,
    take: 100,
  });

  // Memoize the updated recipe to avoid unnecessary recalculations
  const updatedRecipe = useMemo(() => {
    if (selectedRecipe?.id && recipesData?.recipes) {
      return recipesData.recipes.find((r) => r.id === selectedRecipe.id);
    }
    return null;
  }, [selectedRecipe?.id, recipesData?.recipes]);

  // Update selectedRecipe when material stock changes
  // This ensures the selected recipe always has the latest material stock data
  useEffect(() => {
    if (updatedRecipe && hasMaterialStockChanged(selectedRecipe, updatedRecipe)) {
      setSelectedRecipe(updatedRecipe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedRecipe]); // Only depend on updatedRecipe to avoid infinite loops

  // Memoize filters to prevent unnecessary cache invalidation
  const batchFilters = useMemo(
    () => ({
      status: ["IN_PROGRESS", "PLANNED"] as const,
      recipeId: selectedRecipe?.id,
      sortBy: "scheduledDate" as const,
      sortOrder: "asc" as const,
      skip: 0,
      take: 50,
    }),
    [selectedRecipe?.id]
  );

  // Fetch active production batches for selected recipe
  const { data: batchesData, isLoading: batchesLoading } = useProductionBatches(
    storeId,
    batchFilters
  );

  // Filter recipes based on search
  const filteredRecipes = useMemo(() => {
    if (!recipesData?.recipes) return [];
    const query = searchQuery.toLowerCase();
    return recipesData.recipes.filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(query) ||
        (recipe.description && recipe.description.toLowerCase().includes(query)) ||
        (recipe.category && recipe.category.toLowerCase().includes(query))
    );
  }, [recipesData?.recipes, searchQuery]);

  // Get active batches for selected recipe
  // Filter batches to ensure they match the selected recipe (defensive filtering)
  const activeBatches = useMemo(() => {
    if (!selectedRecipe || !batchesData?.batches) return [];
    // Additional client-side filter to ensure batches match selected recipe
    return batchesData.batches.filter((batch) => batch.recipeId === selectedRecipe.id);
  }, [selectedRecipe, batchesData?.batches]);

  // Get recipe ingredients with current stock availability
  const recipeIngredients = useMemo(() => {
    if (!selectedRecipe?.ingredients) return [];

    return selectedRecipe.ingredients.map((ingredient) => {
      const required = Number(ingredient.quantity);
      // Convert material stock to ingredient unit for proper comparison
      const materialStock = Number(ingredient.material.currentStock);
      const materialUnit = ingredient.material.unit;
      const ingredientUnit = ingredient.unit;
      const available = convertStockToIngredientUnit(materialStock, materialUnit, ingredientUnit);

      let status: "sufficient" | "low" | "insufficient";

      if (available >= required) {
        status = "sufficient";
      } else if (available >= required * 0.5) {
        status = "low";
      } else {
        status = "insufficient";
      }

      return {
        materialId: ingredient.materialId,
        materialName: ingredient.material.name,
        required,
        available,
        unit: ingredient.unit,
        status,
      };
    });
  }, [selectedRecipe]);

  // Check if recipe has linked products
  const hasLinkedProducts = useMemo(() => {
    return selectedRecipe?.recipeProducts && selectedRecipe.recipeProducts.length > 0;
  }, [selectedRecipe]);

  // Check if all materials have sufficient quantity
  const hasSufficientMaterials = useMemo(() => {
    if (!selectedRecipe || recipeIngredients.length === 0) return false;
    // Only allow production if all materials have available >= required
    return recipeIngredients.every(
      (ing: { available: number; required: number }) => ing.available >= ing.required
    );
  }, [selectedRecipe, recipeIngredients]);

  // Check if production can start (all materials have sufficient quantity and recipe has linked products)
  const canStartProduction = useMemo(() => {
    if (!selectedRecipe || recipeIngredients.length === 0) return false;
    return hasLinkedProducts && hasSufficientMaterials;
  }, [selectedRecipe, recipeIngredients, hasLinkedProducts, hasSufficientMaterials]);

  // Get category color - neutral gray
  const getCategoryColor = (category: string | null | undefined) => {
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
  };

  // Helper to translate category from database value to localized string
  const getCategoryTranslation = (category: string | null | undefined): string => {
    if (!category) return "";
    const categoryMap: Record<string, string> = {
      "Bread & Pastries": t("data.recipes.categories.breadPastries"),
      "Cakes & Desserts": t("data.recipes.categories.cakesDesserts"),
      Confectionery: t("data.recipes.categories.confectionery"),
      "Dairy Products": t("data.recipes.categories.dairyProducts"),
      Beverages: t("data.recipes.categories.beverages"),
      "Sauces & Condiments": t("data.recipes.categories.saucesCondiments"),
      Other: t("data.recipes.categories.other"),
    };
    return categoryMap[category] || category;
  };

  // Loading state
  if (recipesLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("management.recipeProduction.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("management.recipeProduction.description")}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <LottieLoader size="md" className="text-gray-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("management.recipeProduction.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("management.recipeProduction.description")}
        </p>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[350px_1fr]">
        {/* Left Column: Recipe List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("management.recipeProduction.availableRecipes")}
            </CardTitle>
            <CardDescription>
              {t("management.recipeProduction.selectRecipeToStart")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("management.recipeProduction.searchRecipes")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Recipe List */}
            <div className="max-h-[600px] space-y-2 overflow-y-auto pr-2">
              {filteredRecipes.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  {t("management.recipeProduction.noRecipesFound")}
                </p>
              ) : (
                filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedRecipe?.id === recipe.id
                        ? "bg-primary/5 border-primary"
                        : "bg-card hover:bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <ChefHat className="text-muted-foreground h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{recipe.name}</p>
                        <p className="text-muted-foreground truncate text-sm">
                          {recipe.description}
                        </p>
                        <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {recipe.yieldQuantity} {recipe.yieldUnit}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {recipe.productionTimeMinutes} min
                          </span>
                        </div>
                        <Badge className={`mt-2 ${getCategoryColor(recipe.category ?? "")}`}>
                          {getTranslatedCategory(recipe.category, t)}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Recipe Details */}
        {selectedRecipe ? (
          <div className="space-y-4">
            {/* Recipe Information */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedRecipe.name}</CardTitle>
                    <CardDescription>{selectedRecipe.description}</CardDescription>
                  </div>
                  <Badge className={getCategoryColor(selectedRecipe.category)}>
                    {getTranslatedCategory(selectedRecipe.category, t)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.recipeProduction.yield")}
                    </p>
                    <p className="text-2xl font-bold">{selectedRecipe.yieldQuantity}</p>
                    <p className="text-muted-foreground text-sm">{selectedRecipe.yieldUnit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.recipeProduction.productionTime")}
                    </p>
                    <p className="text-2xl font-bold">{selectedRecipe.productionTimeMinutes}</p>
                    <p className="text-muted-foreground text-sm">
                      {t("management.recipeProduction.minutes")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.recipeProduction.costPerBatch")}
                    </p>
                    <p className="text-2xl font-bold">{formatPrice(selectedRecipe.costPerBatch)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.recipeProduction.costPerUnit")}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatPrice(
                        Number(selectedRecipe.costPerBatch) / Number(selectedRecipe.yieldQuantity)
                      )}
                    </p>
                  </div>
                </div>

                {/* Start Production Button */}
                <div className="mt-6">
                  <Button
                    onClick={() => setIsStartDialogOpen(true)}
                    disabled={!canStartProduction}
                    className="w-full"
                    size="lg"
                  >
                    <PlayCircle className="mr-1 hidden h-5 w-5 sm:inline" />
                    {t("management.recipeProduction.startProduction")}
                  </Button>
                  {!canStartProduction && !hasLinkedProducts && (
                    <p className="text-destructive mt-2 flex items-center gap-1 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {t("management.recipeProduction.noLinkedProducts")}
                    </p>
                  )}
                  {!canStartProduction && hasLinkedProducts && !hasSufficientMaterials && (
                    <p className="text-destructive mt-2 flex items-center gap-1 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {t("management.recipeProduction.insufficientMaterials")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Material Availability Check */}
            <MaterialAvailabilityCheck
              ingredients={recipeIngredients}
              recipeName={selectedRecipe.name}
            />

            {/* Active Batches */}
            {activeBatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t("management.recipeProduction.activeBatches")}
                  </CardTitle>
                  <CardDescription>
                    {t("management.recipeProduction.activeBatchesDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeBatches.map((batch) => (
                    <ProductionBatchCard key={batch.id} batch={batch} />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="flex h-[400px] items-center justify-center">
            <CardContent>
              <div className="text-muted-foreground text-center">
                <ChefHat className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-lg font-medium">
                  {t("management.recipeProduction.selectRecipe")}
                </p>
                <p className="mt-2 text-sm">{t("management.recipeProduction.selectRecipeHint")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Start Production Dialog */}
      {selectedRecipe && (
        <StartProductionDialog
          key={selectedRecipe.id}
          open={isStartDialogOpen}
          onOpenChange={setIsStartDialogOpen}
          recipe={selectedRecipe}
          availableIngredients={recipeIngredients}
        />
      )}
    </div>
  );
}
