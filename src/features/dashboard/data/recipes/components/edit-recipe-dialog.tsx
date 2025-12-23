"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
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
import { Loader2, Plus, X, Package } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { useUpdateRecipe, type RecipeWithIngredients } from "../hooks/use-recipes";
import { useMaterials } from "../../materials/hooks/use-materials";
import { updateRecipeFormSchema } from "@/lib/validation/inventory.schemas";
import type { UpdateRecipeFormInput } from "@/lib/validation/inventory.schemas";
import { formatNumberForInput, createNumberInputHandler } from "@/lib/utils/number-input";

import { getTranslatedCategory, RECIPE_CATEGORIES } from "../utils/category-helpers";

type RecipeFormValues = UpdateRecipeFormInput;

interface EditRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeWithIngredients;
}

export default function EditRecipeDialog({ open, onOpenChange, recipe }: EditRecipeDialogProps) {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;
  const { currency, convertPrice, formatPrice } = useCurrency();

  // Recipe categories with translation - store English values, display translated labels
  const getRecipeCategories = () => [
    { value: "Bread & Pastries", label: t("data.recipes.categories.breadPastries") },
    { value: "Cakes & Desserts", label: t("data.recipes.categories.cakesDesserts") },
    { value: "Confectionery", label: t("data.recipes.categories.confectionery") },
    { value: "Dairy Products", label: t("data.recipes.categories.dairyProducts") },
    { value: "Beverages", label: t("data.recipes.categories.beverages") },
    { value: "Sauces & Condiments", label: t("data.recipes.categories.saucesCondiments") },
    { value: "Other", label: t("data.recipes.categories.other") },
  ];

  // Fetch real materials for dropdown
  const { data: materialsData } = useMaterials(storeId);
  const materials = materialsData?.materials || [];

  const updateRecipe = useUpdateRecipe(storeId, recipe.id);

  const isSubmittingRef = useRef(false);
  const savedFormDataRef = useRef<RecipeFormValues | null>(null);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(updateRecipeFormSchema),
    mode: "onSubmit", // Validate only on submit to allow undefined values during editing
    defaultValues: {
      name: "",
      description: "",
      category: "",
      yieldQuantity: undefined,
      yieldUnit: "",
      productionTimeMinutes: undefined,
      ingredients: [],
      instructions: "",
    },
  });

  // Populate form when recipe changes or dialog opens
  useEffect(() => {
    if (!open) return;

    // If we have saved data from a failed submission, restore it
    if (savedFormDataRef.current) {
      // Delay reset slightly to ensure form is ready
      requestAnimationFrame(() => {
        form.reset(savedFormDataRef.current!);
      });
      return;
    }

    if (recipe) {
      const yieldQuantity = Number(recipe.yieldQuantity) || 0;
      const productionTimeMinutes = recipe.productionTimeMinutes || 0;

      form.reset({
        name: recipe.name,
        description: recipe.description || "",
        category: recipe.category || "",
        yieldQuantity: yieldQuantity > 0 ? yieldQuantity : undefined,
        yieldUnit: recipe.yieldUnit,
        productionTimeMinutes: productionTimeMinutes > 0 ? productionTimeMinutes : undefined,
        ingredients: recipe.ingredients.map((ing) => ({
          materialId: ing.materialId,
          /**
           * Type assertion needed because quantity field accepts number | undefined
           * but TypeScript requires explicit type for undefined in object literal
           * Actual type: number | undefined
           * TODO: Use proper type for quantity field
           */
          quantity: (Number(ing.quantity) || undefined) as any, // Allow undefined in form state for better UX
          unit: ing.unit,
          notes: ing.notes || "",
        })),
        instructions: recipe.instructions || "",
      });
    }
  }, [recipe, open, form]);

  const handleOpenChange = (newOpen: boolean) => {
    // If closing manually (not submitting), clear saved data
    if (!newOpen && !isSubmittingRef.current) {
      savedFormDataRef.current = null;
    }
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: RecipeFormValues) => {
    try {
      // Validate and convert undefined to defaults for required fields
      const yieldQuantity = data.yieldQuantity ?? (Number(recipe.yieldQuantity) || 0);
      const productionTimeMinutes =
        data.productionTimeMinutes ?? (recipe.productionTimeMinutes || 0);

      // Validate required fields
      if (yieldQuantity <= 0) {
        form.setError("yieldQuantity", {
          type: "manual",
          message: "Yield quantity must be positive",
        });
        return;
      }

      if (productionTimeMinutes <= 0) {
        form.setError("productionTimeMinutes", {
          type: "manual",
          message: "Production time must be at least 1 minute",
        });
        return;
      }

      // Process ingredients - convert undefined quantities to 0 or validate
      const processedIngredients = (data.ingredients || []).map((ing) => ({
        ...ing,
        quantity: ing.quantity ?? 0,
      }));

      // Validate ingredients
      if (processedIngredients.length === 0) {
        form.setError("ingredients", {
          type: "manual",
          message: "At least one ingredient is required",
        });
        return;
      }

      const payload = {
        ...data,
        yieldQuantity,
        productionTimeMinutes,
        ingredients: processedIngredients,
      };

      // OPTIMISTIC CLOSING
      // Save form data in case we need to restore it
      savedFormDataRef.current = data;
      isSubmittingRef.current = true;
      onOpenChange(false);

      const promise = updateRecipe.mutateAsync(payload);

      toast.promise(promise, {
        loading: t("data.recipes.toasts.updating") || "Updating recipe...",
        success: () => {
          isSubmittingRef.current = false;
          savedFormDataRef.current = null; // Clear saved data on success
          return t("data.recipes.toasts.updated.title");
        },
        error: (err) => {
          isSubmittingRef.current = false;
          // Re-open dialog, useEffect will restore savedFormDataRef
          onOpenChange(true);
          return t("messages.errorLoadingRecipes");
        },
      });

      await promise;
    } catch (error) {
      // Handled by toast promise
      console.error(error);
    }
  };

  const addIngredient = () => {
    const currentIngredients = form.getValues("ingredients") || [];
    form.setValue(
      "ingredients",
      /**
       * Type assertion needed because quantity field accepts number | undefined
       * but TypeScript requires explicit type for undefined in object literal
       * Actual type: number | undefined
       * TODO: Use proper type for quantity field
       */
      [...currentIngredients, { materialId: "", quantity: undefined as any, unit: "", notes: "" }],
      { shouldValidate: false, shouldDirty: true, shouldTouch: true }
    );
  };

  const removeIngredient = (index: number) => {
    const currentIngredients = form.getValues("ingredients") || [];
    form.setValue(
      "ingredients",
      currentIngredients.filter((_, i) => i !== index),
      { shouldValidate: false, shouldDirty: true }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FormDialogLayout
        title={t("data.recipes.editTitle")}
        description={t("data.recipes.editDescription")}
        maxWidth="xl"
        footer={
          <FormDialogFooter
            formId="edit-recipe-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("data.recipes.update")}
            isPending={updateRecipe.isPending}
          />
        }
      >
        <Form {...form}>
          <form id="edit-recipe-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
            {/* Basic Information */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.recipes.sections.basicInfo")}
              </h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">{t("data.recipes.form.name")} *</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.recipes.form.namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">{t("data.recipes.form.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.recipes.form.descriptionPlaceholder")}
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
                    <FormLabel className="text-sm">{t("data.recipes.form.category")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("data.recipes.form.selectCategory")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RECIPE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {getTranslatedCategory(category, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid items-start gap-1.5 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="yieldQuantity"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.recipes.form.yieldQuantity")} *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="2"
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
                  name="yieldUnit"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.recipes.form.yieldUnit")} *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.recipes.form.selectUnit")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="kg">{t("data.recipes.units.kg")}</SelectItem>
                          <SelectItem value="g">{t("data.recipes.units.g")}</SelectItem>
                          <SelectItem value="L">{t("data.recipes.units.l")}</SelectItem>
                          <SelectItem value="mL">{t("data.recipes.units.ml")}</SelectItem>
                          <SelectItem value="units">{t("data.recipes.units.units")}</SelectItem>
                          <SelectItem value="loaves">{t("data.recipes.units.loaves")}</SelectItem>
                          <SelectItem value="pieces">{t("data.recipes.units.pieces")}</SelectItem>
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
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.recipes.form.productionTime")} *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder={t("data.recipes.form.productionTimePlaceholder")}
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.recipes.form.productionTimeHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Ingredients */}
            <div className="space-y-1">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("data.recipes.ingredients.title")}
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                  <Plus className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("data.recipes.ingredients.addIngredient")}
                </Button>
              </div>

              {(form.watch("ingredients") || []).length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center px-4 py-6 text-center">
                    <Package className="text-muted-foreground mb-2 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.ingredients.noIngredients")}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-1">
                {(form.watch("ingredients") || []).map((_, index) => {
                  const selectedMaterialId = form.watch(`ingredients.${index}.materialId`);
                  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);
                  const quantity = form.watch(`ingredients.${index}.quantity`) || 0;
                  const cost = selectedMaterial ? Number(selectedMaterial.unitCost) * quantity : 0;

                  return (
                    <Card key={index} className="relative overflow-hidden">
                      <CardContent className="space-y-3 px-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="font-semibold">
                            {t("data.recipes.ingredients.ingredientNumber")?.replace(
                              "{number}",
                              (index + 1).toString()
                            ) || `Ingredient ${index + 1}`}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-6 w-6"
                            onClick={() => removeIngredient(index)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.materialId`}
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-sm font-medium">
                                {t("data.recipes.ingredients.material")} *
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue
                                      placeholder={t("data.recipes.ingredients.selectMaterial")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {materials.map((material) => (
                                    <SelectItem key={material.id} value={material.id}>
                                      {material.name}
                                      {material.category && (
                                        <span className="text-muted-foreground">
                                          {" "}
                                          ({material.category.replace("_", " ")})
                                        </span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        <div className="grid items-start gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className="text-sm font-medium">
                                  {t("data.recipes.ingredients.quantity")} *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0"
                                    className="h-9"
                                    value={formatNumberForInput(field.value)}
                                    onChange={createNumberInputHandler(field.onChange)}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.unit`}
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className="text-sm font-medium">
                                  {t("data.recipes.ingredients.unit")} *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={selectedMaterial?.unit || "g"}
                                    className="h-9"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.notes`}
                          render={({ field }) => (
                            <FormItem className="space-y-1.5">
                              <FormLabel className="text-sm font-medium">
                                {t("data.recipes.ingredients.notes")}
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={t("data.recipes.ingredients.notesPlaceholder")}
                                  className="min-h-[120px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        {selectedMaterial && quantity && quantity > 0 && (
                          <div className="bg-muted/50 rounded-md p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground font-medium">
                                {t("data.recipes.ingredients.costEstimate")}:
                              </span>
                              <span className="text-foreground font-semibold">
                                {formatPrice(cost)}
                              </span>
                            </div>
                            <div className="text-muted-foreground mt-1">
                              {formatPrice(Number(selectedMaterial.unitCost))} {t("common.per")}{" "}
                              {selectedMaterial.unit} × {quantity}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.recipes.steps.instructions")}
              </h3>
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">
                      {t("data.recipes.form.instructions")} *
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.recipes.form.instructionsPlaceholder")}
                        className="min-h-[200px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
