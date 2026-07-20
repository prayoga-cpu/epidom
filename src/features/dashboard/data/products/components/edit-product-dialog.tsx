"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RecipeSelector } from "./recipe-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Product, RecipeProduct, Recipe } from "@prisma/client";

type ProductWithRecipes = Product & {
  recipeProducts?: Array<RecipeProduct & { recipe: Recipe }>;
};
import { useI18n } from "@/components/lang/i18n-provider";
import { useUpdateProduct, useProducts } from "../hooks/use-products";
import { useRecipesForSelector } from "../../recipes/hooks/use-recipes";
import { toast as sonnerToast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";
import { DecimalInput } from "@/components/shared/decimal-input";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { useSkuAvailability } from "@/hooks/use-sku-availability";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";

// Helper function to create product schema with translated messages
// Note: Number fields allow undefined in form state (for better UX - can clear field),
// validation happens in onSubmit after converting undefined to defaults
function createProductSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("common.validation.productNameMin")),
    sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
    description: z.string().optional(),
    category: z.string().min(1, t("common.validation.categoryRequired")),
    retailPrice: z.union([
      z.number().positive(t("common.validation.pricePositive")),
      z.undefined(),
    ]),
    costPrice: z.union([z.number().positive(t("common.validation.pricePositive")), z.undefined()]),
    unit: z.string().min(1, t("common.validation.unitRequired")),
    currentStock: z.union([
      z.number().min(0, t("common.validation.stockNonNegative")),
      z.undefined(),
    ]),
    minStock: z.union([
      z.number().min(0, t("common.validation.minStockNonNegative")),
      z.undefined(),
    ]),
    maxStock: z.union([
      z.number().positive(t("common.validation.maxStockPositive")),
      z.undefined(),
    ]),
    recipeIds: z.array(z.string()).optional(),
  });
}

type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;

