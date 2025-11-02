"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Calendar as CalendarIcon,
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Recipe } from "@/types/entities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/formatting";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  recipe: Recipe;
  availableIngredients: (IngredientAvailability | null)[];
}

const startProductionSchema = z.object({
  recipeId: z.string().min(1, "Recipe is required"),
  batchQuantity: z.coerce
    .number()
    .min(1, "Batch quantity must be at least 1")
    .max(100, "Batch quantity cannot exceed 100"),
  targetCompletionDate: z.string().min(1, "Target completion date is required"),
  qualityCheckRequired: z.boolean(),
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
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out null values
  const validIngredients = availableIngredients.filter(
    (ing): ing is IngredientAvailability => ing !== null
  );

  // Check if there are any insufficient materials
  const hasInsufficientMaterials = validIngredients.some((ing) => ing.status === "insufficient");

  // Initialize form
  const form = useForm<StartProductionFormData>({
    resolver: zodResolver(startProductionSchema),
    defaultValues: {
      recipeId: recipe.id,
      batchQuantity: 1,
      targetCompletionDate: "",
      qualityCheckRequired: true,
      notes: "",
    },
  });

  // Watch batch quantity for real-time calculations
  const batchQuantity = form.watch("batchQuantity");
  const totalYield = batchQuantity * recipe.yieldQuantity;
  const totalCost = batchQuantity * recipe.costPerBatch;
  const totalTime = batchQuantity * recipe.productionTimeMinutes;

  // Handle form submission
  const onSubmit = async (data: StartProductionFormData) => {
    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call to POST /api/production/batches
      console.log("Starting production batch:", data);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate batch number (format: BATCH-YYYYMMDD-XXX)
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
      const batchNumber = `BATCH-${dateStr}-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

      const descriptionText = t("management.recipeProduction.toasts.productionStarted.description") || "Production batch {batchNumber} has been started";
      toast({
        title: t("management.recipeProduction.toasts.productionStarted.title"),
        description: descriptionText.replace(
          "{batchNumber}",
          batchNumber
        ),
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to start production:", error);
      toast({
        variant: "destructive",
        title: t("management.recipeProduction.toasts.productionFailed.title"),
        description: t("management.recipeProduction.toasts.productionFailed.description"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("management.recipeProduction.dialogs.startProduction.title")}
          </DialogTitle>
          <DialogDescription>
            {t("management.recipeProduction.dialogs.startProduction.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <p className="font-medium">{recipe.productionTimeMinutes} {t("common.time.minutesShort")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.costPerBatch")}
                      </p>
                      <p className="font-medium">{formatCurrency(recipe.costPerBatch)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insufficient Materials Warning */}
            {hasInsufficientMaterials && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {t("management.recipeProduction.insufficientMaterialsWarning")}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {t("management.recipeProduction.insufficientMaterialsHint")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Batch Quantity */}
            <FormField
              control={form.control}
              name="batchQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("management.recipeProduction.batchQuantity")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Package className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        className="pl-9"
                        placeholder="1"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t("management.recipeProduction.batchQuantityHint")}
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
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Package className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.totalYield")}
                      </p>
                      <p className="text-lg font-bold">
                        {totalYield} {recipe.yieldUnit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.totalTime")}
                      </p>
                      <p className="text-lg font-bold">
                        {totalTime} {t("common.time.minutesShort")}
                        {totalTime >= 60 && (
                          <span className="text-muted-foreground ml-1 text-sm font-normal">
                            ({(totalTime / 60).toFixed(1)}{t("common.time.hoursShort")})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground">
                        {t("management.recipeProduction.totalCost")}
                      </p>
                      <p className="text-lg font-bold">{formatCurrency(totalCost)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Completion Date */}
            <FormField
              control={form.control}
              name="targetCompletionDate"
              render={({ field }) => {
                const dateValue = field.value ? new Date(field.value) : undefined;
                const timeValue = field.value ? field.value.slice(11, 16) : "";

                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("management.recipeProduction.targetCompletionDate")}</FormLabel>
                    <div className="flex gap-2">
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
                              {dateValue ? format(dateValue, "PPP") : <span>{t("common.datePicker.pickDate")}</span>}
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
                            disabled={(date) => date < new Date()}
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting || hasInsufficientMaterials}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("management.recipeProduction.startProduction")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
