"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2, Check, X, Link2, Link2Off } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  Product,
  RecipeProduct,
  Recipe,
  ProductOptionGroup,
  ProductOption,
} from "@prisma/client";

type ProductWithRecipes = Product & {
  recipeProducts?: Array<RecipeProduct & { recipe: Recipe }>;
  optionGroups?: Array<ProductOptionGroup & { options: ProductOption[] }>;
};
import { useI18n } from "@/components/lang/i18n-provider";
import {
  useUpdateProduct,
  useProducts,
  useProductLinkedMenuItem,
  useUnlinkedMenuItems,
} from "../hooks/use-products";
import { useRecipesForSelector } from "../../recipes/hooks/use-recipes";
import { toast as sonnerToast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";
import { DecimalInput } from "@/components/shared/decimal-input";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { useSkuAvailability } from "@/hooks/use-sku-availability";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import { OptionGroupsEditor } from "@/components/shared/option-groups-editor";
import type { ProductOptionGroupInput } from "@/lib/validation/inventory.schemas";

type StockModeValue = "BATCH_PRODUCED" | "MADE_TO_ORDER" | "UNTRACKED";

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
  const { confirm, confirmDialog } = useConfirm();

  const isSubmittingRef = useRef(false);
  const savedFormDataRef = useRef<ProductFormValues | null>(null);
  // Whether the user has opted to type a custom cost price instead of the
  // value auto-calculated from linked recipes. Off by default: as long as a
  // recipe with a calculable cost is linked, the field is locked to that
  // value so it can't silently drift out of sync with the recipe.
  // Seeded from the stored Product.costPriceManual when the dialog opens (see
  // the reset effect), so a product the owner previously opted out of does not
  // silently opt back in — and so the server cascade and this checkbox always
  // agree about who owns the number.
  const [manualCostPrice, setManualCostPrice] = useState(false);
  // "keep" = keep current | "none" = unlink | "<itemId>" = link to that item
  const [menuItemReassign, setMenuItemReassign] = useState<string>("keep");
  // Controlled outside react-hook-form (like menuItemReassign above) since
  // OptionGroupsEditor is a plain value/onChange component, not RHF fields.
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroupInput[]>([]);

  const { data: currentLinkedItems = [] } = useProductLinkedMenuItem(storeId, product.id);
  const currentLinked = currentLinkedItems[0] ?? null;

  const { data: unlinkedMenuItems = [] } = useUnlinkedMenuItems(storeId);

  // When product changes reset the reassign state
  useEffect(() => {
    setMenuItemReassign("keep");
  }, [product.id]);

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
      department: "KITCHEN",
      stockMode: "BATCH_PRODUCED",
      primaryRecipeId: undefined,
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
      // Seed from what is stored, not a blanket false: resetting to false on
      // every open would silently re-enrol a product the owner had opted out
      // of, and the next recipe cost change would overwrite their typed figure.
      setManualCostPrice(product.costPriceManual === true);

      setOptionGroups(
        (product.optionGroups ?? []).map((group) => ({
          name: group.name,
          isRequired: group.isRequired,
          maxSelections: group.maxSelections,
          options: group.options.map((option) => ({
            name: option.name,
            priceAdjustment: Number(option.priceAdjustment) || 0,
            materialId: option.materialId ?? undefined,
            materialQty: option.materialQty != null ? Number(option.materialQty) : undefined,
          })),
        }))
      );

      form.reset({
        name: product.name || "",
        sku: product.sku || "",
        description: product.description || "",
        category: product.category || "",
        // Product.department is drawn from the shared Department enum but,
        // unlike Material, a product is never assigned "BOTH" — it always
        // routes to exactly one KDS station (enforced by createProductSchema).
        department: (product.department as "KITCHEN" | "BAR" | undefined) ?? "KITCHEN",
        // Never derive this from the deprecated `trackStock` flag — stockMode
        // is the authoritative field and trackStock is derived FROM it.
        stockMode: (product.stockMode as StockModeValue | undefined) ?? "BATCH_PRODUCED",
        primaryRecipeId: product.primaryRecipeId ?? undefined,
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

  // Moving a counted product to made-to-order abandons whatever is on the
  // shelf — that's a real, surprising consequence, so it gets an explicit
  // confirmation instead of quietly flipping when the card is tapped.
  const handleStockModeChange = useCallback(
    async (nextValue: string, applyChange: (value: StockModeValue) => void) => {
      const next = nextValue as StockModeValue;
      // Re-selecting the card that's already active must never re-prompt.
      if (next === form.getValues("stockMode")) return;
      const wasMadeToOrder = product.stockMode === "MADE_TO_ORDER";
      if (next === "MADE_TO_ORDER" && !wasMadeToOrder) {
        // Prefer whatever is in the field over the stored row — the user may
        // have just corrected the count in this same session.
        const onHand = form.getValues("currentStock") ?? (Number(product.currentStock) || 0);
        if (onHand > 0) {
          const confirmed = await confirm({
            title: t("data.products.form.stockMode.madeToOrder"),
            description: t("data.products.form.stockMode.switchWarning").replace(
              "{n}",
              String(onHand)
            ),
            confirmText: t("common.actions.apply"),
            cancelText: t("common.actions.cancel"),
          });
          if (!confirmed) return;
        }
      }
      applyChange(next);
    },
    [confirm, form, product.currentStock, product.stockMode, t]
  );

  // Cost Price is locked to the auto-calculated value as long as a recipe is
  // linked and the user hasn't opted into a manual override (see the
  // "Customize manually" checkbox below the field).
  const costPriceLocked = recipeIds.length > 0 && !manualCostPrice;

  // Auto-calculate cost price from the PRIMARY recipe's cost-per-unit
  // (costPerBatch / yieldQuantity). Keeps the field synced to the recipe cost
  // whenever it's locked — including right when the dialog opens with recipes
  // already attached, not just when the selection changes.
  //
  // This used to SUM the cost-per-unit of every linked recipe, which
  // double-counted: linking both the 10-loaf and the 50-loaf variant of one
  // bread made a single loaf look twice as expensive as it is. Multiple linked
  // recipes are alternative ways to produce the SAME unit, not additive
  // components — so exactly one of them, the primary, defines the unit cost.
  useEffect(() => {
    if (!open || manualCostPrice) return;
    if (!effectivePrimaryRecipeId || allRecipes.length === 0) return;
    const primary = allRecipes.find((r) => r.id === effectivePrimaryRecipeId);
    if (!primary) return;

    const yieldQty = Number(primary.yieldQuantity);
    const baseCostPerUnit = yieldQty > 0 ? Number(primary.costPerBatch) / yieldQty : 0;

    // Round-trip through the display currency before checking positivity: a
    // real, non-zero base-currency cost (e.g. a few hundred IDR per unit) can
    // still round to 0.00 once converted to a stronger currency like EUR. Only
    // overwrite the field when the suggestion is still meaningfully positive
    // after rounding — otherwise we'd silently zero out a field the user may
    // already have set, rather than leaving it alone as intended.
    const suggestedCostPrice = Number(convertPrice(baseCostPerUnit).toFixed(2));
    if (suggestedCostPrice > 0) {
      form.setValue("costPrice", suggestedCostPrice, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePrimaryRecipeId, allRecipes, open, manualCostPrice]);
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
      // Only BATCH_PRODUCED products carry stock levels; for the other two
      // modes the inputs are off-screen, so the stored values are left exactly
      // as they are rather than zeroed out behind the user's back.
      const isBatchProduced = data.stockMode === "BATCH_PRODUCED";
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
          : (submittedRecipeIds[0] ?? null);

      // Map form fields to API schema
      const apiData = {
        sku: data.sku || product.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        department: data.department,
        // How a sale consumes inventory. Previously omitted entirely, so the
        // field silently never saved. `trackStock` is DERIVED from this
        // server-side (productService.resolveStockMode) — never send the two
        // independently, or they desync.
        stockMode: data.stockMode,
        trackStock: data.stockMode !== "UNTRACKED",
        primaryRecipeId: resolvedPrimaryRecipeId,
        // Persisted so the SERVER cascade honours it. Until now this checkbox
        // was client-local only, so a recipe cost change would still overwrite
        // a cost the owner had deliberately typed.
        costPriceManual: manualCostPrice,
        costPrice: convertToBase(costPrice), // Convert back to EUR
        sellingPrice: convertToBase(retailPrice), // Convert back to EUR
        unit: data.unit,
        // Omitted (not zeroed) for the uncounted modes — updateProductSchema is
        // partial, so leaving them out preserves whatever is stored.
        ...(isBatchProduced && {
          currentStock: currentStock,
          minStock: minStock,
          maxStock: maxStock,
        }),
        recipeIds: data.recipeIds && data.recipeIds.length > 0 ? data.recipeIds : undefined,
        optionGroups,
      };

      // OPTIMISTIC CLOSING
      savedFormDataRef.current = data;
      isSubmittingRef.current = true;
      onOpenChange(false);

      const promise = updateProduct.mutateAsync(apiData);

      // Handle menu item re-association separately
      if (menuItemReassign === "none" && currentLinked) {
        // Unlink current menu item from this product
        fetch(`/api/stores/${storeId}/storefront/items/${currentLinked.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: null }),
        }).catch(console.error);
      } else if (menuItemReassign && menuItemReassign !== "none" && menuItemReassign !== "keep") {
        // Unlink current (if any) and link to new item
        if (currentLinked && currentLinked.id !== menuItemReassign) {
          fetch(`/api/stores/${storeId}/storefront/items/${currentLinked.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: null }),
          }).catch(console.error);
        }
        fetch(`/api/stores/${storeId}/storefront/items/${menuItemReassign}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id }),
        }).catch(console.error);
      }

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
                        onValueChange={(value) => handleStockModeChange(value, field.onChange)}
                        className="grid gap-2"
                      >
                        {STOCK_MODE_OPTIONS.map((option) => {
                          const inputId = `edit-product-stock-mode-${option.value}`;
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

              {/* Menu association panel */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  {currentLinked ? (
                    <Link2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Link2Off className="text-muted-foreground size-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {currentLinked ? (
                        <>
                          Linked to menu item:{" "}
                          <span className="font-bold">{currentLinked.name}</span>
                        </>
                      ) : (
                        "Not linked to any menu item"
                      )}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {currentLinked
                        ? "Price/stock syncs automatically. You can re-associate or remove the link below."
                        : "This product has no POS/storefront entry. You can link to an existing menu item below."}
                    </p>
                  </div>
                </div>

                {/* Re-association selector */}
                {(unlinkedMenuItems.length > 0 || currentLinked) && (
                  <Select value={menuItemReassign} onValueChange={setMenuItemReassign}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder={t("data.products.form.keepCurrentAssociation")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">
                        {t("data.products.form.keepCurrentAssociation")}
                      </SelectItem>
                      {currentLinked && (
                        <SelectItem value="none">
                          ✕ Remove link from &quot;{currentLinked.name}&quot;
                        </SelectItem>
                      )}
                      {unlinkedMenuItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          Link to &quot;{item.name}&quot;
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
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
      {/* Rendered inside <Dialog> so it stays mounted with the form it guards;
          AlertDialog portals itself, so it still stacks above the dialog. */}
      {confirmDialog}
    </Dialog>
  );
}