interface EditProductDialogProps {
  storeId: string;
  product: ProductWithRecipes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({
  storeId,
  product,
  open,
  onOpenChange,
}: EditProductDialogProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const { currency, convertPrice, convertToBase } = useCurrency();
  const updateProduct = useUpdateProduct(storeId, product.id);

  const isSubmittingRef = useRef(false);
  const savedFormDataRef = useRef<ProductFormValues | null>(null);
  // Whether the user has opted to type a custom cost price instead of the
  // value auto-calculated from linked recipes. Off by default: as long as a
  // recipe with a calculable cost is linked, the field is locked to that
  // value so it can't silently drift out of sync with the recipe.
  const [manualCostPrice, setManualCostPrice] = useState(false);

  // Same query params as RecipeSelector uses internally, so this shares its
  // React Query cache instead of firing a second fetch.
  const { data: recipesData } = useRecipesForSelector(storeId, {
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    skip: 0,
    take: 100,
  });
  const allRecipes = recipesData?.recipes || [];

  const handleOpenChange = (newOpen: boolean) => {
    // If closing manually (not submitting), clear saved data
    if (!newOpen && !isSubmittingRef.current) {
      savedFormDataRef.current = null;
    }
    onOpenChange(newOpen);
  };

  const productSchema = createProductSchema(t);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: "onSubmit", // Validate only on submit to allow undefined values during editing
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      category: "",
      retailPrice: undefined,
      costPrice: undefined,
      unit: "piece",
      currentStock: undefined,
      minStock: undefined,
      maxStock: undefined,
      recipeIds: [],
    },
  });

  // Update form when product changes
  useEffect(() => {
    if (!open) return;

    // Restore saved data if any
    if (savedFormDataRef.current) {
      requestAnimationFrame(() => {
        form.reset(savedFormDataRef.current!);
      });
      return;
    }

    if (product) {
      const sellingPrice = Number(product.sellingPrice) || 0;
      const costPrice = Number(product.costPrice) || 0;
      const currentStock = Number(product.currentStock) || 0;
      const minStock = Number(product.minStock) || 0;
      const maxStock = Number(product.maxStock) || 0;

      // Extract recipe IDs from recipeProducts
      const recipeIds = product.recipeProducts?.map((rp) => rp.recipeId) || [];
      setManualCostPrice(false);

      form.reset({
        name: product.name || "",
        sku: product.sku || "",
        description: product.description || "",
        category: product.category || "",
        retailPrice: sellingPrice > 0 ? convertPrice(sellingPrice) : undefined, // Convert to user's currency, undefined if 0
        costPrice: costPrice > 0 ? convertPrice(costPrice) : undefined, // Convert to user's currency, undefined if 0
        unit: product.unit || "piece",
        currentStock: currentStock > 0 ? currentStock : undefined,
        minStock: minStock > 0 ? minStock : undefined,
        maxStock: maxStock > 0 ? maxStock : undefined,
        recipeIds: recipeIds,
      });
    }
  }, [product, open, form, convertPrice]);

  // Watch cost price for pricing suggestions
  const costPrice = form.watch("costPrice");
  const recipeIds = form.watch("recipeIds") || [];

  // Cost Price is locked to the auto-calculated value as long as a recipe is
  // linked and the user hasn't opted into a manual override (see the
  // "Customize manually" checkbox below the field).
  const costPriceLocked = recipeIds.length > 0 && !manualCostPrice;

  // Auto-calculate cost price from linked recipes' cost-per-unit (costPerBatch /
  // yieldQuantity, summed across every linked recipe). Keeps the field synced
  // to the recipe cost whenever it's locked — including right when the dialog
  // opens with recipes already attached, not just when the selection changes.
  const recipeIdsKey = recipeIds.slice().sort().join(",");
  useEffect(() => {
    if (!open || manualCostPrice) return;
    if (recipeIds.length === 0 || allRecipes.length === 0) return;
    const linked = allRecipes.filter((r) => recipeIds.includes(r.id));
    if (linked.length === 0) return;

    const totalBaseCost = linked.reduce((sum, r) => {
      const yieldQty = Number(r.yieldQuantity);
      return sum + (yieldQty > 0 ? Number(r.costPerBatch) / yieldQty : 0);
    }, 0);

    // Round-trip through the display currency before checking positivity: a
    // real, non-zero base-currency cost (e.g. a few hundred IDR per unit) can
    // still round to 0.00 once converted to a stronger currency like EUR. Only
    // overwrite the field when the suggestion is still meaningfully positive
    // after rounding — otherwise we'd silently zero out a field the user may
    // already have set, rather than leaving it alone as intended.
    const suggestedCostPrice = Number(convertPrice(totalBaseCost).toFixed(2));
    if (suggestedCostPrice > 0) {
      form.setValue("costPrice", suggestedCostPrice, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeIdsKey, allRecipes, open, manualCostPrice]);
  const suggestedRetailPrice =
    costPrice !== undefined && costPrice > 0 ? (costPrice * 2.5).toFixed(2) : "0.00";

  // Existing categories, for the category combobox's suggestions
  const { data: productsData } = useProducts(storeId, {
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    skip: 0,
    take: 100,
  });
  const categoryOptions = useMemo(() => {
    const cats = new Set(
      (productsData?.products || []).map((p) => p.category).filter(Boolean) as string[]
    );
    return Array.from(cats)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [productsData]);

  const skuValue = form.watch("sku") || "";
  const { status: skuStatus } = useSkuAvailability(
    `/api/stores/${storeId}/products/check-sku`,
    skuValue,
    product.id
  );

  const isSubmitting = updateProduct.isPending;

  const onSubmit = async (data: ProductFormValues) => {
    try {
      // Validate required number fields (convert undefined to defaults and validate)
      const costPrice = data.costPrice ?? (Number(product.costPrice) || 0);
      const retailPrice = data.retailPrice ?? (Number(product.sellingPrice) || 0);
      const currentStock = data.currentStock ?? (Number(product.currentStock) || 0);
      const minStock = data.minStock ?? (Number(product.minStock) || 0);
      const maxStock = data.maxStock ?? (Number(product.maxStock) || 1000);

      // Validate required fields
      if (costPrice <= 0) {
        form.setError("costPrice", {
          type: "manual",
          message: t("common.validation.pricePositive"),
        });
        return;
      }

      if (retailPrice <= 0) {
        form.setError("retailPrice", {
          type: "manual",
          message: t("common.validation.pricePositive"),
        });
        return;
      }

      if (maxStock <= 0) {
        form.setError("maxStock", {
          type: "manual",
          message: t("common.validation.maxStockPositive"),
        });
        return;
      }

      // Map form fields to API schema
      const apiData = {
        sku: data.sku || product.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        costPrice: convertToBase(costPrice), // Convert back to EUR
        sellingPrice: convertToBase(retailPrice), // Convert back to EUR
        currentStock: currentStock,
        unit: data.unit,
        minStock: minStock,
        maxStock: maxStock,
        recipeIds: data.recipeIds && data.recipeIds.length > 0 ? data.recipeIds : undefined,
      };

      // OPTIMISTIC CLOSING
      savedFormDataRef.current = data;
      isSubmittingRef.current = true;
      onOpenChange(false);

      const promise = updateProduct.mutateAsync(apiData);

      // Any linked storefront MenuItem is kept in sync automatically server-side
      // (productService.updateProduct) — no manual "Sync" step needed here.
      sonnerToast.promise(promise, {
        loading: t("common.actions.saving"),
        success: () => {
          isSubmittingRef.current = false;
          savedFormDataRef.current = null;
          return t("data.products.toasts.updated.title") || "Product updated";
        },
        error: (err) => {
          isSubmittingRef.current = false;
          onOpenChange(true);
          const fieldSummary = applyServerFieldErrors(form, err);
          if (fieldSummary) return fieldSummary;
          return err instanceof Error
            ? err.message
            : t("data.products.toasts.updateError.description") ||
                "An error occurred while updating the product.";
        },
      });

      await promise;
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FormDialogLayout
        title={t("data.products.editTitle") || "Edit Product"}
        description="Update product information. Changes will be saved to your inventory."
        maxWidth="2xl"
        footer={
          <FormDialogFooter
            formId="edit-product-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("data.products.update") || "Update Product"}
            isPending={isSubmitting}
          />
        }
      >
        <Form {...form}>
          <form id="edit-product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
            {/* Basic Information */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.products.sections.basicInfo")}
              </h3>
              <div className="grid items-start gap-1.5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.products.form.name")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.products.form.namePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.products.form.sku")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.products.form.skuPlaceholder")} {...field} />
                      </FormControl>
                      {skuStatus === "checking" && (
                        <FormDescription className="text-xs">
                          {t("data.products.form.skuChecking")}
                        </FormDescription>
                      )}
                      {skuStatus === "available" && (
                        <FormDescription className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" /> {t("data.products.form.skuAvailable")}
                        </FormDescription>
                      )}
                      {skuStatus === "taken" && (
                        <FormDescription className="text-destructive flex items-center gap-1 text-xs">
                          <X className="h-3 w-3" /> {t("data.products.form.skuTaken")}
                        </FormDescription>
                      )}
                      {skuStatus === "idle" && (
                        <FormDescription className="text-xs">
                          {t("data.products.form.skuHint")}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">{t("data.products.form.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.products.form.descriptionPlaceholder")}
                        className="text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">{t("data.products.form.category")} *</FormLabel>
                    <FormControl>
                      <Combobox
                        creatable
                        options={categoryOptions}
                        value={field.value || undefined}
                        onChange={field.onChange}
                        placeholder={t("data.products.form.categoryPlaceholder")}
                        searchPlaceholder={t("data.products.form.categorySearchPlaceholder")}
                        createLabel={(v) =>
                          t("data.products.form.createCategory").replace("{value}", v)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipeIds"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormControl>
                      <RecipeSelector
                        storeId={storeId}
                        selectedRecipeIds={field.value || []}
                        onSelectionChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.products.sections.pricing")}
              </h3>
              <div className="grid items-start gap-1.5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.products.form.costPrice")} ({getCurrencySymbol(currency)}) *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={2}
                          min={0}
                          placeholder="0.00"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          disabled={costPriceLocked}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {recipeIds.length > 0 && !manualCostPrice
                          ? t("data.products.form.costPriceFromRecipesHint")
                          : t("data.products.form.costPriceHint")}
                      </FormDescription>
                      {recipeIds.length > 0 && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <Checkbox
                            id="edit-product-manual-cost-price"
                            checked={manualCostPrice}
                            onCheckedChange={(checked) => setManualCostPrice(checked === true)}
                          />
                          <label
                            htmlFor="edit-product-manual-cost-price"
                            className="text-muted-foreground cursor-pointer text-xs font-normal"
                          >
                            {t("data.products.form.costPriceOverride")}
                          </label>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retailPrice"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.products.form.retailPrice")} ({getCurrencySymbol(currency)}) *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={2}
                          min={0}
                          placeholder={suggestedRetailPrice}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.products.form.retailPriceHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {costPrice !== undefined && costPrice > 0 && (
                <div className="bg-muted mt-1 rounded-lg p-1.5 text-xs">
                  <p className="font-medium">{t("data.products.pricingSuggestions.title")}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {getCurrencySymbol(currency)}
                    {suggestedRetailPrice} (2.5x markup)
                  </p>
                </div>
              )}
            </div>

            {/* Stock Management */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.products.sections.stockManagement")}
              </h3>
              <div className="grid items-start gap-1.5 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.products.form.unit")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unit">{t("data.products.units.unit")}</SelectItem>
                          <SelectItem value="loaf">{t("data.products.units.loaf")}</SelectItem>
                          <SelectItem value="piece">{t("data.products.units.piece")}</SelectItem>
                          <SelectItem value="dozen">{t("data.products.units.dozen")}</SelectItem>
                          <SelectItem value="box">{t("data.products.units.box")}</SelectItem>
                          <SelectItem value="kg">{t("data.products.units.kg")}</SelectItem>
                          <SelectItem value="g">{t("data.products.units.g")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.products.form.currentStock")} *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="0"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.products.form.minStock")} *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="0"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.products.form.minStockHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.products.form.maxStock")} *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="1000"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.products.form.maxStockHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
