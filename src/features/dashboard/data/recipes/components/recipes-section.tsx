"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/components/lang/i18n-provider";
import { RecipeDetailsDialog } from "./recipe-details-dialog";
import EditRecipeDialog from "./edit-recipe-dialog";
import DuplicateRecipeDialog from "./duplicate-recipe-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { AddRecipeDialog } from "./add-recipe-dialog";
import { SmartImportDialog } from "../../import";
import {
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  CheckSquare,
  ChefHat,
  Copy,
  Download,
  Plus,
  Loader2,
  X,
  Wand2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { formatDuration } from "@/lib/utils/formatting";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  useRecipes,
  useDeleteRecipe,
  useBulkDeleteRecipes,
  useExportRecipes,
  useRecipeDemand,
  type RecipeWithIngredients,
} from "../hooks/use-recipes";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import {
  SectionLoadingState,
  SectionErrorState,
  FilterSection,
  ItemCardGrid,
  BaseItemCard,
  type FilterField,
} from "../../components";
import { RecipesCardGridSkeleton } from "./recipes-skeleton";
import { LoadingPage } from "@/features/loading/loading-page";
import { useBulkSelection } from "../../hooks/use-bulk-selection";
import { useDialogState } from "../../hooks/use-dialog-state";
import { getTranslatedCategory } from "../utils/category-helpers";

type SortField =
  | "name"
  | "category"
  | "productionTimeMinutes"
  | "costPerBatch"
  | "createdAt"
  | "updatedAt";
type SortOrder = "asc" | "desc";

// Recipe categories - use translation keys
// Store English values in DB, but display translated labels
const getRecipeCategories = (t: (key: string) => string) => [
  { value: "Bread & Pastries", label: t("data.recipes.categories.breadPastries") },
  { value: "Cakes & Desserts", label: t("data.recipes.categories.cakesDesserts") },
  { value: "Confectionery", label: t("data.recipes.categories.confectionery") },
  { value: "Dairy Products", label: t("data.recipes.categories.dairyProducts") },
  { value: "Beverages", label: t("data.recipes.categories.beverages") },
  { value: "Sauces & Condiments", label: t("data.recipes.categories.saucesCondiments") },
  { value: "Other", label: t("data.recipes.categories.other") },
];

