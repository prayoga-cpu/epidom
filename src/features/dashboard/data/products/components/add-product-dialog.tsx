"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, RefreshCw, Check, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCreateProduct, useProducts, useUnlinkedMenuItems } from "../hooks/use-products";
import { useProductUsage } from "../hooks/use-product-usage";
import { useRecipesForSelector } from "../../recipes/hooks/use-recipes";
import { generateSku } from "@/lib/utils/sku-generator";
import { useSkuAvailability } from "@/hooks/use-sku-availability";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import { toast as sonnerToast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { FORM_DEFAULTS } from "@/lib/config/form-defaults";
import { DecimalInput } from "@/components/shared/decimal-input";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { OptionGroupsEditor } from "@/components/shared/option-groups-editor";
import type { ProductOptionGroupInput } from "@/lib/validation/inventory.schemas";

/**
 * The three ways a sale can consume inventory (Product.stockMode).
 *
 * BATCH_PRODUCED deliberately covers BOTH made-ahead goods AND stock bought in
 * ready to sell — the migration maps every previously-tracked product onto it,
 * retail included, so the copy must not read as "prepped in-house only".
 */
const STOCK_MODE_OPTIONS = [
  {
    value: "BATCH_PRODUCED",
    label: "data.products.form.stockMode.batch",
    hint: "data.products.form.stockMode.batchHint",
  },
  {
    value: "MADE_TO_ORDER",
    label: "data.products.form.stockMode.madeToOrder",
    hint: "data.products.form.stockMode.madeToOrderHint",
  },
  {
    value: "UNTRACKED",
    label: "data.products.form.stockMode.untracked",
    hint: "data.products.form.stockMode.untrackedHint",
  },
] as const;

// Helper function to create product schema with translated messages
// Note: Number fields allow undefined in form state (for better UX - can clear field),
// validation happens in onSubmit after converting undefined to defaults
function createProductSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("common.validation.productNameMin")),
    sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
    description: z.string().optional(),
    category: z.string().min(1, t("common.validation.categoryRequired")),
    department: z.enum(["KITCHEN", "BAR"]),
    // BARE enum, deliberately no `.default()`: zodResolver infers useForm's
    // field type from the schema's INPUT type, and a default makes the input
    // optional while the output stays required — the two desync and every
    // `form.watch("stockMode")` widens to `| undefined`. Follow `department`
    // above (bare enum + a value in `defaultValues`), never the old
    // `trackStock` pattern.
    stockMode: z.enum(["BATCH_PRODUCED", "MADE_TO_ORDER", "UNTRACKED"]),
    // Which linked recipe defines ONE unit — drives sale-time deduction and
    // the cost preview. Maintained by RecipeSelector.
    primaryRecipeId: z.string().optional(),
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
    linkedMenuItemId: z.string().optional(),
  });
}

type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;

interface AddProductDialogProps {
  storeId: string;
  children?: React.ReactNode;
}

