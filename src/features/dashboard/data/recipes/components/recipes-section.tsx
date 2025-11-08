"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/components/lang/i18n-provider";
import RecipeDetailsDialog from "./recipe-details-dialog";
import EditRecipeDialog from "./edit-recipe-dialog";
import DuplicateRecipeDialog from "./duplicate-recipe-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import AddRecipeDialog from "./add-recipe-dialog";
import {
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  X,
  CheckSquare,
  ChefHat,
  Clock,
  DollarSign,
  Copy,
  Download,
  Loader2,
  Package,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDuration } from "@/lib/utils/formatting";
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

  // Loading and error states - keep card structure for consistent layout
  if (isLoading) {
    return (
      <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-bold">{t("data.recipes.pageTitle")}</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                {t("common.actions.export")}
              </Button>
              <Button size="sm" disabled className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t("data.recipes.addButton")}
              </Button>
              <Button variant="outline" size="sm" disabled className="w-full sm:w-auto">
                <CheckSquare className="mr-2 h-4 w-4" />
                {t("common.actions.view")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-bold">{t("data.recipes.pageTitle")}</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exportRecipes.isPending || recipes.length === 0}
                className="w-full sm:w-auto"
              >
                {exportRecipes.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {t("common.actions.export")}
              </Button>
              <AddRecipeDialog trigger={
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("data.recipes.addButton")}
                </Button>
              } />
              {bulkSelectMode && selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteRecipes.isPending}
                  className="w-full sm:w-auto"
                >
                  {bulkDeleteRecipes.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {t("actions.delete")} ({selectedIds.size})
                </Button>
              )}
              <Button
                variant={bulkSelectMode ? "default" : "outline"}
                size="sm"
                onClick={toggleBulkSelect}
                className="w-full sm:w-auto"
              >
                {bulkSelectMode ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    {t("actions.cancel")}
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    {t("common.actions.view")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative w-full">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t("actions.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9"
              />
            </div>

            {/* Filters Row */}
            <div className="flex w-full flex-wrap items-center gap-2">
              {/* Category Filter */}
              <Select
                value={categoryFilter || "all"}
                onValueChange={(value) => setCategoryFilter(value === "all" ? undefined : value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("filters.allCategories")}
                  </SelectItem>
                  {getRecipeCategories(t).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select
                value={`${sortField}-${sortOrder}`}
                onValueChange={(v) => {
                  const [field, order] = v.split("-") as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("filters.placeholderSortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">{t("sort.nameAZ")}</SelectItem>
                  <SelectItem value="name-desc">{t("sort.nameZA")}</SelectItem>
                  <SelectItem value="productionTimeMinutes-asc">
                    {t("sort.timeShortest")}
                  </SelectItem>
                  <SelectItem value="productionTimeMinutes-desc">
                    {t("sort.timeLongest")}
                  </SelectItem>
                  <SelectItem value="costPerBatch-asc">
                    {t("sort.costLowHigh")}
                  </SelectItem>
                  <SelectItem value="costPerBatch-desc">
                    {t("sort.costHighLow")}
                  </SelectItem>
                  <SelectItem value="category-asc">
                    {t("sort.categoryAZ")}
                  </SelectItem>
                  <SelectItem value="category-desc">
                    {t("sort.categoryZA")}
                  </SelectItem>
                  <SelectItem value="createdAt-asc">
                    {t("sort.oldestFirst")}
                  </SelectItem>
                  <SelectItem value="createdAt-desc">
                    {t("sort.newestFirst")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full sm:w-auto">
                  <X className="mr-2 h-4 w-4" />
                  {t("common.actions.clearFilters")}
                </Button>
              )}
            </div>

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
          </div>

          {/* Results Count */}
          <div className="flex items-center border-b pb-2">
            <p className="text-muted-foreground text-sm">
              {t("common.showing")} {recipes.length} {t("common.of")} {total}{" "}
              {t("data.recipes.pageTitle")}
            </p>
          </div>

          {/* Recipes Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => {
              const isSelected = selectedIds.has(recipe.id);
              const costPerUnit = recipe.costPerBatch / recipe.yieldQuantity;

              return (
                <div
                  key={recipe.id}
                  className={`group bg-card relative rounded-lg border p-4 shadow-sm transition-all hover:shadow-md px-6${
                    isSelected ? "ring-primary ring-2" : ""
                  }`}
                >
                  {/* Bulk Select Checkbox */}
                  {bulkSelectMode && (
                    <div className="absolute top-2 left-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectItem(recipe.id)}
                      />
                    </div>
                  )}

                  {/* Recipe Content */}
                  <div className={bulkSelectMode ? "pl-6" : ""}>
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="line-clamp-2 text-sm leading-tight font-semibold">
                          {recipe.name}
                        </h3>
                        {recipe.category && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {recipe.category}
                          </Badge>
                        )}
                      </div>
                      <div className="bg-primary/10 ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                        <ChefHat className="text-primary h-5 w-5" />
                      </div>
                    </div>

                    {recipe.description && (
                      <div className="h-[2rem]">
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {recipe.description}
                        </p>
                      </div>
                    )}

                    <Separator className="mt-2 mb-3" />

                    {/* Recipe Metrics */}
                    <div className="space-y-2">
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <ChefHat className="h-3 w-3" />
                        <span>
                          {t("data.recipes.cards.yield")}: {recipe.yieldQuantity} {recipe.yieldUnit}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(recipe.productionTimeMinutes)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <DollarSign className="h-3 w-3 text-green-600" />
                        <div className="flex-1">
                          <span className="text-foreground font-medium">
                            {formatPrice(recipe.costPerBatch)}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            {t("data.recipes.cards.perBatch")}
                          </span>
                        </div>
                      </div>
                      <div className="bg-muted rounded px-2 py-1 text-xs">
                        <span className="text-muted-foreground">
                          {t("data.recipes.cards.perUnit")}:{" "}
                        </span>
                        <span className="text-foreground font-semibold">
                          {formatPrice(costPerUnit)}
                        </span>
                      </div>
                    </div>

                    {/* Ingredients Count */}
                    <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                      <span>
                        {recipe.ingredients.length}{" "}
                        {recipe.ingredients.length !== 1
                          ? t("data.recipes.cards.ingredients")
                          : t("data.recipes.cards.ingredient")}
                      </span>
                      {recipe.products && recipe.products.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Package className="mr-1 h-3 w-3" />
                          {recipe.products.length}{" "}
                          {recipe.products.length === 1 ? "product" : "products"}
                        </Badge>
                      )}
                    </div>

                    {/* Hover Actions */}
                    {!bulkSelectMode && (
                      <div className="mt-3 grid grid-cols-4 gap-1 transition-opacity">
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
                  </div>
                </div>
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
          </div>
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
