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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/components/lang/i18n-provider";
import { type Alert } from "@/features/dashboard/tracking/hooks/use-alerts";
import { useCreateSupplierOrder } from "@/features/dashboard/tracking/hooks/use-supplier-orders";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { ShoppingCart, Loader2, Package } from "lucide-react";
import { useParams } from "next/navigation";

// Zod validation schema
const placeOrderSchema = z.object({
  supplierId: z.string().min(1, "Please select a supplier"),
  materialId: z.string().min(1, "Please select a material"),
  quantity: z.coerce
    .number()
    .positive("Quantity must be positive")
    .min(0.01, "Quantity must be at least 0.01"),
  expectedDeliveryDate: z.string().min(1, "Please select an expected delivery date"),
  notes: z.string().optional(),
});

type PlaceOrderFormData = z.infer<typeof placeOrderSchema>;

interface PlaceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert?: Alert | null;
}

export default function PlaceOrderDialog({ open, onOpenChange, alert }: PlaceOrderDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;

  // Fetch materials
  const { data: materialsData } = useMaterials(storeId);
  const materials = materialsData?.materials ?? [];

  // Create supplier order mutation
  const createOrder = useCreateSupplierOrder(storeId);

  // Get preferred supplier or first available supplier from alert
  const suggestedSupplier =
    alert?.suppliers?.find((s) => s.isPreferred)?.id || alert?.suppliers?.[0]?.id || "";

  // Calculate suggested quantity (fill to min stock)
  const suggestedQuantity = alert
    ? Math.max(0, Number(alert.minStock) - Number(alert.currentStock))
    : 0;

  const form = useForm<PlaceOrderFormData>({
    resolver: zodResolver(placeOrderSchema),
    defaultValues: {
      supplierId: suggestedSupplier,
      materialId: alert?.materialId || "",
      quantity: suggestedQuantity,
      expectedDeliveryDate: "",
      notes: "",
    },
  });

  // Reset form when dialog opens or alert changes
  useEffect(() => {
    if (open && alert) {
      form.reset({
        supplierId: suggestedSupplier,
        materialId: alert.materialId || "",
        quantity: suggestedQuantity,
        expectedDeliveryDate: "",
        notes: `Restock order for ${alert.materialName} (${alert.materialSku})`,
      });
    }
  }, [open, alert, form, suggestedSupplier, suggestedQuantity]);

  const onSubmit = async (data: PlaceOrderFormData) => {
    if (!alert) return;

    try {
      const supplier = alert.suppliers?.find((s) => s.id === data.supplierId);

      if (!supplier) {
        throw new Error("Supplier not found");
      }

      // Create supplier order with the API
      await createOrder.mutateAsync({
        supplierId: data.supplierId,
        items: [
          {
            materialId: data.materialId,
            quantity: data.quantity,
            unit: alert.unit,
            unitPrice: supplier.price,
          },
        ],
        expectedDate: data.expectedDeliveryDate,
        notes: data.notes || `Restock order from alert for ${alert.materialName}`,
      });

      toast({
        title: t("alerts.toasts.orderCreated"),
        description: `Order created: ${data.quantity} ${alert.unit} of ${alert.materialName} from ${supplier.name}`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create order. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{t("alerts.createOrderDialog.title")}</DialogTitle>
          <DialogDescription>{t("alerts.createOrderDialog.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Alert Info (if from alert) */}
            {alert && (
              <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{alert.materialName}</p>
                  <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>
                    {alert.severity === "critical" ? "Urgent" : "Warning"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  Current stock: {alert.currentStock} {alert.unit} / Min: {alert.minStock}{" "}
                  {alert.unit} ({alert.stockPercentage}%)
                </p>
              </div>
            )}

            {/* Supplier */}
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("alerts.createOrderDialog.supplier")} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("alerts.createOrderDialog.selectSupplier")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {alert?.suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-2">
                              {supplier.name}
                              {supplier.isPreferred && (
                                <Badge variant="secondary" className="text-xs">
                                  Preferred
                                </Badge>
                              )}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {supplier.price} per {alert.unit}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Material - Hidden field since we already have materialId from alert */}
            <input type="hidden" {...form.register("materialId")} />

            {/* Material Display */}
            {alert && (
              <div className="rounded-md border p-3">
                <p className="text-sm font-medium">{alert.materialName}</p>
                <p className="text-muted-foreground text-xs">SKU: {alert.materialSku}</p>
              </div>
            )}

            {/* Material - Fallback selector if no alert */}
            {!alert && (
              <FormField
                control={form.control}
                name="materialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("alerts.createOrderDialog.material")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("alerts.createOrderDialog.selectMaterial")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {materials.map((mat) => (
                          <SelectItem key={mat.id} value={mat.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span>{mat.name}</span>
                              <span className="text-muted-foreground text-xs">
                                ({Number(mat.currentStock)}/{Number(mat.minStock)} {mat.unit})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("alerts.createOrderDialog.quantity")} *</FormLabel>
                  <div className="flex items-end gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                    </FormControl>
                    {alert && (
                      <div className="bg-muted flex min-w-[60px] items-center justify-center gap-2 rounded-md px-3 py-2">
                        <Package className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm font-medium">{alert.unit}</span>
                      </div>
                    )}
                  </div>
                  {alert && suggestedQuantity > 0 && (
                    <FormDescription>
                      {t("alerts.createOrderDialog.suggested")}: {suggestedQuantity} {alert.unit}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormLabel>{t("alerts.createOrderDialog.notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("alerts.createOrderDialog.notesPlaceholder")}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t("alerts.createOrderDialog.notesHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createOrder.isPending}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={createOrder.isPending}>
                {createOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t("alerts.createOrderDialog.submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
