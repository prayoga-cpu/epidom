"use client";

import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Package,
  FileText,
  Calculator,
  ClipboardList,
} from "lucide-react";
import { MOCK_MATERIALS } from "@/mocks";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";

// Ingredient item schema
const ingredientSchema = z.object({
  materialId: z.string().min(1, "Material is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  notes: z.string().optional(),
});

// Multi-step form schema
const recipeSchema = z.object({
  // Step 1: Basic Information
  name: z.string().min(2, "Recipe name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  yieldQuantity: z.coerce.number().positive("Yield quantity must be greater than 0"),
  yieldUnit: z.string().min(1, "Yield unit is required"),
  productionTimeMinutes: z.coerce.number().positive("Production time must be greater than 0"),

  // Step 2: Ingredients
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient is required"),

  // Step 3: Instructions
  instructions: z.string().min(10, "Instructions must be at least 10 characters"),
});

type RecipeFormValues = z.infer<typeof recipeSchema>;

interface AddRecipeDialogProps {
  trigger?: React.ReactNode;
}

const STEPS = [
  { id: 1, name: "Basic Info", icon: ClipboardList },
  { id: 2, name: "Ingredients", icon: Package },
  { id: 3, name: "Instructions", icon: FileText },
  { id: 4, name: "Review", icon: Calculator },
];

const RECIPE_CATEGORIES = [
  "Bread & Pastries",
  "Cakes & Desserts",
  "Confectionery",
  "Dairy Products",
  "Beverages",
  "Sauces & Condiments",
  "Other",
];

export default function AddRecipeDialog({ trigger }: AddRecipeDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
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
    mode: "onChange",
  });

  // Calculate estimated cost based on ingredients
  const calculateEstimatedCost = () => {
    const ingredients = form.watch("ingredients");
    let totalCost = 0;

    ingredients.forEach((ingredient) => {
      const material = MOCK_MATERIALS.find((m) => m.id === ingredient.materialId);
      if (material) {
        totalCost += material.costPerUnit * ingredient.quantity;
      }
    });

    return totalCost;
  };

  // Calculate cost per unit
  const calculateCostPerUnit = () => {
    const totalCost = calculateEstimatedCost();
    const yieldQuantity = form.watch("yieldQuantity");
    if (yieldQuantity > 0) {
      return totalCost / yieldQuantity;
    }
    return 0;
  };

  const onSubmit = async (data: RecipeFormValues) => {
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: Replace with actual API call
    // const response = await fetch("/api/recipes", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     ...data,
    //     costPerBatch: calculateEstimatedCost(),
    //   }),
    // });

    setIsSubmitting(false);
    toast({
      title: "Recipe Created Successfully",
      description: `${data.name} has been added to your recipes.`,
    });

    form.reset();
    setCurrentStep(1);
    setOpen(false);
  };

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];

    // Validate current step fields
    switch (currentStep) {
      case 1:
        fieldsToValidate = [
          "name",
          "category",
          "yieldQuantity",
          "yieldUnit",
          "productionTimeMinutes",
        ];
        break;
      case 2:
        fieldsToValidate = ["ingredients"];
        break;
      case 3:
        fieldsToValidate = ["instructions"];
        break;
    }

    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      setCurrentStep(1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("common.actions.add") || "Add Recipe"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px] [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{t("data.recipes.addTitle") || "Create New Recipe"}</DialogTitle>
          <DialogDescription>
            Create a new recipe with ingredients and instructions. Step {currentStep} of{" "}
            {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex w-full items-center justify-between border-b pb-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                {/* STEP */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : isActive
                          ? "border-primary bg-primary text-white"
                          : "border-muted bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>

                {/* GARIS ANTAR STEP */}
                {index < STEPS.length - 1 && (
                  <div
                    className={`mb-5 h-0.5 flex-1 transition-colors ${
                      isCompleted ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe Name *</FormLabel>
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
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("data.recipes.form.descriptionPlaceholder")}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Brief description of the recipe</FormDescription>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.recipes.form.selectCategory")} />
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="yieldQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yield Quantity *</FormLabel>
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
                        <FormLabel>Yield Unit *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("data.recipes.form.selectUnit")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="kg">Kilograms (kg)</SelectItem>
                            <SelectItem value="g">Grams (g)</SelectItem>
                            <SelectItem value="L">Liters (L)</SelectItem>
                            <SelectItem value="mL">Milliliters (mL)</SelectItem>
                            <SelectItem value="units">Units</SelectItem>
                            <SelectItem value="loaves">Loaves</SelectItem>
                            <SelectItem value="pieces">Pieces</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="productionTimeMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Production Time (minutes) *</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="180" {...field} />
                      </FormControl>
                      <FormDescription>Total time to produce this recipe</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Ingredients */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Ingredients</h3>
                    <p className="text-muted-foreground text-sm">
                      Add materials needed for this recipe
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Ingredient
                  </Button>
                </div>

                {form.watch("ingredients").length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                      <Package className="text-muted-foreground mb-2 h-12 w-12" />
                      <p className="text-muted-foreground text-sm">
                        No ingredients added yet. Click "Add Ingredient" to start.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  {form.watch("ingredients").map((_, index) => {
                    const selectedMaterialId = form.watch(`ingredients.${index}.materialId`);
                    const selectedMaterial = MOCK_MATERIALS.find(
                      (m) => m.id === selectedMaterialId
                    );

                    return (
                      <Card key={index}>
                        <CardContent className="space-y-3 pt-6">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-semibold">Ingredient {index + 1}</h4>
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
                                        {material.name} ({material.category.replace("_", " ")})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid gap-3 sm:grid-cols-2">
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
                                  <FormDescription className="text-xs">
                                    {selectedMaterial && `Material unit: ${selectedMaterial.unit}`}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {selectedMaterial && (
                            <div className="bg-muted rounded-md p-3 text-sm">
                              <p className="font-medium">Cost Estimate</p>
                              <p className="text-muted-foreground">
                                ${selectedMaterial.costPerUnit} per {selectedMaterial.unit} ×{" "}
                                {form.watch(`ingredients.${index}.quantity`) || 0} ={" "}
                                <span className="text-foreground font-semibold">
                                  $
                                  {(
                                    selectedMaterial.costPerUnit *
                                    (form.watch(`ingredients.${index}.quantity`) || 0)
                                  ).toFixed(2)}
                                </span>
                              </p>
                            </div>
                          )}

                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.notes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes (optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder={t("data.recipes.ingredients.notesPlaceholder")} {...field} />
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

                {form.formState.errors.ingredients && (
                  <p className="text-destructive text-sm font-medium">
                    {form.formState.errors.ingredients.message}
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Instructions */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cooking Instructions *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="1. Preheat oven to 220°C&#10;2. Mix dry ingredients in a large bowl&#10;3. Add water and knead for 10 minutes&#10;4. Let rest for 1 hour&#10;5. Shape into loaves&#10;6. Bake for 35-40 minutes"
                          rows={12}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide step-by-step instructions for making this recipe
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted/50 rounded-lg border p-4">
                  <h4 className="mb-2 font-semibold">Tips for writing instructions:</h4>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• Number each step for clarity</li>
                    <li>• Include specific temperatures and times</li>
                    <li>• Mention any special techniques or equipment needed</li>
                    <li>• Note any quality checks or visual cues</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Review Your Recipe</h3>

                {/* Basic Info Summary */}
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{form.watch("name")}</h4>
                        <Badge variant="secondary" className="mt-1">
                          {form.watch("category")}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(1)}
                      >
                        Edit
                      </Button>
                    </div>
                    {form.watch("description") && (
                      <p className="text-muted-foreground text-sm">{form.watch("description")}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Yield</p>
                        <p className="font-medium">
                          {form.watch("yieldQuantity")} {form.watch("yieldUnit")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Production Time</p>
                        <p className="font-medium">{form.watch("productionTimeMinutes")} minutes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ingredients Summary */}
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">
                        Ingredients ({form.watch("ingredients").length})
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(2)}
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {form.watch("ingredients").map((ingredient, index) => {
                        const material = MOCK_MATERIALS.find((m) => m.id === ingredient.materialId);
                        return (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>
                              {material?.name} - {ingredient.quantity} {ingredient.unit}
                            </span>
                            <span className="text-muted-foreground">
                              $
                              {material
                                ? (material.costPerUnit * ingredient.quantity).toFixed(2)
                                : "0.00"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Cost Analysis */}
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="space-y-3 pt-6">
                    <h4 className="font-semibold">Cost Analysis</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Cost per Batch</span>
                        <span className="font-semibold">
                          ${calculateEstimatedCost().toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Cost per {form.watch("yieldUnit")}
                        </span>
                        <span className="font-semibold">${calculateCostPerUnit().toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Instructions Preview */}
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">Instructions</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(3)}
                      >
                        Edit
                      </Button>
                    </div>
                    <pre className="bg-muted max-h-40 overflow-y-auto rounded-md p-3 text-sm whitespace-pre-wrap">
                      {form.watch("instructions")}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation Buttons */}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                {t("actions.cancel") || "Cancel"}
              </Button>
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t("actions.previous") || "Previous"}
                </Button>
              )}
              {currentStep < 4 ? (
                <Button type="button" onClick={nextStep}>
                  {t("actions.next") || "Next"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("data.recipes.create") || "Create Recipe"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
