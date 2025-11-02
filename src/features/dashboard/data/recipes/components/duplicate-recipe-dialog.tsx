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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
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
import { MOCK_MATERIALS } from "@/mocks";
import { Separator } from "@/components/ui/separator";
import type { Recipe } from "@/types/entities";
import { formatCurrency, formatDuration } from "@/lib/utils/formatting";
import { useI18n } from "@/components/lang/i18n-provider";

// Simple schema for duplication (only editable fields)
const duplicateRecipeSchema = z.object({
  name: z.string().min(2, "Recipe name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
});

type DuplicateRecipeFormValues = z.infer<typeof duplicateRecipeSchema>;

interface DuplicateRecipeDialogProps {
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

// Steps will be translated in the component itself using t() function

export default function DuplicateRecipeDialog({
  open,
  onOpenChange,
  recipe,
}: DuplicateRecipeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const { t } = useI18n();

  const STEPS = [
    { id: 1, name: t("data.recipes.duplicateDialog.steps.basicInfo") || "Basic Info" },
    { id: 2, name: t("data.recipes.duplicateDialog.steps.review") || "Review & Confirm" },
  ];

  const form = useForm<DuplicateRecipeFormValues>({
    resolver: zodResolver(duplicateRecipeSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
    },
  });

  // Populate form when recipe changes or dialog opens
  useEffect(() => {
    if (recipe && open) {
      form.reset({
        name: `${recipe.name} (Copy)`,
        description: recipe.description || "",
        category: recipe.category || "",
      });
      setCurrentStep(1);
    }
  }, [recipe, open, form]);

  const onSubmit = async (data: DuplicateRecipeFormValues) => {
    setIsSubmitting(true);

    try {
      // TODO: API call to duplicate recipe
      // Generate new IDs for recipe and ingredients
      // const newRecipeId = `REC-${Date.now()}`;
      // const newIngredients = recipe.ingredients.map((ing, idx) => ({
      //   ...ing,
      //   id: `RI-${Date.now()}-${idx}`,
      //   recipeId: newRecipeId,
      // }));
      //
      // const duplicatedRecipe = {
      //   ...recipe,
      //   id: newRecipeId,
      //   name: data.name,
      //   description: data.description,
      //   category: data.category,
      //   ingredients: newIngredients,
      //   createdAt: new Date(),
      //   updatedAt: new Date(),
      // };
      //
      // const response = await fetch("/api/recipes", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(duplicatedRecipe),
      // });
      //
      // if (!response.ok) throw new Error("Failed to duplicate recipe");

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: t("data.recipes.toasts.duplicated.title") || "Recipe Duplicated",
        description:
          t("data.recipes.toasts.duplicated.description")?.replace("{name}", data.name) ||
          `${data.name} has been created successfully.`,
      });

      form.reset();
      setCurrentStep(1);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate recipe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    // Validate current step
    const fieldsToValidate: Array<keyof DuplicateRecipeFormValues> = ["name", "category"];
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
      const material = MOCK_MATERIALS.find((m) => m.id === ingredient.materialId);
      if (material) {
        total += material.costPerUnit * ingredient.quantity;
      }
    });
    return total;
  };

  const totalCost = calculateTotalCost();
  const costPerUnit = totalCost / recipe.yieldQuantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px] [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t("data.recipes.duplicateTitle") || "Duplicate Recipe"}
          </DialogTitle>
          <DialogDescription>
            {t("data.recipes.duplicateDescription") ||
              "Create a copy of this recipe with a new name. All ingredients and instructions will be copied."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
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
                  currentStep === step.id ? "text-foreground font-medium" : "text-muted-foreground"
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

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">
                    <strong>
                      {t("data.recipes.duplicateDialog.originalRecipe") || "Original Recipe"}:
                    </strong>{" "}
                    {recipe.name}
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("data.recipes.duplicateDialog.nameLabel") || "New Recipe Name"} *
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.recipes.namePlaceholder") || "Recipe name"} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t("data.recipes.duplicateDialog.nameDescription") ||
                          "Enter a unique name for the duplicated recipe"}
                      </FormDescription>
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
                          placeholder={
                            t("data.recipes.form.descriptionPlaceholder") ||
                            "Brief description of the recipe..."
                          }
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
                      <FormLabel>{t("data.recipes.form.category") || "Category"} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                t("data.recipes.form.selectCategory") || "Select a category"
                              }
                            />
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
                      {t("data.recipes.duplicateDialog.comparison") || "Recipe Comparison"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {t("data.recipes.duplicateDialog.originalName") || "Original Name"}
                        </p>
                        <p className="font-medium">{recipe.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {t("data.recipes.duplicateDialog.newName") || "New Name"}
                        </p>
                        <p className="text-primary font-medium">{form.watch("name")}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs">
                        {t("data.recipes.form.category") || "Category"}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {form.watch("category")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Recipe Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {t("data.recipes.duplicateDialog.recipeDetails") || "Recipe Details (Copied)"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Quick Stats */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Package className="text-primary h-4 w-4" />
                        <div>
                          <p className="text-muted-foreground text-xs">
                            {t("data.recipes.review.yield") || "Yield"}
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
                            {t("data.recipes.review.productionTime") || "Production Time"}
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
                            {t("data.recipes.duplicateDialog.costSummary") || "Cost"}
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
                          const material = MOCK_MATERIALS.find(
                            (m) => m.id === ingredient.materialId
                          );
                          return (
                            <div
                              key={index}
                              className="text-muted-foreground flex justify-between text-sm"
                            >
                              <span>{material?.name || "Unknown"}</span>
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

            {/* Navigation Buttons */}
            <DialogFooter className="gap-2">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t("actions.previous") || "Back"}
                </Button>
              )}

              {currentStep < 2 ? (
                <Button type="button" onClick={handleNext}>
                  {t("actions.next") || "Next"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("data.recipes.duplicate") || "Duplicate Recipe"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
