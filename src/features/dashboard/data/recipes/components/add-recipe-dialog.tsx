"use client";

import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
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
import { useI18n } from "@/components/lang/i18n-provider";
import { useParams } from "next/navigation";
import { useCreateRecipe } from "../hooks/use-recipes";
import { useMaterials } from "../../materials/hooks/use-materials";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  createRecipeFormSchema,
  type CreateRecipeFormInput,
} from "@/lib/validation/inventory.schemas";

type RecipeFormValues = CreateRecipeFormInput;

interface AddRecipeDialogProps {
  trigger?: React.ReactNode;
}

export default function AddRecipeDialog({ trigger }: AddRecipeDialogProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const { t } = useI18n();
  const { currency, convertPrice, formatPrice } = useCurrency();
  const params = useParams();
  const storeId = params.storeId as string;

  // STEPS with translation
  const STEPS = [
    { id: 1, name: t("data.recipes.steps.basicInfo"), icon: ClipboardList },
    { id: 2, name: t("data.recipes.steps.ingredients"), icon: Package },
    { id: 3, name: t("data.recipes.steps.instructions"), icon: FileText },
    { id: 4, name: t("data.recipes.steps.review"), icon: Calculator },
  ];

  // Recipe categories with translation
  const getRecipeCategories = () => [
    t("data.recipes.categories.breadPastries"),
    t("data.recipes.categories.cakesDesserts"),
    t("data.recipes.categories.confectionery"),
    t("data.recipes.categories.dairyProducts"),
    t("data.recipes.categories.beverages"),
    t("data.recipes.categories.saucesCondiments"),
    t("data.recipes.categories.other"),
  ];

  // Fetch real materials for dropdown
  const { data: materialsData } = useMaterials(storeId);
  const materials = materialsData?.materials || [];

  const createRecipe = useCreateRecipe(storeId);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(createRecipeFormSchema),
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

    ingredients?.forEach((ingredient) => {
      const material = materials.find((m) => m.id === ingredient.materialId);
      if (material) {
        totalCost += Number(material.unitCost) * ingredient.quantity;
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
    try {
      await createRecipe.mutateAsync(data);

      toast.success(t("data.recipes.toasts.created.title"));
      form.reset();
      setCurrentStep(1);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  };

  // Prevent form submission on Enter key from input/textarea fields
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

    if (e.key === "Enter" && isInputField) {
      e.preventDefault();
      if (currentStep < 4) {
        nextStep();
      }
    }
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
    const currentIngredients = form.watch("ingredients") || [];
    form.setValue("ingredients", [
      ...currentIngredients,
      { materialId: "", quantity: 0, unit: "", notes: "" },
    ]);
  };

  const removeIngredient = (index: number) => {
    const currentIngredients = form.watch("ingredients") || [];
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
            {t("data.recipes.addButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[700px] [&>button]:hidden">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-xl font-bold sm:text-2xl">
            {t("data.recipes.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {t("data.recipes.addDescription", { step: currentStep, total: STEPS.length })}
          </DialogDescription>

          {/* Step Indicator */}
          <div className="mt-4 flex w-full items-center justify-between">
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
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form
              id="add-recipe-form"
              onSubmit={form.handleSubmit(onSubmit)}
              onKeyDown={handleKeyDown}
              className="space-y-6"
            >
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.recipes.form.name")} *</FormLabel>
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
                      <FormLabel>{t("data.recipes.form.description")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("data.recipes.form.descriptionPlaceholder")}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t("data.recipes.form.descriptionHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.recipes.form.category")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.recipes.form.selectCategory")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getRecipeCategories().map((category) => (
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
                        <FormLabel>{t("data.recipes.form.yieldQuantity")} *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="2"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
                      <FormItem>
                        <FormLabel>{t("data.recipes.form.yieldUnit")} *</FormLabel>
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
                </div>

                <FormField
                  control={form.control}
                  name="productionTimeMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.recipes.form.productionTime")} *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder={t("data.recipes.form.productionTimePlaceholder")}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>{t("data.recipes.form.productionTimeHint")}</FormDescription>
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
                    <h3 className="font-semibold">{t("data.recipes.ingredients.title")}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t("data.recipes.ingredients.description")}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("data.recipes.ingredients.addIngredient")}
                  </Button>
                </div>

                {(form.watch("ingredients") || []).length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                      <Package className="text-muted-foreground mb-2 h-12 w-12" />
                      <p className="text-muted-foreground text-sm">
                        {t("data.recipes.ingredients.noIngredients")}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  {(form.watch("ingredients") || []).map((_, index) => {
                    const selectedMaterialId = form.watch(`ingredients.${index}.materialId`);
                    const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

                    return (
                      <Card key={index}>
                        <CardContent className="space-y-3 pt-6">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-semibold">{t("data.recipes.ingredients.ingredientNumber")?.replace("{number}", (index + 1).toString()) || `Ingredient ${index + 1}`}</h4>
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
                                <FormLabel>{t("data.recipes.ingredients.material")} *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue
                                        placeholder={t("data.recipes.ingredients.selectMaterial")}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {materials.map((material) => (
                                      <SelectItem key={material.id} value={material.id}>
                                        {material.name} (
                                        {material.category?.replace("_", " ") || t("common.uncategorized")})
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
                                  <FormLabel>{t("data.recipes.ingredients.quantity")} *</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      placeholder="500"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
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
                                  <FormLabel>{t("data.recipes.ingredients.unit")} *</FormLabel>
                                  <FormControl>
                                    <Input placeholder={selectedMaterial?.unit || "g"} {...field} />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    {selectedMaterial && `${t("data.materials.form.unit")}: ${selectedMaterial.unit}`}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {selectedMaterial && (
                            <div className="bg-muted rounded-md p-3 text-sm">
                              <p className="font-medium">{t("data.recipes.ingredients.costEstimate")}</p>
                              <p className="text-muted-foreground">
                                {formatPrice(Number(selectedMaterial.unitCost))} {t("common.per")} {" "}
                                {selectedMaterial.unit} × {" "}
                                {form.watch(`ingredients.${index}.quantity`) || 0} = {" "}
                                <span className="text-foreground font-semibold">
                                  {formatPrice(
                                    Number(selectedMaterial.unitCost) *
                                      (form.watch(`ingredients.${index}.quantity`) || 0)
                                  )}
                                </span>
                              </p>
                            </div>
                          )}

                          <FormField
                            control={form.control}
                            name={`ingredients.${index}.notes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("data.recipes.ingredients.notes")}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t("data.recipes.ingredients.notesPlaceholder")}
                                    {...field}
                                  />
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
                      <FormLabel>{t("data.recipes.form.instructions")} *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("data.recipes.form.instructionsPlaceholder")}
                          rows={12}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("data.recipes.form.instructionsHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted/50 rounded-lg border p-4">
                  <h4 className="mb-2 font-semibold">{t("data.recipes.instructionsTips.title")}</h4>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>• {t("data.recipes.instructionsTips.tip1")}</li>
                    <li>• {t("data.recipes.instructionsTips.tip2")}</li>
                    <li>• {t("data.recipes.instructionsTips.tip3")}</li>
                    <li>• {t("data.recipes.instructionsTips.tip4")}</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold">{t("data.recipes.review.title")}</h3>

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
                        {t("common.actions.edit")}
                      </Button>
                    </div>
                    {form.watch("description") && (
                      <p className="text-muted-foreground text-sm">{form.watch("description")}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t("data.recipes.review.yield")}</p>
                        <p className="font-medium">
                          {form.watch("yieldQuantity")} {form.watch("yieldUnit")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("data.recipes.review.productionTime")}</p>
                        <p className="font-medium">{form.watch("productionTimeMinutes")} {t("data.recipes.review.minutes")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ingredients Summary */}
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">
                        {t("data.recipes.review.ingredientsCount")?.replace("{count}", (form.watch("ingredients") || []).length.toString()) || `Ingredients (${(form.watch("ingredients") || []).length})`}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(2)}
                      >
                        {t("common.actions.edit")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(form.watch("ingredients") || []).map((ingredient, idx) => {
                        const material = materials.find((m) => m.id === ingredient.materialId);
                        return (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>
                              {material?.name} - {ingredient.quantity} {ingredient.unit}
                            </span>
                            <span className="text-muted-foreground">
                              {material
                                ? formatPrice(Number(material.unitCost) * ingredient.quantity)
                                : formatPrice(0)}
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
                    <h4 className="font-semibold">{t("data.recipes.review.costAnalysis")}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("data.recipes.review.totalCostPerBatch")}</span>
                        <span className="font-semibold">
                          {formatPrice(calculateEstimatedCost())}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("data.recipes.review.costPerUnit")?.replace("{unit}", form.watch("yieldUnit")) || `Cost per ${form.watch("yieldUnit")}`}
                        </span>
                        <span className="font-semibold">{formatPrice(calculateCostPerUnit())}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Instructions Preview */}
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold">{t("data.recipes.review.instructionsPreview")}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentStep(3)}
                      >
                        {t("common.actions.edit")}
                      </Button>
                    </div>
                    <pre className="bg-muted max-h-40 overflow-y-auto rounded-md p-3 text-sm whitespace-pre-wrap">
                      {form.watch("instructions")}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
            </form>
          </Form>
        </div>

        {/* Fixed Footer with Navigation Buttons */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createRecipe.isPending}
            >
              {t("actions.cancel")}
            </Button>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t("common.actions.previous")}
                </Button>
              )}
              {currentStep < 4 ? (
                <Button type="button" onClick={nextStep}>
                  {t("common.actions.next")}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="add-recipe-form"
                  disabled={createRecipe.isPending}
                >
                  {createRecipe.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("data.recipes.create")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