// Helper to translate category from database value to localized string
const getCategoryTranslation = (category: string, t: (key: string) => string): string => {
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

interface RecipesSectionProps {
  initialRecipes?: RecipeWithIngredients[];
}

export function RecipesSection({ initialRecipes }: RecipesSectionProps = {}) {
  const { advancedReportsAccess } = useFeatureAccess();
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const storeId = params.storeId as string;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  // Duplicate dialog is not part of useDialogState, handle separately
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // Smart Import dialog state
  const [smartImportOpen, setSmartImportOpen] = useState(false);

  // Debounce search input to reduce API calls (300ms delay)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // API hooks
  // Use debouncedSearch instead of searchQuery for API calls
  // Use initial data from Server Component with real-time updates
  const {
    data: recipesData,
    isLoading,
    error,
    refetch,
  } = useRecipes(
    storeId,
    {
      search: debouncedSearch || undefined,
      category: categoryFilter,
      sortBy: sortField,
      sortOrder: sortOrder,
      skip: 0,
      take: 100,
    },
    initialRecipes
      ? {
          recipes: initialRecipes,
          total: initialRecipes.length,
        }
      : undefined
  );

  const deleteRecipe = useDeleteRecipe(storeId);
  const bulkDeleteRecipes = useBulkDeleteRecipes(storeId);
  const exportRecipes = useExportRecipes();
  const recipeDemand = useRecipeDemand(storeId);

  const recipes = recipesData?.recipes || [];
  const total = recipesData?.total || 0;

  // Use reusable hooks for dialog and bulk selection state
  const {
    selectedItem: selectedRecipe,
    viewDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    setViewDialogOpen,
    setEditDialogOpen,
    setDeleteDialogOpen,
    setSelectedItem: setSelectedRecipe,
    handleView,
    handleEdit,
    handleDeleteClick: handleDeleteClickDialog,
  } = useDialogState<RecipeWithIngredients>();

  const {
    bulkSelectMode,
    selectedIds,
    selectedCount,
    toggleBulkSelect,
    toggleSelectAll,
    toggleSelectItem,
    clearSelection,
    isSelected,
  } = useBulkSelection(recipes);

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Action handlers
  const handleDuplicate = (recipe: RecipeWithIngredients) => {
    setSelectedRecipe(recipe);
    setDuplicateDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRecipe) return;

    try {
      await deleteRecipe.mutateAsync(selectedRecipe.id);
      toast.success(t("data.recipes.toasts.deleted.title"), {
        description:
          t("data.recipes.toasts.deleted.description")?.replace("{name}", selectedRecipe.name) ||
          "",
      });
      setDeleteDialogOpen(false);
      setSelectedRecipe(null);
    } catch (error) {
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("messages.registrationFailed"),
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      await bulkDeleteRecipes.mutateAsync(Array.from(selectedIds));
      toast.success(t("data.recipes.toasts.bulkDeleted.title"), {
        description:
          t("data.recipes.toasts.bulkDeleted.description")?.replace(
            "{count}",
            selectedIds.size.toString()
          ) || "",
      });
      clearSelection();
    } catch (error) {
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("messages.registrationFailed"),
      });
    }
  };

  const handleExport = async () => {
    try {
      await exportRecipes.mutateAsync({
        storeId,
        filters: {
          search: searchQuery || undefined,
          category: categoryFilter,
          sortBy: sortField,
          sortOrder: sortOrder,
          skip: 0,
          take: 100,
        },
      });
      toast.success(t("messages.exportStarted"), {
        description: t("messages.exportStartedDescription"),
      });
    } catch (error) {
      toast.error(t("messages.exportFailed"), {
        description: error instanceof Error ? error.message : t("messages.errorLoadingRecipes"),
      });
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter(undefined);
    setSortField("createdAt");
    setSortOrder("desc");
  };

  const hasActiveFilters = searchQuery || categoryFilter !== undefined;

  // Loading state - use pixel-perfect skeleton to prevent layout shift
  if (isLoading) {
    return <RecipesCardGridSkeleton cards={6} />;
  }

  if (error) {
    return (
      <SectionErrorState
        title={t("common.error")}
        message={error.message || t("messages.errorLoadingRecipes")}
        onRetry={() => refetch()}
        retryLabel={t("common.actions.retry")}
      />
    );
  }

  return (
    <>
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg font-bold">{t("data.recipes.pageTitle")}</CardTitle>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={
                        exportRecipes.isPending || !advancedReportsAccess || recipes.length === 0
                      }
                      className="w-full md:w-auto"
                    >
                      {exportRecipes.isPending ? (
                        <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
                      ) : (
                        <Download className="mr-1 hidden h-4 w-4 sm:inline" />
                      )}
                      {t("common.actions.export")}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!advancedReportsAccess && (
                  <TooltipContent>
                    <p>{t("billing.advancedReportsOnly")}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSmartImportOpen(true)}
                className="w-full md:w-auto"
              >
                <Wand2 className="mr-1 hidden h-4 w-4 sm:inline" />
                {t("import.title")}
              </Button>

              <AddRecipeDialog
                trigger={
                  <Button size="sm" className="w-full md:w-auto">
                    <Plus className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("data.recipes.addButton")}
                  </Button>
                }
              />
              {bulkSelectMode && selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  className="w-full md:w-auto"
                >
                  <Trash2 className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("actions.delete")} ({selectedCount})
                </Button>
              )}
              <Button
                variant={bulkSelectMode ? "default" : "outline"}
                size="sm"
                onClick={toggleBulkSelect}
                className="w-full md:w-auto"
              >
                {bulkSelectMode ? (
                  <>
                    <X className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("actions.cancel")}
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-1 hidden h-4 w-4 sm:inline" />
                    {t("common.actions.select")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-6">
          {/* Search and Filters */}
          <FilterSection
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t("actions.searchPlaceholder")}
            filters={[
              {
                key: "category",
                label: t("filters.placeholderCategory"),
                placeholder: t("filters.placeholderCategory"),
                value: categoryFilter || "all",
                onChange: (value) => setCategoryFilter(value === "all" ? undefined : value),
                options: [
                  { value: "all", label: t("filters.allCategories") },
                  ...getRecipeCategories(t),
                ],
              },
              {
                key: "sort",
                label: t("filters.placeholderSortBy"),
                placeholder: t("filters.placeholderSortBy"),
                value: `${sortField}-${sortOrder}`,
                onChange: (v) => {
                  const [field, order] = v.split("-") as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                },
                options: [
                  { value: "name-asc", label: t("sort.nameAZ") },
                  { value: "name-desc", label: t("sort.nameZA") },
                  { value: "productionTimeMinutes-asc", label: t("sort.timeShortest") },
                  { value: "productionTimeMinutes-desc", label: t("sort.timeLongest") },
                  { value: "costPerBatch-asc", label: t("sort.costLowHigh") },
                  { value: "costPerBatch-desc", label: t("sort.costHighLow") },
                  { value: "category-asc", label: t("sort.categoryAZ") },
                  { value: "category-desc", label: t("sort.categoryZA") },
                  { value: "createdAt-asc", label: t("sort.oldestFirst") },
                  { value: "createdAt-desc", label: t("sort.newestFirst") },
                ],
              },
            ]}
            hasActiveFilters={!!hasActiveFilters}
            onClearFilters={clearFilters}
            clearFiltersLabel={t("common.actions.clearFilters")}
          />

          {/* Bulk Select All */}
          {bulkSelectMode && (
            <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3">
              <Checkbox
                checked={selectedCount === recipes.length && recipes.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">
                {t("common.selectAll")} ({selectedCount} {t("common.of")} {recipes.length}{" "}
                {t("common.selected")})
              </span>
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing")} {recipes.length} {t("common.of")} {total}{" "}
              {t("data.recipes.pageTitle")}
            </p>
          </div>

          {/* Recipes Grid */}
          <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
            {recipes.map((recipe) => {
              const costPerUnit = recipe.costPerBatch / recipe.yieldQuantity;

              return (
                <BaseItemCard
                  key={recipe.id}
                  isSelected={isSelected(recipe.id)}
                  bulkSelectMode={bulkSelectMode}
                  onSelect={() => toggleSelectItem(recipe.id)}
                  contentClassName="!px-4"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="line-clamp-2 text-sm leading-tight font-semibold">
                        {recipe.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {recipe.category && (
                          <Badge variant="secondary" className="text-xs">
                            {getTranslatedCategory(recipe.category, t)}
                          </Badge>
                        )}
                        {(recipeDemand.get(recipe.id) ?? 0) > 0 && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs">
                            {recipeDemand.get(recipe.id)}× {t("data.recipes.demandBadge") || "last 30d"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="bg-primary/10 ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <ChefHat className="text-primary h-4 w-4" />
                    </div>
                  </div>

                  {/* Description - always render to maintain consistent layout */}
                  <p className="text-muted-foreground mb-2 line-clamp-1 text-xs">
                    {recipe.description || (
                      <span className="text-muted-foreground/50 italic">
                        {t("data.recipes.noDescription")}
                      </span>
                    )}
                  </p>

                  <Separator className="my-2" />

                  {/* Recipe Info */}
                  <div className="text-muted-foreground my-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>{t("data.recipes.cards.yield")}:</span>
                      <span className="text-foreground font-medium">
                        {recipe.yieldQuantity} {recipe.yieldUnit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("data.recipes.review.productionTime")}:</span>
                      <span className="text-foreground font-medium">
                        {formatDuration(recipe.productionTimeMinutes)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("data.recipes.cards.perBatch")}:</span>
                      <span className="text-foreground font-medium">
                        {formatPrice(recipe.costPerBatch)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("data.recipes.cards.perUnit")}:</span>
                      <span className="text-foreground font-medium">
                        {formatPrice(costPerUnit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {recipe.ingredients.length === 1
                          ? t("data.recipes.cards.ingredient")
                          : t("data.recipes.cards.ingredients")}
                        :
                      </span>
                      <span className="text-foreground font-medium">
                        {recipe.ingredients.length}
                      </span>
                    </div>
                  </div>

                  {/* Hover Actions */}
                  {!bulkSelectMode && (
                    <div className="mt-2 grid grid-cols-4 gap-1 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 w-full text-xs"
                            onClick={() => handleView(recipe)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("data.recipes.tooltips.view")}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 w-full flex-1 text-xs"
                            onClick={() => handleEdit(recipe)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("data.recipes.tooltips.edit")}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 w-full flex-1 text-xs"
                            onClick={() => handleDuplicate(recipe)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("data.recipes.tooltips.duplicate")}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive bg-destructive/10 hover:bg-destructive/30 h-8 w-full flex-1 text-xs"
                            onClick={() => handleDeleteClickDialog(recipe)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("data.recipes.tooltips.delete")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </BaseItemCard>
              );
            })}
          </ItemCardGrid>

          {/* Empty State */}
          {recipes.length === 0 && (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <ChefHat className="text-muted-foreground/50 mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">{t("messages.noRecipesFound")}</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                {hasActiveFilters
                  ? t("messages.noMatchingFilters")
                  : t("messages.getStartedRecipe")}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  {t("common.actions.clearFilters")}
                </Button>
              ) : (
                <AddRecipeDialog
                  trigger={
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("data.recipes.addButton")}
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedRecipe && (
        <>
          <RecipeDetailsDialog
            recipe={selectedRecipe}
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            onEdit={(recipe) => {
              setViewDialogOpen(false);
              handleEdit(recipe);
            }}
            onDelete={(recipeId) => {
              setViewDialogOpen(false);
              handleDeleteClickDialog(selectedRecipe);
            }}
          />
          <EditRecipeDialog
            recipe={selectedRecipe}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
          <DuplicateRecipeDialog
            recipe={selectedRecipe}
            open={duplicateDialogOpen}
            onOpenChange={setDuplicateDialogOpen}
          />
        </>
      )}

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={t("data.recipes.toasts.deleted.title")}
        description={
          t("data.recipes.toasts.deleted.description")?.replace(
            "{name}",
            selectedRecipe?.name || ""
          ) || ""
        }
        confirmText={t("common.actions.delete")}
        variant="destructive"
        loading={deleteRecipe.isPending}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmationDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={t("data.recipes.bulkDeleteConfirm.title") || "Delete Multiple Recipes"}
        description={
          t("data.recipes.bulkDeleteConfirm.description")?.replace("{count}", selectedCount.toString()) ||
          `Are you sure you want to delete ${selectedCount} recipe(s)? This action cannot be undone.`
        }
        confirmText={t("common.actions.delete")}
        onConfirm={handleBulkDelete}
        variant="destructive"
        loading={bulkDeleteRecipes.isPending}
      />

      {/* Smart Import Dialog */}
      <SmartImportDialog
        open={smartImportOpen}
        onOpenChange={setSmartImportOpen}
        storeId={storeId}
      />
    </>
  );
}
