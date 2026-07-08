"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
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
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { type Alert } from "@/features/dashboard/tracking/hooks/use-alerts";
import { useCreateSupplierOrder } from "@/features/dashboard/tracking/hooks/use-supplier-orders";
import { ShoppingCart, Loader2, Package, AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";

// Schema for bulk order items
const bulkOrderItemSchema = z.object({
  materialId: z.string(),
  materialName: z.string(),
  materialSku: z.string(),
  unit: z.string(),
  currentStock: z.coerce.number(),
  minStock: z.coerce.number(),
  unitPrice: z.coerce.number().min(0, "Unit price must be non-negative"),
  selected: z.boolean(),
  quantity: z.coerce
    .number()
    .positive("Quantity must be positive")
    .min(0.001, "Quantity must be at least 0.001"),
});

// Schema for the entire bulk order form
const bulkOrderSchema = z
  .object({
    supplierId: z.string().min(1, "Supplier ID is required"),
    supplierName: z.string().min(1, "Supplier name is required"),
    items: z.array(bulkOrderItemSchema),
    expectedDeliveryDate: z.string().min(1, "Please select an expected delivery date"),
    notes: z.string().optional(),
  })
  .refine((data) => data.items.some((item) => item.selected), {
    message: "Please select at least one item to order",
    path: ["items"],
  });

type BulkOrderFormData = z.infer<typeof bulkOrderSchema>;

interface BulkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: Alert[];
  supplierName: string;
  supplierId: string;
}

