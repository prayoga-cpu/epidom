"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Plus, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCreateProduct } from "../hooks/use-products";
import { useRecipes } from "../../recipes/hooks/use-recipes";
import { useProductUsage } from "../hooks/use-product-usage";
import { toast as sonnerToast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { FORM_DEFAULTS } from "@/lib/config/form-defaults";
import {
  formatNumberForInput,
  createNumberInputHandler,
} from "@/lib/utils/number-input";

// Helper function to create product schema with translated messages
// Note: Number fields allow undefined in form state (for better UX - can clear field),
// validation happens in onSubmit after converting undefined to defaults
function createProductSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("common.validation.productNameMin")),
    sku: z.string().min(1, "SKU is required").max(50, "SKU is too long"),
    description: z.string().optional(),
    category: z.string().min(1, t("common.validation.categoryRequired")),
    retailPrice: z.union([z.number().positive(t("common.validation.pricePositive")), z.undefined()]),
    costPrice: z.union([z.number().positive(t("common.validation.pricePositive")), z.undefined()]),
    unit: z.string().min(1, t("common.validation.unitRequired")),
    currentStock: z.union([z.number().min(0, t("common.validation.stockNonNegative")), z.undefined()]),
    minStock: z.union([z.number().min(0, t("common.validation.minStockNonNegative")), z.undefined()]),
    maxStock: z.union([z.number().positive(t("common.validation.maxStockPositive")), z.undefined()]),
    recipeId: z.string().optional(),
  });
}

type ProductFormValues = z.infer<ReturnType<typeof createProductSchema>>;

interface AddProductDialogProps {
  storeId: string;
  children?: React.ReactNode;
}

export default function AddProductDialog({ storeId, children }: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();
  const { currency, convertToBase } = useCurrency();
  const createProduct = useCreateProduct(storeId);
  const { data: productUsage, isLoading: isLoadingUsage } = useProductUsage(storeId);

  // Fetch recipes for selection
  const { data: recipesData } = useRecipes(storeId, {
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    skip: 0,
    take: 100,
  });
  const recipes = recipesData?.recipes || [];

  // Check if user can create more products
  const canCreateMore = productUsage?.canCreateMore ?? true;
  const productLimitReached = !isLoadingUsage && !canCreateMore;

  const productSchema = createProductSchema(t);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: "onSubmit", // Validate only on submit to allow undefined values during editing
    defaultValues: {
      ...FORM_DEFAULTS.product,
      recipeId: "none",
    },
  });

  const costPrice = form.watch("costPrice");

  // Auto-suggest retail price based on 2.5x markup
  const suggestedRetailPrice = costPrice && costPrice > 0 ? (costPrice * 2.5).toFixed(2) : "0.00";

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
      const apiData = {
        sku: data.sku,
        name: data.name,
        description: data.description,
        category: data.category,
        costPrice: convertToBase(costPrice), // Convert to EUR
        sellingPrice: convertToBase(retailPrice), // Convert to EUR
        currentStock: currentStock,
        unit: data.unit,
        minStock: minStock,
        maxStock: maxStock,
        recipeId: data.recipeId || undefined,
        storeId,
        isActive: true,
      };

      await createProduct.mutateAsync(apiData);

      sonnerToast.success(t("data.products.toasts.added.title"), {
        description: t("data.products.toasts.added.description")?.replace("{name}", data.name) || "",
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      sonnerToast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("messages.registrationFailed"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("data.products.addButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl [&>button]:hidden">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-xl font-bold sm:text-2xl">
            {t("data.products.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {t("data.products.addDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form id="add-product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Product Limit Warning */}
            {productLimitReached && productUsage && productUsage.limit !== null && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("data.products.limitReached.title") || "Product Limit Reached"}</AlertTitle>
                <AlertDescription>
                  {t("data.products.limitReached.description")?.replace("{current}", String(productUsage.current)).replace("{limit}", String(productUsage.limit)) ||
                    `You've reached your plan's product limit (${productUsage.current}/${productUsage.limit}). Upgrade to Pro for unlimited products.`}
                  <Link href="/pricing" className="ml-2 font-medium underline">
                    {t("data.products.limitReached.upgrade") || "Upgrade to Pro"}
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t("data.products.sections.basicInfo")}</h3>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.products.form.name")} *</FormLabel>
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
                    <FormItem>
                      <FormLabel>{t("data.products.form.sku")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.products.form.skuPlaceholder")} {...field} />
                      </FormControl>
                      <FormDescription>{t("data.products.form.skuHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.products.form.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.products.form.descriptionPlaceholder")}
                        className="min-h-[80px]"
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
                  <FormItem>
                    <FormLabel>{t("data.products.form.category")} *</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.products.form.categoryPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.products.form.linkedRecipe")}</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? undefined : value)
                      }
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("data.products.form.selectRecipe")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t("data.products.form.noRecipe")}</SelectItem>
                        {recipes.map((recipe) => (
                          <SelectItem key={recipe.id} value={recipe.id}>
                            {recipe.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t("data.products.form.recipeHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t("data.products.sections.pricing")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.products.form.costPrice")} ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
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
                      <FormDescription>{t("data.products.form.costPriceHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retailPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.products.form.retailPrice")} ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
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
                      <FormDescription>{t("data.products.form.retailPriceHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {costPrice && costPrice > 0 && (
                <div className="bg-muted rounded-lg p-3 text-sm">
                  <p className="font-medium">{t("data.products.pricingSuggestions.title")}</p>
                  <p className="text-muted-foreground mt-1">
                    {currency === "EUR" ? "€" : "$"}{suggestedRetailPrice} (2.5x markup)
                  </p>
                </div>
              )}
            </div>

            {/* Stock Management */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t("data.products.sections.stockManagement")}</h3>
              <div className="grid items-start gap-4 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.products.form.unit")} *</FormLabel>
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
                    <FormItem>
                      <FormLabel>{t("data.products.form.currentStock")} *</FormLabel>
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
                    <FormItem>
                      <FormLabel>{t("data.products.form.minStock")} *</FormLabel>
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
                      <FormDescription>{t("data.products.form.minStockHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.products.form.maxStock")} *</FormLabel>
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
                      <FormDescription>{t("data.products.form.maxStockHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            </form>
          </Form>
        </div>

        {/* Fixed Footer with Actions */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="add-product-form"
              disabled={isSubmitting || productLimitReached}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("data.products.addButton")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
