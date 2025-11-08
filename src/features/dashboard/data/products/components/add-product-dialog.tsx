"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast as sonnerToast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";

// Zod validation schema
const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1, "Please enter a category"),
  retailPrice: z.coerce.number().positive("Retail price must be greater than 0"),
  costPrice: z.coerce.number().positive("Cost price must be greater than 0"),
  unit: z.string().min(1, "Please enter a unit"),
  currentStock: z.coerce.number().min(0, "Stock cannot be negative"),
  minStock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  maxStock: z.coerce.number().positive("Maximum stock must be greater than 0"),
  recipeId: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

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

  // Fetch recipes for selection
  const { data: recipesData } = useRecipes(storeId, {
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    skip: 0,
    take: 100,
  });
  const recipes = recipesData?.recipes || [];

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      category: "",
      retailPrice: 0,
      costPrice: 0,
      unit: "piece",
      currentStock: 0,
      minStock: 0,
      maxStock: 1000,
      recipeId: "none",
    },
  });

  const costPrice = form.watch("costPrice");

  // Auto-suggest retail price based on 2.5x markup
  const suggestedRetailPrice = costPrice ? (costPrice * 2.5).toFixed(2) : "0.00";

  const isSubmitting = createProduct.isPending;

  const onSubmit = async (data: ProductFormValues) => {
    try {
      // Map form fields to API schema
      // Note: retailPrice maps to sellingPrice
      const apiData = {
        sku: data.sku || `PRD-${Date.now()}`, // Auto-generate SKU if not provided
        name: data.name,
        description: data.description,
        category: data.category,
        costPrice: convertToBase(data.costPrice), // Convert to EUR
        sellingPrice: convertToBase(data.retailPrice), // Convert to EUR
        currentStock: data.currentStock,
        unit: data.unit,
        minStock: data.minStock,
        maxStock: data.maxStock,
        recipeId: data.recipeId || undefined,
        storeId,
        isActive: true,
      };

      await createProduct.mutateAsync(apiData);

      sonnerToast.success(t("data.products.toasts.created.title") || "Product created", {
        description:
          t("data.products.toasts.created.description")?.replace("{name}", data.name) ||
          `${data.name} has been added to your products.`,
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Error creating product:", error);
      sonnerToast.error(t("data.products.toasts.createError.title") || "Failed to create product", {
        description:
          error instanceof Error
            ? error.message
            : t("data.products.toasts.createError.description") ||
              "An error occurred while creating the product.",
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{t("data.products.addTitle")}</DialogTitle>
          <DialogDescription>
            Add a new product to your inventory. Link it to a recipe for automatic cost calculation.
          </DialogDescription>
        </DialogHeader>
        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
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
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.products.form.skuPlaceholder")} {...field} />
                      </FormControl>
                      <FormDescription>Stock Keeping Unit (optional)</FormDescription>
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
                    <FormLabel>Description</FormLabel>
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
                    <FormLabel>Category *</FormLabel>
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
                    <FormLabel>Recipe (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? undefined : value)
                      }
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a recipe..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {recipes.map((recipe) => (
                          <SelectItem key={recipe.id} value={recipe.id}>
                            {recipe.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Link this product to a production recipe</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDescription>Production cost</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retailPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={suggestedRetailPrice}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Customer price</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {costPrice > 0 && (
                <div className="bg-muted rounded-lg p-3 text-sm">
                  <p className="font-medium">Suggested Selling Price:</p>
                  <p className="text-muted-foreground mt-1">
                    ${suggestedRetailPrice} (2.5x markup)
                  </p>
                </div>
              )}
            </div>

            {/* Stock Management */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Stock Management</h3>
              <div className="grid items-start gap-4 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unit">Unit</SelectItem>
                          <SelectItem value="loaf">Loaf</SelectItem>
                          <SelectItem value="piece">Piece</SelectItem>
                          <SelectItem value="dozen">Dozen</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
                          <SelectItem value="kg">Kilogram</SelectItem>
                          <SelectItem value="g">Gram</SelectItem>
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
                      <FormLabel>Current Stock *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
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
                      <FormLabel>Min Stock *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormDescription>Reorder point</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Stock *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1000" {...field} />
                      </FormControl>
                      <FormDescription>Maximum stock level</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("data.products.addButton")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
