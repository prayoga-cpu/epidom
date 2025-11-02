"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Package } from "lucide-react";
import { MOCK_MATERIALS } from "@/mocks";
import type { Recipe } from "@/types/entities";
import { useI18n } from "@/components/lang/i18n-provider";

// Same schema as add-recipe-dialog
const ingredientSchema = z.object({
  materialId: z.string().min(1, "Material is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  notes: z.string().optional(),
});

const recipeSchema = z.object({
  name: z.string().min(2, "Recipe name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  yieldQuantity: z.coerce.number().positive("Yield quantity must be greater than 0"),
  yieldUnit: z.string().min(1, "Yield unit is required"),
  productionTimeMinutes: z.coerce.number().positive("Production time must be greater than 0"),
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient is required"),
  instructions: z.string().min(10, "Instructions must be at least 10 characters"),
});

type RecipeFormValues = z.infer<typeof recipeSchema>;

interface EditRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe;
}

const RECIPE_CATEGORIES = [
  "Bread & Pastries",
  "Cakes & Desserts",
  "Confectionery",
  "Dairy Products",
  "Beverages",
  "Sauces & Condiments",
  "Other",
];

export default function EditRecipeDialog({ open, onOpenChange, recipe }: EditRecipeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      yieldQuantity: 0,
      yieldUnit: "",
      productionTimeMinutes: 0,
      ingredients: [],
      instructions: "",
    },
  });

  // Populate form when recipe changes
  useEffect(() => {
    if (recipe && open) {
      form.reset({
        name: recipe.name,
        description: recipe.description || "",
        category: recipe.category || "",
        yieldQuantity: recipe.yieldQuantity,
        yieldUnit: recipe.yieldUnit,
        productionTimeMinutes: recipe.productionTimeMinutes,
        ingredients: recipe.ingredients.map((ing) => ({
          materialId: ing.materialId,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes || "",
        })),
        instructions: recipe.instructions || "",
      });
    }
  }, [recipe, open, form]);

  const onSubmit = async (data: RecipeFormValues) => {
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: Replace with actual API call
    // const response = await fetch(`/api/recipes/${recipe.id}`, {
    //   method: "PATCH",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(data),
    // });

    setIsSubmitting(false);
    toast({
      title: t("data.recipes.toasts.updated.title") || "Recipe Updated Successfully",
      description: t("data.recipes.toasts.updated.description")?.replace("{name}", data.name) || `${data.name} has been updated.`,
    });

    onOpenChange(false);
  };

  const addIngredient = () => {
    const currentIngredients = form.watch("ingredients");
    form.setValue("ingredients", [
      ...currentIngredients,
      { materialId: "", quantity: 0, unit: "", notes: "" },
    ]);
  };

  const removeIngredient = (index: number) => {
    const currentIngredients = form.watch("ingredients");
    form.setValue(
      "ingredients",
      currentIngredients.filter((_, i) => i !== index)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("data.recipes.editTitle") || "Edit Recipe"}</DialogTitle>
          <DialogDescription>
            {t("data.recipes.editDescription") || "Update the recipe details, ingredients, and instructions."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">{t("data.recipes.sections.basicInfo") || "Basic Information"}</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.recipes.form.name") || "Recipe Name"} *</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.recipes.form.namePlaceholder") || "Artisan Sourdough Bread"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.recipes.form.description") || "Description"}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.recipes.form.descriptionPlaceholder") || "Traditional sourdough bread with a crispy crust..."}
                        rows={2}
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
                    <FormLabel>{t("data.recipes.form.category") || "Category"} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("data.recipes.form.selectCategory") || "Select category"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RECIPE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="yieldQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.recipes.form.yieldQuantity") || "Yield Quantity"} *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" placeholder="2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="yieldUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.recipes.form.yieldUnit") || "Yield Unit"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.recipes.form.selectUnit") || "Unit"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="mL">mL</SelectItem>
                          <SelectItem value="units">units</SelectItem>
                          <SelectItem value="loaves">loaves</SelectItem>
                          <SelectItem value="pieces">pieces</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productionTimeMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.recipes.form.productionTime") || "Time (min)"} *</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="180" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Ingredients */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t("data.recipes.ingredients.title") || "Ingredients"}</h3>
                <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("data.recipes.ingredients.addIngredient") || "Add"}
                </Button>
              </div>

              {form.watch("ingredients").length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                    <Package className="text-muted-foreground mb-2 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">No ingredients added</p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {form.watch("ingredients").map((_, index) => {
                  const selectedMaterialId = form.watch(`ingredients.${index}.materialId`);
                  const selectedMaterial = MOCK_MATERIALS.find((m) => m.id === selectedMaterialId);

                  return (
                    <Card key={index}>
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredient(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.materialId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Material *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("data.recipes.ingredients.selectMaterial") || "Select material"} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {MOCK_MATERIALS.map((material) => (
                                    <SelectItem key={material.id} value={material.id}>
                                      {material.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid items-start gap-3 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="500"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.unit`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit *</FormLabel>
                                <FormControl>
                                  <Input placeholder={selectedMaterial?.unit || "g"} {...field} />
                                </FormControl>
                                {selectedMaterial && (
                                  <FormDescription className="text-xs">
                                    Material unit: {selectedMaterial.unit}
                                  </FormDescription>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {selectedMaterial && (
                          <div className="bg-muted rounded-md p-2 text-xs">
                            Cost: $
                            {(
                              selectedMaterial.costPerUnit *
                              (form.watch(`ingredients.${index}.quantity`) || 0)
                            ).toFixed(2)}
                          </div>
                        )}

                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Input placeholder={t("data.recipes.ingredients.notesPlaceholder") || "Optional notes"} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <h3 className="font-semibold">{t("data.recipes.steps.instructions") || "Instructions"}</h3>
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.recipes.form.instructions") || "Cooking Instructions"} *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.recipes.form.instructionsPlaceholder") || "Step-by-step instructions..."}
                        rows={8}
                        className="font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("actions.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("data.recipes.update") || "Update Recipe"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
