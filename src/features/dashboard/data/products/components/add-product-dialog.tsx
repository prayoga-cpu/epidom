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
import { Plus, Loader2, ChefHat } from "lucide-react";
import { MOCK_RECIPES } from "@/mocks";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";

// Zod validation schema
const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  sku: z.string().optional(),
  description: z.string().optional(),
  recipeId: z.string().optional(),
  category: z.string().min(1, "Please enter a category"),
  retailPrice: z.coerce.number().positive("Retail price must be greater than 0"),
  wholesalePrice: z.coerce
    .number()
    .positive("Wholesale price must be greater than 0")
    .optional()
    .or(z.literal(0)),
  costPrice: z.coerce.number().positive("Cost price must be greater than 0"),
  unit: z.string().min(1, "Please enter a unit"),
  currentStock: z.coerce.number().min(0, "Stock cannot be negative"),
  minStock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  maxStock: z.coerce.number().positive("Maximum stock must be greater than 0"),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface AddProductDialogProps {
  children?: React.ReactNode;
}

export default function AddProductDialog({ children }: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      recipeId: "none",
      category: "",
      retailPrice: 0,
      wholesalePrice: 0,
      costPrice: 0,
      unit: "unit",
      currentStock: 0,
      minStock: 0,
      maxStock: 0,
      imageUrl: "",
    },
  });

  // Watch recipe selection to auto-fill category and calculate suggested prices
  const selectedRecipeId = form.watch("recipeId");
  const costPrice = form.watch("costPrice");

  // Auto-suggest retail price based on 2.5x markup
  const suggestedRetailPrice = costPrice ? (costPrice * 2.5).toFixed(2) : "0.00";
  // Auto-suggest wholesale price based on 1.8x markup
  const suggestedWholesalePrice = costPrice ? (costPrice * 1.8).toFixed(2) : "0.00";

  const onSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Convert "none" to undefined for API
    const submitData = {
      ...data,
      recipeId: data.recipeId === "none" ? undefined : data.recipeId,
    };

    // TODO: Replace with actual API call
    // const response = await fetch("/api/products", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     ...submitData,
    //     storeId: "STORE-001", // Get from context/session
    //   }),
    // });

    console.log("Product data to submit:", submitData);

    setIsSubmitting(false);
    toast({
      title: "Product Added Successfully",
      description: `${data.name} has been added to your products.`,
    });

    form.reset();
    setOpen(false);
  };

  // Update category when recipe is selected
  const handleRecipeChange = (recipeId: string) => {
    if (recipeId === "none") {
      // No recipe selected, don't auto-fill
      return;
    }
    const recipe = MOCK_RECIPES.find((r) => r.id === recipeId);
    if (recipe) {
      form.setValue("category", recipe.category || "");
      // Optionally set cost price based on recipe cost per unit
      if (recipe.costPerBatch && recipe.yieldQuantity) {
        const costPerUnit = recipe.costPerBatch / recipe.yieldQuantity;
        form.setValue("costPrice", parseFloat(costPerUnit.toFixed(2)));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("common.actions.add") || "Add Product"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{t("data.products.addTitle") || "Add New Product"}</DialogTitle>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="recipeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <ChefHat className="mr-1 inline h-4 w-4" />
                        Linked Recipe
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleRecipeChange(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.products.form.selectRecipe")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No recipe</SelectItem>
                          {MOCK_RECIPES.map((recipe) => (
                            <SelectItem key={recipe.id} value={recipe.id}>
                              {recipe.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Link to production recipe</FormDescription>
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
              </div>

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.products.form.imageUrlPlaceholder")} {...field} />
                    </FormControl>
                    <FormDescription>Product image URL (optional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price *</FormLabel>
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
                  name="wholesalePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wholesale Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={suggestedWholesalePrice}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>B2B price (optional)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retailPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price *</FormLabel>
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
                  <p className="font-medium">Suggested Pricing:</p>
                  <ul className="text-muted-foreground mt-1 space-y-0.5">
                    <li>• Wholesale: ${suggestedWholesalePrice} (1.8x markup)</li>
                    <li>• Retail: ${suggestedRetailPrice} (2.5x markup)</li>
                  </ul>
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
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormDescription>Storage limit</FormDescription>
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
                {t("actions.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.actions.add") || "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