export function AddProductDialog({ storeId, children }: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const isSubmittingRef = useRef(false);
  const { toast } = useToast();
  const { t } = useI18n();
  const { currency, convertPrice, convertToBase } = useCurrency();
  const createProduct = useCreateProduct(storeId);
  const { data: productUsage, isLoading: isLoadingUsage } = useProductUsage(storeId);

  // Check if user can create more products
  const canCreateMore = productUsage?.canCreateMore ?? true;
  const productLimitReached = !isLoadingUsage && !canCreateMore;

  const productSchema = createProductSchema(t);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: "onSubmit", // Validate only on submit to allow undefined values during editing
    defaultValues: {
      ...FORM_DEFAULTS.product,
      recipeIds: [],
      primaryRecipeId: undefined,
      linkedMenuItemId: undefined,
    },
  });

  const costPrice = form.watch("costPrice");
  const recipeIds = form.watch("recipeIds") || [];
  const stockMode = form.watch("stockMode");
  const primaryRecipeId = form.watch("primaryRecipeId");

  // Only BATCH_PRODUCED products are counted, so only they get stock levels.
  const showStockFields = stockMode === "BATCH_PRODUCED";

  // Resolved here rather than trusting the field alone, so the cost preview is
  // correct on the very render where RecipeSelector is still repairing a stale
  // primary (e.g. right after the current primary was unlinked).
  const effectivePrimaryRecipeId =
    primaryRecipeId && recipeIds.includes(primaryRecipeId) ? primaryRecipeId : recipeIds[0];
  const hasPrimaryRecipe = !!effectivePrimaryRecipeId;

  const handlePrimaryRecipeChange = useCallback(
    (id: string | null) => {
      form.setValue("primaryRecipeId", id ?? undefined, { shouldDirty: true });
    },
    [form]
  );

  // Whether the user has opted to type a custom cost price instead of the
  // value auto-calculated from linked recipes. Off by default: as long as a
  // recipe with a calculable cost is linked, the field is locked to that
  // value so it can't silently drift out of sync with the recipe.
  const [manualCostPrice, setManualCostPrice] = useState(false);
  const costPriceLocked = recipeIds.length > 0 && !manualCostPrice;
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroupInput[]>([]);

  const { data: unlinkedMenuItems = [] } = useUnlinkedMenuItems(storeId);

  // Auto-suggest retail price based on 2.5x markup
  const suggestedRetailPrice =
    costPrice !== undefined && costPrice > 0 ? (costPrice * 2.5).toFixed(2) : "0.00";

  // Same query params as RecipeSelector uses internally, so this shares its
  // React Query cache instead of firing a second fetch.
  const { data: recipesData } = useRecipesForSelector(storeId, {
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    skip: 0,
    take: 100,
  });
  const allRecipes = recipesData?.recipes || [];

  // Auto-calculate cost price from the PRIMARY recipe's cost-per-unit
  // (costPerBatch / yieldQuantity), as long as the field isn't manually
  // overridden.
  //
  // This used to SUM the cost-per-unit of every linked recipe, which
  // double-counted: linking both the 10-loaf and the 50-loaf variant of one
  // bread made a single loaf look twice as expensive as it is. Multiple linked
  // recipes are alternative ways to produce the SAME unit, not additive
  // components — so exactly one of them, the primary, defines the unit cost.
  useEffect(() => {
    if (manualCostPrice) return;
    if (!effectivePrimaryRecipeId || allRecipes.length === 0) return;
    const primary = allRecipes.find((r) => r.id === effectivePrimaryRecipeId);
    if (!primary) return;

    const yieldQty = Number(primary.yieldQuantity);
    const baseCostPerUnit = yieldQty > 0 ? Number(primary.costPerBatch) / yieldQty : 0;

    // Round-trip through the display currency before checking positivity: a
    // real, non-zero base-currency cost (e.g. a few hundred IDR per unit) can
    // still round to 0.00 once converted to a stronger currency like EUR. Only
    // set the field when the suggestion is still meaningfully positive after
    // rounding, so a genuinely cheap recipe doesn't silently zero it out.
    const suggestedCostPrice = Number(convertPrice(baseCostPerUnit).toFixed(2));
    if (suggestedCostPrice > 0) {
      form.setValue("costPrice", suggestedCostPrice, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePrimaryRecipeId, allRecipes, manualCostPrice]);

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

  // Auto-generate a SKU from name/category until the user edits it themselves
  const skuTouchedRef = useRef(false);
  const nameValue = form.watch("name");
  const categoryValue = form.watch("category");
  const skuValue = form.watch("sku") || "";

  useEffect(() => {
    if (skuTouchedRef.current) return;
    if (!nameValue) return;
    form.setValue("sku", generateSku(nameValue, categoryValue), { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, categoryValue]);

  const handleRegenerateSku = () => {
    skuTouchedRef.current = false;
    if (nameValue) {
      form.setValue("sku", generateSku(nameValue, categoryValue), { shouldValidate: true });
    }
  };

  const { status: skuStatus } = useSkuAvailability(
    `/api/stores/${storeId}/products/check-sku`,
    skuValue
  );

  const isSubmitting = createProduct.isPending;

  const onSubmit = async (data: ProductFormValues) => {
    try {
      // Validate required number fields (convert undefined to defaults and validate)
      const costPrice = data.costPrice ?? 0;
      const retailPrice = data.retailPrice ?? 0;
      // Only BATCH_PRODUCED products carry stock levels — the other two modes
      // hide those inputs, so send neutral values rather than whatever the user
      // may have typed before switching modes.
      const isBatchProduced = data.stockMode === "BATCH_PRODUCED";
      const currentStock = isBatchProduced ? (data.currentStock ?? 0) : 0;
      const minStock = isBatchProduced ? (data.minStock ?? 0) : 0;
      const maxStock = isBatchProduced ? (data.maxStock ?? 1000) : 1000;

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

      // Only enforceable while the field is on screen — never block a save on a
      // hidden input the user has no way to correct.
      if (isBatchProduced && maxStock <= 0) {
        form.setError("maxStock", {
          type: "manual",
          message: t("common.validation.maxStockPositive"),
        });
        return;
      }

      // The primary must be one of the linked recipes — fall back to the first
      // rather than sending a dangling id the server would have to reject.
      const submittedRecipeIds = data.recipeIds ?? [];
      const resolvedPrimaryRecipeId =
        data.primaryRecipeId && submittedRecipeIds.includes(data.primaryRecipeId)
          ? data.primaryRecipeId
          : submittedRecipeIds[0];

      // Map form fields to API schema
      // Note: retailPrice maps to sellingPrice
      const apiData = {
        sku: data.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        department: data.department,
        productLine: "STANDARD" as const,
        // How a sale consumes inventory. `trackStock` is derived from this
        // server-side (productService.resolveStockMode) — never send the two
        // independently, or they desync.
        stockMode: data.stockMode,
        trackStock: data.stockMode !== "UNTRACKED",
        primaryRecipeId: resolvedPrimaryRecipeId,
        costPrice: convertToBase(costPrice),
        sellingPrice: convertToBase(retailPrice),
        currentStock: currentStock,
        unit: data.unit,
        minStock: minStock,
        maxStock: maxStock,
        recipeIds: data.recipeIds && data.recipeIds.length > 0 ? data.recipeIds : undefined,
        storeId,
        linkedMenuItemId: data.linkedMenuItemId || undefined,
        optionGroups: optionGroups.length > 0 ? optionGroups : undefined,
      };

      // OPTIMISTIC CLOSING
      isSubmittingRef.current = true;
      setOpen(false);

      const promise = createProduct.mutateAsync(apiData);

      sonnerToast.promise(promise, {
        loading: (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("data.products.toasts.adding") || "Adding product..."}</span>
          </div>
        ),
        success: (data) => {
          isSubmittingRef.current = false;
          form.reset();
          setManualCostPrice(false);
          setOptionGroups([]);
          return (
            t("data.products.toasts.added.description")?.replace("{name}", data.name) ||
            "Product added successfully"
          );
        },
        error: (err) => {
          // Re-open on error
          isSubmittingRef.current = false;
          setOpen(true);
          const fieldSummary = applyServerFieldErrors(form, err);
          if (fieldSummary) return fieldSummary;
          return err instanceof Error ? err.message : t("messages.registrationFailed");
        },
      });
      // Await promise to handle errors locally if needed
      await promise;
    } catch (error) {
      // Handled by sonnerToast
      console.error(error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && !isSubmittingRef.current) {
      form.reset();
      setManualCostPrice(false);
      setOptionGroups([]);
    }
    if (newOpen) {
      isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("data.products.addButton")}
          </Button>
        )}
      </DialogTrigger>
      <FormDialogLayout
        title={t("data.products.addTitle")}
        description={t("data.products.addDescription")}
        maxWidth="2xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createProduct.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="add-product-form"
              disabled={createProduct.isPending || productLimitReached}
            >
              {createProduct.isPending && (
                <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
              )}
              {t("data.products.addButton")}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="add-product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
            {/* Product Limit Warning */}
            {productLimitReached && productUsage && productUsage.limit !== null && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>
                  {t("data.products.limitReached.title") || "Product Limit Reached"}
                </AlertTitle>
                <AlertDescription>
                  {t("data.products.limitReached.description")
                    ?.replace("{current}", String(productUsage.current))
                    .replace("{limit}", String(productUsage.limit)) ||
                    `You've reached your plan's product limit (${productUsage.current}/${productUsage.limit}). Upgrade to Pro for unlimited products.`}
                  <Link href="/pricing" className="ml-2 font-medium underline">
                    {t("data.products.limitReached.upgrade") || "Upgrade to Pro"}
                  </Link>
                </AlertDescription>
              </Alert>
            )}
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
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder={t("data.products.form.skuPlaceholder")}
                            {...field}
                            onChange={(e) => {
                              skuTouchedRef.current = true;
                              field.onChange(e);
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={handleRegenerateSku}
                            title={t("data.products.form.regenerateSku")}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                name="department"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">{t("common.department")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="KITCHEN">
                          {t("common.departmentKitchenDetailed")}
                        </SelectItem>
                        <SelectItem value="BAR">{t("common.departmentBarDetailed")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stock mode — the single most consequential choice on this
                  form, so it gets three tappable cards rather than a Select
                  the user can skim past. */}
              <FormField
                control={form.control}
                name="stockMode"
                render={({ field }) => (
                  <FormItem className="space-y-1 pt-1">
                    <FormLabel className="text-sm">
                      {t("data.products.form.stockMode.label")}
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid gap-2"
                      >
                        {STOCK_MODE_OPTIONS.map((option) => {
                          const inputId = `add-product-stock-mode-${option.value}`;
                          const selected = field.value === option.value;
                          return (
                            <label
                              key={option.value}
                              htmlFor={inputId}
                              className={cn(
                                // Whole card is the tap target, comfortably
                                // past the 44px minimum on every breakpoint.
                                "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                                // Selection is shown by border + tint, never by
                                // hover alone — touch devices have no hover.
                                selected
                                  ? "border-primary bg-primary/5"
                                  : "border-input bg-background hover:bg-muted/50"
                              )}
                            >
                              <RadioGroupItem
                                id={inputId}
                                value={option.value}
                                className="mt-0.5 shrink-0"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">{t(option.label)}</span>
                                <span className="text-muted-foreground mt-0.5 block text-xs">
                                  {t(option.hint)}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Made-to-order with nothing to deduct is legal but almost
                  always a mistake — flag it loudly, never block the save. */}
              {stockMode === "MADE_TO_ORDER" && !hasPrimaryRecipe && (
                <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    {t("data.products.form.noRecipeWarning")}
                  </AlertDescription>
                </Alert>
              )}

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
                        primaryRecipeId={primaryRecipeId ?? null}
                        onPrimaryRecipeChange={handlePrimaryRecipeChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Link to existing menu item */}
              {unlinkedMenuItems.length > 0 && (
                <FormField
                  control={form.control}
                  name="linkedMenuItemId"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        Link to existing menu item
                        <span className="text-muted-foreground ml-1 font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Don't link — create new menu entry" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Don&apos;t link — create new menu entry
                            </SelectItem>
                            {unlinkedMenuItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Connect this product to an existing POS/storefront item to avoid duplicates.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                            id="add-product-manual-cost-price"
                            checked={manualCostPrice}
                            onCheckedChange={(checked) => setManualCostPrice(checked === true)}
                          />
                          <label
                            htmlFor="add-product-manual-cost-price"
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
              {/* Stock levels only exist for BATCH_PRODUCED. Made-to-order and
                  untracked products are never counted, so the fields are
                  removed outright rather than disabled. */}
              <div
                className={cn(
                  "grid items-start gap-1.5",
                  showStockFields ? "sm:grid-cols-4" : "sm:grid-cols-2"
                )}
              >
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

                {showStockFields && (
                  <>
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
                          {/* A product with a recipe gets prepped again; one
                              without gets bought again. Same number, different
                              action — so the label has to say which. */}
                          <FormLabel className="text-sm">
                            {hasPrimaryRecipe
                              ? t("data.products.form.parLevel")
                              : t("data.products.form.reorderLevel")}{" "}
                            *
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
                  </>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.products.sections.options")}
              </h3>
              <p className="text-muted-foreground mb-2 text-xs">
                {t("data.products.options.description")}
              </p>
              <OptionGroupsEditor
                storeId={storeId}
                value={optionGroups}
                onChange={setOptionGroups}
                allowMaterialLink
              />
            </div>
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
