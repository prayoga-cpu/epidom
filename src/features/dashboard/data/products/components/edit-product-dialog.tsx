"use client";

import { useState, useEffect, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Product, RecipeProduct, Recipe } from "@prisma/client";

type ProductWithRecipes = Product & {
  recipeProducts?: Array<RecipeProduct & { recipe: Recipe }>;
};
import { useI18n } from "@/components/lang/i18n-provider";
import { useUpdateProduct, useLinkedMenuItem } from "../hooks/use-products";
import { toast as sonnerToast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatNumberForInput, createNumberInputHandler } from "@/lib/utils/number-input";
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
  const { data: linkedMenuItem } = useLinkedMenuItem(storeId, product.id);

  const isSubmittingRef = useRef(false);
  const savedFormDataRef = useRef<ProductFormValues | null>(null);

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
  const suggestedRetailPrice = costPrice && costPrice > 0 ? (costPrice * 2.5).toFixed(2) : "0.00";

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

      // Detect name/price drift vs linked MenuItem — offer sync after save
      const prevName = product.name;
      const prevPrice = Number(product.sellingPrice);
      const nameChanged = data.name !== prevName;
      const priceChanged = Math.abs(convertToBase(retailPrice) - prevPrice) > 0.001;
      const hasDrift = linkedMenuItem && (nameChanged || priceChanged);

      sonnerToast.promise(promise, {
        loading: t("common.actions.saving"),
        success: () => {
          isSubmittingRef.current = false;
          savedFormDataRef.current = null;
          if (hasDrift) {
            // Offer to propagate the change to the linked MenuItem
            sonnerToast(
              t("data.products.toasts.syncMenuPrompt") || "Price/name changed. Sync to POS menu?",
              {
                action: {
                  label: t("data.products.toasts.syncMenuAction") || "Sync",
                  onClick: async () => {
                    await fetch(`/api/stores/${storeId}/storefront/items/${linkedMenuItem.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: data.name, price: convertToBase(retailPrice) }),
                    });
                    sonnerToast.success(t("data.products.toasts.syncMenuDone") || "POS menu updated");
                  },
                },
              }
            );
          }
          return t("data.products.toasts.updated.title") || "Product updated";
        },
        error: (err) => {
          isSubmittingRef.current = false;
          onOpenChange(true);
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
                      <FormDescription className="text-xs">
                        {t("data.products.form.skuHint")}
                      </FormDescription>
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
                      <Input placeholder={t("data.products.form.categoryPlaceholder")} {...field} />
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
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.products.form.costPriceHint")}
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
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={suggestedRetailPrice}
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
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
                        <Input
                          type="number"
                          placeholder="0"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
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
                        <Input
                          type="number"
                          placeholder="0"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
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
                        <Input
                          type="number"
                          placeholder="1000"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
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
