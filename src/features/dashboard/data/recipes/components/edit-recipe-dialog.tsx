"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  useUpdateRecipe,
  getRecipeType,
  RECIPE_TYPE_OPTIONS,
  type RecipeWithIngredients,
} from "../hooks/use-recipes";
import { useMaterials } from "../../materials/hooks/use-materials";
import { updateRecipeFormSchema } from "@/lib/validation/inventory.schemas";
import { cn } from "@/lib/utils";
import { getCurrencySymbol, formatDerivedUnitCost } from "@/lib/utils/formatting";
import { formatNumberForInput, createNumberInputHandler } from "@/lib/utils/number-input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";

import { getTranslatedCategory, RECIPE_CATEGORIES } from "../utils/category-helpers";
import { convertUnit } from "@/lib/utils/unit-conversion";

/**
 * The shared form schema in `inventory.schemas.ts` does not carry `type` yet,
 * so extend it here.
 *
 * A BARE enum with NO `.default()` on purpose: `zodResolver` infers useForm's
 * field type from the schema's INPUT type, and a `.default()` makes the input
 * optional while the output is required — the two desync and the field lands
 * as `unknown`. `.optional()` here only mirrors the surrounding `.partial()`
 * update schema; the starting value comes from `defaultValues` / `form.reset`.
 */
const editRecipeFormSchema = updateRecipeFormSchema.extend({
  type: z.enum(["KITCHEN", "BATCH"]).optional(),
});

type RecipeFormValues = z.infer<typeof editRecipeFormSchema>;

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
    resolver: zodResolver(editRecipeFormSchema),
    mode: "onSubmit", // Validate only on submit to allow undefined values during editing
    defaultValues: {
      name: "",
      description: "",
      category: "",
      department: "KITCHEN",
      // Set here rather than via `.default()` on the schema (see note above).
      type: "KITCHEN",
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
        // Recipe.department is drawn from the shared Department enum but,
        // unlike Material, a recipe is never assigned "BOTH".
        department: (recipe.department as "KITCHEN" | "BAR" | undefined) ?? "KITCHEN",
        // Recipes written before Recipe.type existed come back without it —
        // every one of those is cooked to order.
        type: getRecipeType(recipe),
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

  // What one batch makes, live from whatever the yield fields currently hold.
  // Empty string means "not enough typed in yet to say".
  const watchedYieldQuantity = form.watch("yieldQuantity");
  const watchedYieldUnit = form.watch("yieldUnit");
  const batchYieldLabel =
    watchedYieldQuantity && watchedYieldQuantity > 0
      ? `${watchedYieldQuantity}${watchedYieldUnit ? ` ${watchedYieldUnit}` : ""}`
      : "";

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
          const fieldSummary = applyServerFieldErrors(form, err);
          if (fieldSummary) return fieldSummary;
          return err instanceof Error ? err.message : t("messages.errorLoadingRecipes");
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
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="2"
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

              {/* How the recipe is PRODUCED. Sits right under the yield because
                  the two are read together: the yield is what one whole batch
                  makes. */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">{t("data.recipes.type.label")}</FormLabel>
                    <FormControl>
                      <div
                        role="radiogroup"
                        aria-label={t("data.recipes.type.label")}
                        className="grid gap-2 sm:grid-cols-2"
                      >
                        {RECIPE_TYPE_OPTIONS.map((option) => {
                          const isSelected = field.value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => field.onChange(option.value)}
                              className={cn(
                                // The whole card is the tap target, min 44px
                                // tall. Nothing here is hover-gated.
                                "flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/5 ring-primary/40 ring-1"
                                  : "border-border bg-background hover:bg-muted/50"
                              )}
                            >
                              <span className="flex w-full items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                                    isSelected ? "border-primary" : "border-muted-foreground/50"
                                  )}
                                >
                                  {isSelected && (
                                    <span className="bg-primary size-2 rounded-full" />
                                  )}
                                </span>
                                <span className="text-sm font-medium">{t(option.labelKey)}</span>
                              </span>
                              <span className="text-muted-foreground text-xs leading-snug">
                                {t(option.descriptionKey)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    {/* The thing owners get wrong: a batch is indivisible. Say
                        what THIS batch makes, at the moment they pick. */}
                    {field.value === "BATCH" && (
                      <p className="border-primary/40 bg-primary/5 text-foreground mt-1 rounded-md border border-dashed p-2 text-xs leading-snug">
                        {batchYieldLabel
                          ? t("data.recipes.type.batchHint").replace("{n}", batchYieldLabel)
                          : t("data.recipes.type.batchHintNoYield")}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                  const ingredientUnit = form.watch(`ingredients.${index}.unit`) || "";
                  const cost = selectedMaterial
                    ? Number(selectedMaterial.unitCost) *
                      convertUnit(quantity, ingredientUnit, selectedMaterial.unit)
                    : 0;

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
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  const material = materials.find((m) => m.id === value);
                                  if (material) {
                                    form.setValue(`ingredients.${index}.unit`, material.unit, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                      shouldTouch: true,
                                    });
                                  }
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue
                                      placeholder={t("data.recipes.ingredients.selectMaterial")}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {[...materials]
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((material) => (
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
                                  <DecimalInput
                                    decimals={3}
                                    min={0}
                                    placeholder="0"
                                    className="h-9"
                                    value={field.value}
                                    onChange={field.onChange}
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
                                    placeholder=""
                                    className="bg-muted text-muted-foreground h-9"
                                    {...field}
                                    value={selectedMaterial?.unit || field.value || ""}
                                    disabled={true}
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

                        {selectedMaterial && Number(quantity) > 0 && (
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
                              {getCurrencySymbol(currency)}
                              {formatDerivedUnitCost(
                                convertPrice(Number(selectedMaterial.unitCost))
                              )}{" "}
                              {t("common.per")} {selectedMaterial.unit} × {quantity}
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
