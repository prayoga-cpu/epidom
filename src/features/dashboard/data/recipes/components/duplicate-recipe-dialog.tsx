"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Copy,
  Package,
  DollarSign,
  Clock,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatCurrency, formatDuration } from "@/lib/utils/formatting";
import { useI18n } from "@/components/lang/i18n-provider";
import { useDuplicateRecipe, type RecipeWithIngredients } from "../hooks/use-recipes";
import { useMaterials } from "../../materials/hooks/use-materials";
import { duplicateRecipeSchema } from "@/lib/validation/inventory.schemas";
import type { DuplicateRecipeInput } from "@/lib/validation/inventory.schemas";
import { getTranslatedCategory, RECIPE_CATEGORIES } from "../utils/category-helpers";
import { convertUnit } from "@/lib/utils/unit-conversion";

type DuplicateRecipeFormValues = DuplicateRecipeInput;

interface DuplicateRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeWithIngredients;
}

export default function DuplicateRecipeDialog({
  open,
  onOpenChange,
  recipe,
}: DuplicateRecipeDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;

  // Fetch materials for displaying ingredient details
  const { data: materialsData } = useMaterials(storeId);
  const materials = materialsData?.materials || [];

  const duplicateRecipe = useDuplicateRecipe(storeId);

  const STEPS = [
    { id: 1, name: t("data.recipes.duplicateDialog.steps.basicInfo") },
    { id: 2, name: t("data.recipes.duplicateDialog.steps.review") },
  ];

  const form = useForm<DuplicateRecipeFormValues>({
    resolver: zodResolver(duplicateRecipeSchema),
    defaultValues: {
      newName: "",
    },
  });

  // Populate form when recipe changes or dialog opens
  useEffect(() => {
    if (recipe && open) {
      form.reset({
        newName: `${recipe.name} (Copy)`,
      });
      setCurrentStep(1);
    }
  }, [recipe, open, form]);

  const onSubmit = async (data: DuplicateRecipeFormValues) => {
    try {
      await duplicateRecipe.mutateAsync({
        recipeId: recipe.id,
        newName: data.newName,
      });
      toast.success(t("data.recipes.toasts.duplicated.title"));
      onOpenChange(false);
    } catch (error) {
      toast.error(t("messages.errorLoadingRecipes"));
    }
  };

  const handleNext = async () => {
    // Validate current step
    const fieldsToValidate: Array<keyof DuplicateRecipeFormValues> = ["newName"];
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  // Calculate total cost from ingredients
  const calculateTotalCost = () => {
    let total = 0;
    recipe.ingredients.forEach((ingredient) => {
      const material = materials.find((m) => m.id === ingredient.materialId);
      if (material) {
        const quantityInMaterialUnit = convertUnit(
          ingredient.quantity,
          ingredient.unit,
          material.unit
        );
        total += Number(material.unitCost) * quantityInMaterialUnit;
      }
    });
    return total;
  };

  const totalCost = calculateTotalCost();
  const costPerUnit = totalCost / recipe.yieldQuantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[700px] [&>button]:hidden">
        {/* Fixed Header */}
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Copy className="h-5 w-5" />
            {t("data.recipes.duplicateTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {t("data.recipes.duplicateDescription")}
          </DialogDescription>

          {/* Progress Indicator */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.id
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={`text-sm ${
                    currentStep === step.id
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.name}
                </span>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="text-muted-foreground mx-2 h-4 w-4" />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form
              id="duplicate-recipe-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">
                      <strong>{t("data.recipes.duplicateDialog.originalRecipe")}:</strong>{" "}
                      {recipe.name}
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="newName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("data.recipes.duplicateDialog.nameLabel")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("data.recipes.form.namePlaceholder")} {...field} />
                        </FormControl>
                        <FormDescription>
                          {t("data.recipes.duplicateDialog.nameDescription") ||
                            "Enter a unique name for the duplicated recipe. All other details will be copied from the original recipe."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {t("data.recipes.duplicateDialog.note") ||
                        "Note: All ingredients, instructions, yield, and production time will be copied from the original recipe."}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Review & Confirm */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {t("data.recipes.duplicateDialog.comparison")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-muted-foreground text-xs">
                            {t("data.recipes.duplicateDialog.originalName")}
                          </p>
                          <p className="font-medium">{recipe.name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            {t("data.recipes.duplicateDialog.newName")}
                          </p>
                          <p className="text-primary font-medium">{form.watch("newName")}</p>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {t("data.recipes.form.category")}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {recipe.category}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recipe Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {t("data.recipes.duplicateDialog.recipeDetails")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Quick Stats */}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <Package className="text-primary h-4 w-4" />
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {t("data.recipes.review.yield")}
                            </p>
                            <p className="text-sm font-medium">
                              {recipe.yieldQuantity} {recipe.yieldUnit}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {t("data.recipes.review.productionTime")}
                            </p>
                            <p className="text-sm font-medium">
                              {formatDuration(recipe.productionTimeMinutes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="text-muted-foreground text-xs">
                              {t("data.recipes.duplicateDialog.costSummary")}
                            </p>
                            <p className="text-sm font-medium">{formatCurrency(totalCost)}</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Ingredients Summary */}
                      <div>
                        <p className="mb-2 text-sm font-medium">
                          {t("data.recipes.review.ingredientsCount")?.replace(
                            "{count}",
                            recipe.ingredients.length.toString()
                          ) || `Ingredients (${recipe.ingredients.length})`}
                        </p>
                        <div className="space-y-2">
                          {recipe.ingredients.slice(0, 5).map((ingredient, index) => {
                            const material = materials.find((m) => m.id === ingredient.materialId);
                            return (
                              <div
                                key={index}
                                className="text-muted-foreground flex justify-between text-sm"
                              >
                                <span>{material?.name || t("data.materials.unknownMaterial")}</span>
                                <span>
                                  {ingredient.quantity} {ingredient.unit}
                                </span>
                              </div>
                            );
                          })}
                          {recipe.ingredients.length > 5 && (
                            <p className="text-muted-foreground text-xs italic">
                              + {recipe.ingredients.length - 5} more ingredients
                            </p>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Cost Summary */}
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="mb-2 flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Batch Cost</span>
                          <span className="font-semibold">{formatCurrency(totalCost)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Cost per {recipe.yieldUnit}</span>
                          <span className="font-semibold">{formatCurrency(costPerUnit)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* Fixed Footer with Navigation Buttons */}
        <div className="border-border shrink-0 border-t px-6 py-4">
          <div className="flex justify-between gap-2">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={duplicateRecipe.isPending}
                >
                  <ChevronLeft className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("common.actions.previous")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {currentStep < 2 ? (
                <Button type="button" onClick={handleNext}>
                  {t("common.actions.next")}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="duplicate-recipe-form"
                  disabled={duplicateRecipe.isPending}
                >
                  {duplicateRecipe.isPending && (
                    <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
                  )}
                  {t("data.recipes.duplicate")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
