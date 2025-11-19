"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/components/lang/i18n-provider";
import RecipeDetailsDialog from "./recipe-details-dialog";
import EditRecipeDialog from "./edit-recipe-dialog";
import DuplicateRecipeDialog from "./duplicate-recipe-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import AddRecipeDialog from "./add-recipe-dialog";
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
  type RecipeWithIngredients,
} from "../hooks/use-recipes";
import { useFeatureAccess } from "@/features/dashboard/shared/hooks/use-feature-access";
import {
  SectionLoadingState,
  FilterSection,
  ItemCardGrid,
  BaseItemCard,
  type FilterField,
} from "../../components";
import LoadingPage from "@/features/loading/loading-page";

type SortField =
  | "name"
  | "category"
  | "productionTimeMinutes"
  | "costPerBatch"
  | "createdAt"
  | "updatedAt";
type SortOrder = "asc" | "desc";

// Recipe categories - use translation keys
const getRecipeCategories = (t: (key: string) => string) => [
  t("data.recipes.categories.breadPastries"),
  t("data.recipes.categories.cakesDesserts"),
  t("data.recipes.categories.confectionery"),
  t("data.recipes.categories.dairyProducts"),
  t("data.recipes.categories.beverages"),
  t("data.recipes.categories.saucesCondiments"),
  t("data.recipes.categories.other"),
];

export function RecipesSection() {
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
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithIngredients | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // API hooks
  const {
    data: recipesData,
    isLoading,
    error,
  } = useRecipes(storeId, {
    search: searchQuery || undefined,
    category: categoryFilter,
    sortBy: sortField,
    sortOrder: sortOrder,
    skip: 0,
    take: 100,
  });

  const deleteRecipe = useDeleteRecipe(storeId);
  const bulkDeleteRecipes = useBulkDeleteRecipes(storeId);
  const exportRecipes = useExportRecipes();

  const recipes = recipesData?.recipes || [];
  const total = recipesData?.total || 0;

  // Bulk selection handlers
  const toggleBulkSelect = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === recipes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recipes.map((r) => r.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Action handlers
  const handleView = (recipe: RecipeWithIngredients) => {
    setSelectedRecipe(recipe);
    setViewDialogOpen(true);
  };

  const handleEdit = (recipe: RecipeWithIngredients) => {
    setSelectedRecipe(recipe);
    setEditDialogOpen(true);
  };

  const handleDuplicate = (recipe: RecipeWithIngredients) => {
    setSelectedRecipe(recipe);
    setDuplicateDialogOpen(true);
  };

  const handleDeleteClick = (recipe: RecipeWithIngredients) => {
    setSelectedRecipe(recipe);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRecipe) return;

    try {
      await deleteRecipe.mutateAsync(selectedRecipe.id);
      toast.success(t("data.recipes.toasts.deleted.title"), {
        description: t("data.recipes.toasts.deleted.description")?.replace("{name}", selectedRecipe.name) || "",
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
        description: t("data.recipes.toasts.bulkDeleted.description")?.replace(
          "{count}",
          selectedIds.size.toString()
        ) || "",
      });
      setSelectedIds(new Set());
      setBulkSelectMode(false);
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

  // Loading state
  if (isLoading) {
    return (
      <SectionLoadingState
        title={t("data.recipes.pageTitle")}
        exportLabel={t("common.actions.export")}
        addLabel={t("data.recipes.addButton")}
        selectLabel={t("common.actions.view")}
      />
    );
  }

  if (error) {
    return (
      <Card className="overflow-hidden shadow-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive font-semibold">{t("messages.errorLoadingRecipes")}</p>
          <p className="text-muted-foreground text-sm">
            {error instanceof Error ? error.message : t("common.validation.unexpectedError")}
          </p>
        </CardContent>
      </Card>
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
                      disabled={exportRecipes.isPending || recipes.length === 0 || !advancedReportsAccess}
                      className="w-full md:w-auto"
                    >
                      {exportRecipes.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 hidden sm:inline animate-spin" />
                      ) : (
                        <Download className="mr-1 h-4 w-4 hidden sm:inline" />
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
              <AddRecipeDialog trigger={
                <Button size="sm" className="w-full md:w-auto">
                  <Plus className="mr-1 h-4 w-4 hidden sm:inline" />
                  {t("data.recipes.addButton")}
                </Button>
              } />
              {bulkSelectMode && selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteRecipes.isPending}
                  className="w-full md:w-auto"
                >
                  {bulkDeleteRecipes.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 hidden sm:inline animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4 hidden sm:inline" />
                  )}
                  {t("actions.delete")} ({selectedIds.size})
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
                    <X className="mr-1 h-4 w-4 hidden sm:inline" />
                    {t("actions.cancel")}
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-1 h-4 w-4 hidden sm:inline" />
                    {t("common.actions.view")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
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
                  ...getRecipeCategories(t).map((category) => ({
                    value: category,
                    label: category,
                  })),
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
                checked={selectedIds.size === recipes.length && recipes.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">
                {t("common.selectAll")} ({selectedIds.size} {t("common.of")} {recipes.length}{" "}
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
              const isSelected = selectedIds.has(recipe.id);
              const costPerUnit = recipe.costPerBatch / recipe.yieldQuantity;

              return (
                <BaseItemCard
                  key={recipe.id}
                  isSelected={isSelected}
                  bulkSelectMode={bulkSelectMode}
                  onSelect={(checked) => {
                    if (checked) {
                      setSelectedIds((prev) => new Set(prev).add(recipe.id));
                    } else {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(recipe.id);
                        return next;
                      });
                    }
                  }}
                  contentClassName="!px-4"
                >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="line-clamp-2 text-sm leading-tight font-semibold">
                          {recipe.name}
                        </h3>
                        {recipe.category && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {recipe.category}
                          </Badge>
                        )}
                      </div>
                      <div className="bg-primary/10 ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <ChefHat className="text-primary h-4 w-4" />
                      </div>
                    </div>

                    {recipe.description && (
                      <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">
                        {recipe.description}
                      </p>
                    )}

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
                              onClick={() => handleDeleteClick(recipe)}
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
            {/* Empty State */}
            {recipes.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <ChefHat className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p className="text-muted-foreground">
                  {hasActiveFilters
                    ? t("messages.noMatchingFilters")
                    : t("messages.noRecipesFound")}
                </p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    {t("common.actions.clearFilters")}
                  </Button>
                )}
              </div>
            )}
          </ItemCardGrid>
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
              handleDeleteClick(selectedRecipe);
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
        description={t("data.recipes.toasts.deleted.description")?.replace(
          "{name}",
          selectedRecipe?.name || ""
        ) || ""}
        confirmText={t("common.actions.delete")}
        variant="destructive"
      />
    </>
  );
}
