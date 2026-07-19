"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, RefreshCw, Check, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCreateProduct, useProducts } from "../hooks/use-products";
import { useProductUsage } from "../hooks/use-product-usage";
import { useRecipesForSelector } from "../../recipes/hooks/use-recipes";
import { generateSku } from "@/lib/utils/sku-generator";
import { useSkuAvailability } from "@/hooks/use-sku-availability";
import { toast as sonnerToast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { FORM_DEFAULTS } from "@/lib/config/form-defaults";
import { DecimalInput } from "@/components/shared/decimal-input";
import { getCurrencySymbol } from "@/lib/utils/formatting";

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
    },
  });

  const costPrice = form.watch("costPrice");
  const recipeIds = form.watch("recipeIds") || [];

  // Auto-suggest retail price based on 2.5x markup
  const suggestedRetailPrice = costPrice && costPrice > 0 ? (costPrice * 2.5).toFixed(2) : "0.00";

  // Same query params as RecipeSelector uses internally, so this shares its
  // React Query cache instead of firing a second fetch.
  const { data: recipesData } = useRecipesForSelector(storeId, {
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    skip: 0,
    take: 100,
  });
  const allRecipes = recipesData?.recipes || [];

  // Auto-calculate cost price from linked recipes' cost-per-unit (costPerBatch /
  // yieldQuantity, summed across every linked recipe) whenever recipes are selected.
  const recipeIdsKey = recipeIds.slice().sort().join(",");
  useEffect(() => {
    if (recipeIds.length === 0 || allRecipes.length === 0) return;
    const linked = allRecipes.filter((r) => recipeIds.includes(r.id));
    if (linked.length === 0) return;

    const totalBaseCost = linked.reduce((sum, r) => {
      const yieldQty = Number(r.yieldQuantity);
      return sum + (yieldQty > 0 ? Number(r.costPerBatch) / yieldQty : 0);
    }, 0);

    if (totalBaseCost > 0) {
      form.setValue("costPrice", Number(convertPrice(totalBaseCost).toFixed(2)), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeIdsKey, allRecipes]);

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
      const currentStock = data.currentStock ?? 0;
      const minStock = data.minStock ?? 0;
      const maxStock = data.maxStock ?? 1000;

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
      // Note: retailPrice maps to sellingPrice
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const apiData = {
        sku: data.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        costPrice: round2(convertToBase(costPrice)),
        sellingPrice: round2(convertToBase(retailPrice)),
        currentStock: currentStock,
        unit: data.unit,
        minStock: minStock,
        maxStock: maxStock,
        recipeIds: data.recipeIds && data.recipeIds.length > 0 ? data.recipeIds : undefined,
        storeId,
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
          return (
            t("data.products.toasts.added.description")?.replace("{name}", data.name) ||
            "Product added successfully"
          );
        },
        error: (err) => {
          // Re-open on error
          isSubmittingRef.current = false;
          setOpen(true);
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
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {recipeIds.length > 0
                          ? t("data.products.form.costPriceFromRecipesHint")
                          : t("data.products.form.costPriceHint")}
                      </FormDescription>
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
              {costPrice && costPrice > 0 && (
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