export function BulkOrderDialog({
  open,
  onOpenChange,
  alerts,
  supplierName,
  supplierId,
}: BulkOrderDialogProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;

  // Create supplier order mutation
  const createOrder = useCreateSupplierOrder(storeId);

  // Initialize form with alerts data
  const form = useForm<BulkOrderFormData>({
    resolver: zodResolver(bulkOrderSchema),
    defaultValues: {
      supplierId,
      supplierName,
      items: alerts.map((alert) => {
        const supplier =
          alert.suppliers?.find((s) => s.name === supplierName) || alert.suppliers?.[0];
        const suggestedQuantity = Math.max(0, Number(alert.minStock) - Number(alert.currentStock));

        return {
          materialId: alert.materialId,
          materialName: alert.materialName,
          materialSku: alert.materialSku,
          unit: alert.unit,
          currentStock: Number(alert.currentStock),
          minStock: Number(alert.minStock),
          unitPrice: supplier?.price || 0,
          selected: false,
          quantity: suggestedQuantity > 0 ? suggestedQuantity : 1,
        };
      }),
      expectedDeliveryDate: "",
      notes: "",
    },
  });

  // Reset form when dialog opens or alerts change
  useEffect(() => {
    if (open && alerts.length > 0) {
      const items = alerts.map((alert) => {
        const supplier =
          alert.suppliers?.find((s) => s.name === supplierName) || alert.suppliers?.[0];
        const suggestedQuantity = Math.max(0, Number(alert.minStock) - Number(alert.currentStock));

        return {
          materialId: alert.materialId,
          materialName: alert.materialName,
          materialSku: alert.materialSku,
          unit: alert.unit,
          currentStock: Number(alert.currentStock),
          minStock: Number(alert.minStock),
          unitPrice: supplier?.price || 0,
          selected: false,
          quantity: suggestedQuantity > 0 ? suggestedQuantity : 1,
        };
      });

      form.reset({
        supplierId,
        supplierName,
        items,
        expectedDeliveryDate: "",
        notes: `Bulk restock order from ${supplierName}`,
      });
    }
  }, [open, alerts, supplierName, supplierId, form]);

  const onSubmit = async (data: BulkOrderFormData) => {
    try {
      // Filter only selected items
      const selectedItems = data.items.filter((item) => item.selected);

      if (selectedItems.length === 0) {
        toast({
          title: "No items selected",
          description: "Please select at least one item to order",
          variant: "destructive",
        });
        return;
      }

      // Create supplier order with multiple items
      await createOrder.mutateAsync({
        supplierId: data.supplierId,
        items: selectedItems.map((item) => ({
          materialId: item.materialId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
        })),
        expectedDate: data.expectedDeliveryDate,
        notes: data.notes || `Bulk restock order from ${data.supplierName}`,
      });

      toast({
        title: "Bulk order created successfully",
        description: `Created order with ${selectedItems.length} item(s) from ${data.supplierName}`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create bulk order. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Calculate total items selected and total cost
  const selectedItems = form.watch("items")?.filter((item) => item.selected) || [];
  const totalCost = selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={`Bulk Order - ${supplierName}`}
        description="Select multiple items to create a bulk order. You can adjust quantities for each item."
        maxWidth="xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createOrder.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="bulk-order-form" disabled={createOrder.isPending}>
              {createOrder.isPending && (
                <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
              )}
              <ShoppingCart className="mr-1 hidden h-4 w-4 sm:inline" />
              Create Bulk Order ({selectedItems.length})
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="bulk-order-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Supplier Info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">
                {t("alerts.createOrderDialog.supplier")}: {supplierName}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("alerts.bulkOrder.lowStockItemsAvailable")?.replace(
                  "{count}",
                  alerts.length.toString()
                ) || `${alerts.length} low stock item(s) available`}
              </p>
            </div>

            {/* Items Selection */}
            <div className="space-y-2">
              <FormLabel>
                {t("alerts.bulkOrder.selectItemsToOrder") || "Select Items to Order"} *
              </FormLabel>
              <div className="rounded-lg border">
                <div className="max-h-[300px] overflow-y-auto">
                  {form.watch("items")?.map((item, index) => (
                    <div
                      key={item.materialId}
                      className="hover:bg-muted/30 border-b p-3 transition-colors last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <FormField
                          control={form.control}
                          name={`items.${index}.selected`}
                          render={({ field }) => (
                            <FormItem className="mt-1">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {/* Item Details */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{item.materialName}</p>
                              <p className="text-muted-foreground text-xs">
                                {t("data.materials.form.sku")}: {item.materialSku}
                              </p>
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {t("common.stockStatus.lowStock")}
                            </Badge>
                          </div>

                          {/* Stock Info */}
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground">
                              {t("alerts.detailsDialog.current")}:{" "}
                              <span className="font-semibold text-red-600">
                                {item.currentStock} {item.unit}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              {t("alerts.detailsDialog.minimum")}:{" "}
                              <span className="font-semibold text-emerald-600">
                                {item.minStock} {item.unit}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              {t("alerts.price")}:{" "}
                              <span className="font-semibold">
                                {formatPrice(item.unitPrice)}/{item.unit}
                              </span>
                            </span>
                          </div>

                          {/* Quantity Input (only shown when selected) */}
                          {form.watch(`items.${index}.selected`) && (
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex items-center gap-2">
                                    <FormLabel className="text-xs">
                                      {t("alerts.createOrderDialog.quantity")}:
                                    </FormLabel>
                                    <FormControl>
                                      <DecimalInput
                                        decimals={3}
                                        min={0}
                                        placeholder="0.000"
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                        ref={field.ref}
                                        className="h-8 w-32 text-sm"
                                      />
                                    </FormControl>
                                    <span className="text-muted-foreground text-xs">
                                      {item.unit}
                                    </span>
                                    <span className="text-muted-foreground ml-auto text-xs">
                                      {t("alerts.total")}:{" "}
                                      <span className="font-semibold">
                                        {formatPrice(field.value * item.unitPrice)}
                                      </span>
                                    </span>
                                  </div>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selection Summary */}
              {selectedItems.length > 0 && (
                <div className="bg-primary/10 flex items-center justify-between rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <Package className="text-primary h-4 w-4" />
                    <span className="text-sm font-medium">
                      {t("alerts.bulkOrder.itemsSelected")?.replace(
                        "{count}",
                        selectedItems.length.toString()
                      ) || `${selectedItems.length} item(s) selected`}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">
                    {t("alerts.orderTotal")}: {formatPrice(totalCost)}
                  </span>
                </div>
              )}

              {form.formState.errors.items?.root && (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  {form.formState.errors.items.root.message}
                </p>
              )}
            </div>

            {/* Expected Delivery Date */}
            <FormField
              control={form.control}
              name="expectedDeliveryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("alerts.createOrderDialog.expectedDelivery")} *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    {t("alerts.createOrderDialog.expectedDeliveryHint")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("alerts.bulkOrder.orderNotes") || "Order Notes"}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        t("alerts.bulkOrder.orderNotesPlaceholder") ||
                        "Add any special instructions or notes for this order..."
                      }
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("alerts.bulkOrder.orderNotesHint") || "Optional notes for this bulk order"}
                  </FormDescription>
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
