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
import { Button } from "@/components/ui/button";
import { Star, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useRecipesForSelector } from "../../recipes/hooks/use-recipes";
import { getTranslatedCategory } from "../../recipes/utils/category-helpers";

interface RecipeSelectorProps {
  storeId: string;
  selectedRecipeIds: string[];
  onSelectionChange: (recipeIds: string[]) => void;
  /**
   * Which linked recipe defines ONE sellable unit (Product.primaryRecipeId).
   * It is the only recipe used for sale-time stock deduction and for the cost
   * preview — summing every linked recipe double-counts the same product when
   * a 10-loaf and a 50-loaf variant of one bread are both linked.
   */
  primaryRecipeId?: string | null;
  onPrimaryRecipeChange?: (recipeId: string | null) => void;
  className?: string;
}

export function RecipeSelector({
  storeId,
  selectedRecipeIds,
  onSelectionChange,
  primaryRecipeId,
  onPrimaryRecipeChange,
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
  const availableRecipes = allRecipes.filter((recipe) => !selectedRecipeIds.includes(recipe.id));

  // Get selected recipe objects
  const selectedRecipes = allRecipes.filter((recipe) => selectedRecipeIds.includes(recipe.id));

  // Watch for new recipes created and auto-add to selection
  useEffect(() => {
    const currentCount = allRecipes.length;
    if (currentCount > previousRecipeCount && previousRecipeCount > 0) {
      // New recipe was created, find it and add to selection
      const newRecipes = allRecipes.filter((recipe) => !selectedRecipeIds.includes(recipe.id));
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

  // Keep the primary recipe pointing at something real. The old `isDefault`
  // flag rotted precisely because nothing ever surfaced or repaired it: unlink
  // the primary and the product silently lost its stock/cost source. Falling
  // back to the first remaining recipe keeps that from happening again.
  // Keyed on the joined ids so a fresh `[]` array identity can't loop.
  const selectedKey = selectedRecipeIds.join(",");
  useEffect(() => {
    if (!onPrimaryRecipeChange) return;
    if (selectedRecipeIds.length === 0) {
      if (primaryRecipeId) onPrimaryRecipeChange(null);
      return;
    }
    if (!primaryRecipeId || !selectedRecipeIds.includes(primaryRecipeId)) {
      onPrimaryRecipeChange(selectedRecipeIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, primaryRecipeId, onPrimaryRecipeChange]);

  const handleSelectRecipe = (recipeId: string) => {
    if (!selectedRecipeIds.includes(recipeId)) {
      onSelectionChange([...selectedRecipeIds, recipeId]);
    }
  };

  const handleRemoveRecipe = (recipeId: string) => {
    onSelectionChange(selectedRecipeIds.filter((id) => id !== recipeId));
  };

  // Mirrors the effect above so the badge is right on the very first render,
  // before the parent has echoed the fallback back down as a prop.
  const effectivePrimaryRecipeId =
    primaryRecipeId && selectedRecipeIds.includes(primaryRecipeId)
      ? primaryRecipeId
      : selectedRecipeIds[0];

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Section: Linked Recipes */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            {t("data.products.form.linkedRecipes") || "Linked Recipes"}
          </label>

          {/* Dropdown to select recipe */}
          <Select onValueChange={handleSelectRecipe} value="" disabled={isLoading}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoading
                    ? t("common.loading") || "Loading..."
                    : t("data.products.form.selectRecipes") || "Select recipe..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">
                  {t("common.loading") || "Loading..."}
                </div>
              ) : availableRecipes.length > 0 ? (
                availableRecipes.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.name} ({recipe.yieldQuantity} {recipe.yieldUnit})
                  </SelectItem>
                ))
              ) : (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">
                  {t("data.products.form.noRecipesAvailable") || "No recipes available"}
                </div>
              )}
            </SelectContent>
          </Select>

          <p className="text-muted-foreground mt-1 text-xs">
            {t("data.products.form.recipeHintMultiple") ||
              "A product can be produced by multiple recipes (e.g., 10 baguettes or 50 baguettes)"}
          </p>
        </div>

        {/* List of selected recipes */}
        {selectedRecipes.length > 0 && (
          <div>
            <label className="block text-sm font-medium">
              {t("data.products.form.selectedRecipes") || "Selected Recipes"} (
              {selectedRecipes.length})
            </label>
            <p className="text-muted-foreground mt-0.5 mb-2 text-xs">
              {t("data.products.form.primaryRecipe")}
            </p>
            <div className="flex flex-col gap-2">
              {selectedRecipes.map((recipe) => {
                const isPrimary = recipe.id === effectivePrimaryRecipeId;
                return (
                  <div
                    key={recipe.id}
                    className="bg-muted/40 flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2"
                  >
                    <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2 gap-y-1 sm:basis-auto">
                      <span className="text-sm font-medium break-words">{recipe.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({recipe.yieldQuantity} {recipe.yieldUnit})
                      </span>
                      {recipe.category && (
                        <Badge variant="outline" className="text-xs">
                          {getTranslatedCategory(recipe.category, t)}
                        </Badge>
                      )}
                    </div>

                    {/* Always visible — never `group-hover:` gated, or the only
                        control that surfaces the primary recipe becomes
                        permanently unreachable on a touch device. */}
                    {isPrimary ? (
                      <Badge className="ml-auto flex shrink-0 items-center gap-1 px-2 py-1 text-xs">
                        <Star className="size-3 shrink-0 fill-current" aria-hidden="true" />
                        {t("data.products.form.usedForStockAndCost")}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto h-10 shrink-0 gap-1 px-2 text-xs sm:px-3"
                        onClick={() => onPrimaryRecipeChange?.(recipe.id)}
                      >
                        <Star className="size-3.5 shrink-0" aria-hidden="true" />
                        {t("data.products.form.makePrimary")}
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveRecipe(recipe.id)}
                      className="hover:bg-muted focus-visible:ring-ring flex size-10 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      aria-label={t("data.products.form.removeRecipe") || "Remove recipe"}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
