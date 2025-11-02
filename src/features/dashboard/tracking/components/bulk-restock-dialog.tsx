"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/components/lang/i18n-provider";
import { MOCK_SUPPLIERS } from "@/mocks";
import { Loader2, Package2 } from "lucide-react";

// Stock row type (simplified version of what's in MOCK_STOCK_ROWS)
export interface StockRow {
  id: string;
  product: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
}

// Priority enum
enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

// Zod validation schema
const bulkRestockSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string(),
      itemName: z.string(),
      quantity: z.coerce
        .number()
        .positive("Quantity must be positive")
        .min(0.01, "Quantity must be at least 0.01"),
      supplierId: z.string().optional(),
    })
  ),
  useSameSupplier: z.boolean(),
  globalSupplierId: z.string().optional(),
  priority: z.nativeEnum(Priority),
  deliveryDate: z.string().min(1, "Please select a delivery date"),
  notes: z.string().optional(),
});

type BulkRestockFormData = z.infer<typeof bulkRestockSchema>;

interface BulkRestockDialogProps {
  selectedItems: StockRow[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
}

export function BulkRestockDialog({
  selectedItems,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerButton,
}: BulkRestockDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  const form = useForm<BulkRestockFormData>({
    resolver: zodResolver(bulkRestockSchema),
    defaultValues: {
      items: selectedItems.map((item) => ({
        itemId: item.id,
        itemName: item.product,
        quantity: Math.max(0, item.maxStock - item.currentStock), // Suggest to fill to max
        supplierId: "",
      })),
      useSameSupplier: true,
      globalSupplierId: "",
      priority: Priority.MEDIUM,
      deliveryDate: "",
      notes: "",
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchUseSameSupplier = form.watch("useSameSupplier");

  const onSubmit = async (data: BulkRestockFormData) => {
    setIsSubmitting(true);

    try {
      // TODO: Replace with TanStack Query mutation
      // const mutation = useMutation({
      //   mutationFn: createBulkRestockOrders,
      //   onSuccess: () => {
      //     queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      //     queryClient.invalidateQueries({ queryKey: ['orders'] });
      //     toast({
      //       title: t("tracking.toasts.restockInitiated.title"),
      //       description: t("tracking.toasts.restockInitiated.desc"),
      //     });
      //     form.reset();
      //     setOpen(false);
      //   },
      //   onError: (error) => {
      //     toast({
      //       title: "Error",
      //       description: error.message,
      //       variant: "destructive",
      //     });
      //   },
      // });
      //
      // mutation.mutate({
      //   items: data.items.map(item => ({
      //     itemId: item.itemId,
      //     quantity: item.quantity,
      //     supplierId: data.useSameSupplier ? data.globalSupplierId : item.supplierId,
      //   })),
      //   priority: data.priority,
      //   deliveryDate: data.deliveryDate,
      //   notes: data.notes,
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: t("tracking.toasts.restockInitiated.title"),
        description: `${data.items.length} ${t("tracking.toasts.restockInitiated.desc")}`,
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create restock orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const DialogComponent = (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("tracking.dialogs.bulkRestock.title")}</DialogTitle>
          <DialogDescription>
            {t("tracking.dialogs.bulkRestock.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Selected Items */}
            <div>
              <h3 className="text-sm font-semibold mb-3">
                {(t("tracking.itemsSelected") || "{count} items selected").replace(
                  "{count}",
                  selectedItems.length.toString()
                )}
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto rounded-lg border p-3">
                {fields.map((field, index) => {
                  const stockItem = selectedItems[index];
                  return (
                    <div
                      key={field.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <Package2 className="h-5 w-5 text-muted-foreground mt-1" />
                      <div className="flex-1 space-y-2">
                        <div>
                          <p className="font-medium text-sm">{field.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("tracking.currentStock")}: {stockItem.currentStock}{" "}
                            {stockItem.unit} • Max: {stockItem.maxStock} {stockItem.unit}
                          </p>
                        </div>
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field: quantityField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                {t("tracking.reorderQuantity")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  {...quantityField}
                                  className="h-8"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {!watchUseSameSupplier && (
                          <FormField
                            control={form.control}
                            name={`items.${index}.supplierId`}
                            render={({ field: supplierField }) => (
                              <FormItem>
                                <FormLabel className="text-xs">
                                  {t("tracking.selectSupplier")}
                                </FormLabel>
                                <Select
                                  onValueChange={supplierField.onChange}
                                  defaultValue={supplierField.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {MOCK_SUPPLIERS.map((supplier) => (
                                      <SelectItem
                                        key={supplier.id}
                                        value={supplier.id}
                                      >
                                        {supplier.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Global Settings */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Order Settings</h3>

              {/* Same Supplier Toggle */}
              <FormField
                control={form.control}
                name="useSameSupplier"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Use same supplier for all items</FormLabel>
                      <FormDescription>
                        Select one supplier for all restock orders
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Global Supplier Selection */}
              {watchUseSameSupplier && (
                <FormField
                  control={form.control}
                  name="globalSupplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("tracking.selectSupplier")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MOCK_SUPPLIERS.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Priority and Delivery Date */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("tracking.priority")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(Priority).map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {t(`tracking.priorities.${priority}`)}
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
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("tracking.deliveryDate")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tracking.restockNotes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("tracking.additionalNotes")}
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Optional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("tracking.createOrders")} ({selectedItems.length})
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return DialogComponent;
}
