"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useRecipesForSelector } from "../../recipes/hooks/use-recipes";
import { getTranslatedCategory } from "../../recipes/utils/category-helpers";

interface RecipeSelectorProps {
  storeId: string;
  selectedRecipeIds: string[];
  onSelectionChange: (recipeIds: string[]) => void;
  className?: string;
}

export function RecipeSelector({
  storeId,
  selectedRecipeIds,
  onSelectionChange,
  className,
}: RecipeSelectorProps) {
  const { t } = useI18n();
  const [previousRecipeCount, setPreviousRecipeCount] = useState(0);

  // Fetch all recipes with optimized settings for selector (no polling, longer cache)
  const { data: recipesData, isLoading } = useRecipesForSelector(storeId, {
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    skip: 0,
    take: 100,
  });
  const allRecipes = recipesData?.recipes || [];

  // Filter out already selected recipes
  const availableRecipes = allRecipes.filter(
    (recipe) => !selectedRecipeIds.includes(recipe.id)
  );

  // Get selected recipe objects
  const selectedRecipes = allRecipes.filter((recipe) =>
    selectedRecipeIds.includes(recipe.id)
  );

  // Watch for new recipes created and auto-add to selection
  useEffect(() => {
    const currentCount = allRecipes.length;
    if (currentCount > previousRecipeCount && previousRecipeCount > 0) {
      // New recipe was created, find it and add to selection
      const newRecipes = allRecipes.filter(
        (recipe) => !selectedRecipeIds.includes(recipe.id)
      );
      if (newRecipes.length > 0) {
        // Get the most recently created recipe
        const newestRecipe = newRecipes.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        if (newestRecipe && !selectedRecipeIds.includes(newestRecipe.id)) {
          onSelectionChange([...selectedRecipeIds, newestRecipe.id]);
        }
      }
    }
    setPreviousRecipeCount(currentCount);
  }, [allRecipes.length, previousRecipeCount, allRecipes, selectedRecipeIds, onSelectionChange]);

  const handleSelectRecipe = (recipeId: string) => {
    if (!selectedRecipeIds.includes(recipeId)) {
      onSelectionChange([...selectedRecipeIds, recipeId]);
    }
  };

  const handleRemoveRecipe = (recipeId: string) => {
    onSelectionChange(selectedRecipeIds.filter((id) => id !== recipeId));
  };

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Section: Linked Recipes */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            {t("data.products.form.linkedRecipes") || "Linked Recipes"}
          </label>

          {/* Dropdown to select recipe */}
          <Select
            onValueChange={handleSelectRecipe}
            value=""
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoading
                    ? (t("common.loading") || "Loading...")
                    : (t("data.products.form.selectRecipes") || "Select recipe...")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {t("common.loading") || "Loading..."}
                </div>
              ) : availableRecipes.length > 0 ? (
                availableRecipes.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.name} ({recipe.yieldQuantity} {recipe.yieldUnit})
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {t("data.products.form.noRecipesAvailable") || "No recipes available"}
                </div>
              )}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground mt-1">
            {t("data.products.form.recipeHintMultiple") ||
              "A product can be produced by multiple recipes (e.g., 10 baguettes or 50 baguettes)"}
          </p>
        </div>

        {/* List of selected recipes */}
        {selectedRecipes.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("data.products.form.selectedRecipes") || "Selected Recipes"} ({selectedRecipes.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedRecipes.map((recipe) => (
                <Badge
                  key={recipe.id}
                  variant="secondary"
                  className="flex items-center gap-2 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium">{recipe.name}</span>
                  <span className="text-muted-foreground">
                    ({recipe.yieldQuantity} {recipe.yieldUnit})
                  </span>
                  {recipe.category && (
                    <Badge variant="outline" className="ml-1 text-xs">
                      {getTranslatedCategory(recipe.category, t)}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipe(recipe.id)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5 transition-colors"
                    aria-label={t("data.products.form.removeRecipe") || "Remove recipe"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

