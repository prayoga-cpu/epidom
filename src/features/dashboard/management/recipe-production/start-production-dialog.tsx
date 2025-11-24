"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast as sonnerToast } from "sonner";
import {
  Loader2,
  Calendar as CalendarIcon,
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrency } from "@/components/providers/currency-provider";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useStartProduction } from "./hooks/use-production-batches";

interface IngredientAvailability {
  materialId: string;
  materialName: string;
  required: number;
  available: number;
  unit: string;
  status: "sufficient" | "low" | "insufficient";
}

interface StartProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: any;
  availableIngredients: (IngredientAvailability | null)[];
}

const startProductionSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  recipeId: z.string().min(1, "Recipe is required"),
  numberOfBatches: z.coerce
    .number()
    .int("Number of batches must be a whole number")
    .positive("Number of batches must be positive")
    .min(1, "Number of batches must be at least 1")
    .max(1000, "Number of batches cannot exceed 1000"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  notes: z.string().optional(),
});

type StartProductionFormData = z.infer<typeof startProductionSchema>;

export function StartProductionDialog({
  open,
  onOpenChange,
  recipe,
  availableIngredients,
}: StartProductionDialogProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const storeId = params?.storeId as string;
  const startProduction = useStartProduction(storeId);

  // Get products linked to this recipe (from Many-to-Many relationship)
  const linkedProducts =
    recipe?.recipeProducts?.map((rp: { product: { id: string; name: string; sku: string } }) => rp.product) || [];
  const defaultProductId = linkedProducts[0]?.id || "";

  // Initialize form
  const form = useForm<StartProductionFormData>({
    resolver: zodResolver(startProductionSchema),
    defaultValues: {
      productId: defaultProductId,
      recipeId: recipe.id,
      numberOfBatches: 1,
      scheduledDate: "",
      notes: "",
    },
  });

  // Watch number of batches for real-time calculations
  const numberOfBatches = form.watch("numberOfBatches") || 1;
  const safeNumberOfBatches = Number.isFinite(numberOfBatches) && numberOfBatches > 0 ? numberOfBatches : 1;

  // Calculate material availability based on number of batches
  const validIngredients = useMemo(() => {
    if (!Number.isFinite(safeNumberOfBatches) || safeNumberOfBatches <= 0) {
      return availableIngredients.filter((ing): ing is IngredientAvailability => ing !== null);
    }

    return availableIngredients
      .filter((ing): ing is IngredientAvailability => ing !== null)
      .map((ing) => {
        // Calculate required quantity based on number of batches
        const required = ing.required * safeNumberOfBatches;
        const available = ing.available;
        let status: "sufficient" | "low" | "insufficient";

        if (available >= required) {
          status = "sufficient";
        } else if (available >= required * 0.5) {
          status = "low";
        } else {
          status = "insufficient";
        }

        return {
          ...ing,
          required,
          status,
        };
      });
  }, [availableIngredients, safeNumberOfBatches]);

  // Check if there are any insufficient materials
  const hasInsufficientMaterials = validIngredients.some((ing) => ing.status === "insufficient");

  // Calculate totals with safety checks
  const yieldQuantity = Number(recipe.yieldQuantity) || 1;
  const costPerBatch = Number(recipe.costPerBatch) || 0;
  const productionTime = recipe.productionTimeMinutes || 0;

  const totalCost = safeNumberOfBatches * costPerBatch;
  const totalTime = safeNumberOfBatches * productionTime;

  // Handle form submission
  const onSubmit = async (data: StartProductionFormData) => {
    try {
      // Validate recipe yield quantity
      const yieldQuantity = Number(recipe.yieldQuantity);
      if (!yieldQuantity || yieldQuantity <= 0) {
        throw new Error("Recipe yield quantity is invalid. Please check the recipe configuration.");
      }

      // Convert number of batches to planned quantity (units)
      // Use Math.round to ensure integer result and prevent floating point precision issues
      const plannedQuantity = Math.round(data.numberOfBatches * yieldQuantity);

      // Validate planned quantity is positive
      if (plannedQuantity <= 0) {
        throw new Error("Calculated production quantity is invalid. Please check the recipe configuration.");
      }

      const result = await startProduction.mutateAsync({
        productId: data.productId,
        recipeId: data.recipeId,
        plannedQuantity: plannedQuantity,
        scheduledDate: new Date(data.scheduledDate),
        notes: data.notes,
      });

      sonnerToast.success(
        t("management.recipeProduction.toasts.productionStarted.title") || "Production Started",
        {
          description: `Batch ${result.batchNumber} has been started`,
        }
      );

      form.reset();
      onOpenChange(false);
    } catch (error) {
      sonnerToast.error(t("management.recipeProduction.toasts.productionFailed.title") || "Error", {
        description:
          error instanceof Error
            ? error.message
            : t("management.recipeProduction.toasts.productionFailed.description") ||
              "Failed to start production",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("management.recipeProduction.dialogs.startProduction.title")}
        description={t("management.recipeProduction.dialogs.startProduction.description")}
        maxWidth="xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={startProduction.isPending}
            >
              {t("common.actions.cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              form="start-production-form"
              disabled={
                startProduction.isPending ||
                hasInsufficientMaterials ||
                linkedProducts.length === 0
              }
            >
              {startProduction.isPending && <Loader2 className="mr-1 h-4 w-4 hidden sm:inline animate-spin" />}
              {t("management.recipeProduction.startProduction") || "Start Production"}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id="start-production-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* Recipe Information Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {t("management.recipeProduction.recipe")}
                    </p>
                    <p className="text-lg font-semibold">{recipe.name}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.yieldPerBatch")}
                      </p>
                      <p className="font-medium">
                        {recipe.yieldQuantity} {recipe.yieldUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.timePerBatch")}
                      </p>
                      <p className="font-medium">
                        {recipe.productionTimeMinutes} {t("common.time.minutesShort")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.costPerBatch")}
                      </p>
                      <p className="font-medium">{formatPrice(recipe.costPerBatch)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insufficient Materials Warning */}
            {hasInsufficientMaterials && (
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {t("management.recipeProduction.insufficientMaterialsWarning")}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t("management.recipeProduction.insufficientMaterialsHint")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Product Selection */}
            {linkedProducts.length > 0 ? (
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("management.recipeProduction.product") || "Product"} *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              t("management.recipeProduction.selectProduct") || "Select product"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {linkedProducts.map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t("management.recipeProduction.productHint") ||
                        "Select the product to produce"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      {t("management.recipeProduction.noLinkedProducts") ||
                        "No products linked to this recipe"}
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {t("management.recipeProduction.noLinkedProductsHint") ||
                        "Please link a product to this recipe before starting production."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Number of Batches */}
            <FormField
              control={form.control}
              name="numberOfBatches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("management.recipeProduction.batchQuantity")} *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Package className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        max="1000"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow positive integers
                          if (value === "" || /^\d+$/.test(value)) {
                            field.onChange(value === "" ? "" : Number(value));
                          }
                        }}
                        className="pl-9"
                        placeholder="1"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t("management.recipeProduction.batchQuantityHint") ||
                      "How many batches do you want to produce?"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Calculated Summary */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <p className="mb-3 text-sm font-medium">
                  {t("management.recipeProduction.productionSummary")}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.estimatedTime") || "Estimated Time"}
                      </p>
                      <p className="text-lg font-bold">
                        {totalTime.toFixed(0)} {t("common.time.minutesShort") || "min"}
                        {totalTime >= 60 && (
                          <span className="text-muted-foreground ml-1 text-sm font-normal">
                            ({(totalTime / 60).toFixed(1)}h)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.estimatedCost") || "Estimated Cost"}
                      </p>
                      <p className="text-lg font-bold">{formatPrice(totalCost)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scheduled Date */}
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => {
                const dateValue = field.value ? new Date(field.value) : undefined;
                const timeValue = field.value ? field.value.slice(11, 16) : "";

                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      {t("management.recipeProduction.scheduledDate") || "Scheduled Date"} *
                    </FormLabel>
                    <div className="flex items-start gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-[240px] pl-3 text-left font-normal",
                                !dateValue && "text-muted-foreground"
                              )}
                            >
                              {dateValue ? (
                                format(dateValue, "PPP")
                              ) : (
                                <span>{t("common.datePicker.pickDate")}</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={dateValue}
                            onSelect={(date) => {
                              if (date) {
                                const dateStr = format(date, "yyyy-MM-dd");
                                const time = timeValue || "00:00";
                                field.onChange(`${dateStr}T${time}`);
                              }
                            }}
                            disabled={(date) => {
                              // Only disable dates before today (compare date only, not time)
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return date < today;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        value={timeValue}
                        onChange={(e) => {
                          const time = e.target.value;
                          if (dateValue) {
                            const dateStr = format(dateValue, "yyyy-MM-dd");
                            field.onChange(`${dateStr}T${time}`);
                          }
                        }}
                        className="w-[120px]"
                      />
                    </div>
                    <FormDescription>
                      {t("management.recipeProduction.targetCompletionDateHint")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("management.recipeProduction.notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("management.recipeProduction.notesPlaceholder")}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>{t("management.recipeProduction.notesHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
