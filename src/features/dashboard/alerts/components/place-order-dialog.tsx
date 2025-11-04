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
import { MOCK_SUPPLIERS, MOCK_MATERIALS } from "@/mocks";
import { type Alert } from "@/types/entities";
import { ShoppingCart, Loader2, Package } from "lucide-react";

// Priority enum
enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

// Zod validation schema
const placeOrderSchema = z.object({
  supplierId: z.string().min(1, "Please select a supplier"),
  materialId: z.string().min(1, "Please select a material"),
  quantity: z.coerce
    .number()
    .positive("Quantity must be positive")
    .min(0.01, "Quantity must be at least 0.01"),
  expectedDeliveryDate: z.string().min(1, "Please select an expected delivery date"),
  priority: z.nativeEnum(Priority),
  notes: z.string().optional(),
});

type PlaceOrderFormData = z.infer<typeof placeOrderSchema>;

interface PlaceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert?: Alert | null;
}

export default function PlaceOrderDialog({
  open,
  onOpenChange,
  alert,
}: PlaceOrderDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get material from alert
  const material = alert?.materialId
    ? MOCK_MATERIALS.find((m) => m.id === alert.materialId)
    : null;

  // Get supplier from material
  const primarySupplier =
    material?.materialSuppliers?.find((s) => s.isPreferred) ||
    material?.materialSuppliers?.[0];
  const suggestedSupplier = primarySupplier?.supplierId || "";

  // Calculate suggested quantity (fill to min stock)
  const suggestedQuantity = alert?.metadata?.recommendedOrderQty
    ? alert.metadata.recommendedOrderQty
    : material
    ? Math.max(0, material.minStock - material.currentStock)
    : 0;

  const form = useForm<PlaceOrderFormData>({
    resolver: zodResolver(placeOrderSchema),
    defaultValues: {
      supplierId: suggestedSupplier,
      materialId: alert?.materialId || "",
      quantity: suggestedQuantity,
      expectedDeliveryDate: "",
      priority: Priority.MEDIUM,
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
        priority: alert.priority === "critical" || alert.priority === "high" ? Priority.HIGH : Priority.MEDIUM,
        notes: `Order from alert: ${alert.title}`,
      });
    }
  }, [open, alert, form, suggestedSupplier, suggestedQuantity]);

  const onSubmit = async (data: PlaceOrderFormData) => {
    setIsSubmitting(true);

    try {
      // TODO: Replace with API call
      // const response = await fetch('/api/orders/restock', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     supplierId: data.supplierId,
      //     materialId: data.materialId,
      //     quantity: data.quantity,
      //     expectedDeliveryDate: data.expectedDeliveryDate,
      //     priority: data.priority,
      //     notes: data.notes,
      //     alertId: alert?.id, // Link to alert for tracking
      //   }),
      // });
      //
      // if (!response.ok) throw new Error('Failed to create order');

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const supplier = MOCK_SUPPLIERS.find((s) => s.id === data.supplierId);
      const selectedMaterial = MOCK_MATERIALS.find((m) => m.id === data.materialId);

      toast({
        title: t("alerts.toasts.orderCreated"),
        description: `Order reminder created: ${data.quantity} ${selectedMaterial?.unit || "units"} of ${selectedMaterial?.name || "material"} from ${supplier?.name || "supplier"}`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create order reminder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected material for display
  const selectedMaterialId = form.watch("materialId");
  const selectedMaterial = MOCK_MATERIALS.find((m) => m.id === selectedMaterialId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("alerts.createOrderDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("alerts.createOrderDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Alert Info (if from alert) */}
            {alert && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{alert.title}</p>
                  <Badge variant="outline">
                    {alert.priority === "critical" ? "Urgent" : alert.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
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
                      {MOCK_SUPPLIERS.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          <div className="flex flex-col">
                            <span>{supplier.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {supplier.phone}
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

            {/* Material */}
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
                      {MOCK_MATERIALS.map((mat) => (
                        <SelectItem key={mat.id} value={mat.id}>
                          <div className="flex items-center justify-between gap-2">
                            <span>{mat.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({mat.currentStock}/{mat.minStock} {mat.unit})
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

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("alerts.createOrderDialog.quantity")} *</FormLabel>
                  <div className="flex gap-2 items-end">
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
                    {selectedMaterial && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted min-w-[60px] justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {selectedMaterial.unit}
                        </span>
                      </div>
                    )}
                  </div>
                  {selectedMaterial && suggestedQuantity > 0 && (
                    <FormDescription>
                      {t("alerts.createOrderDialog.suggested")}: {suggestedQuantity}{" "}
                      {selectedMaterial.unit}
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

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("alerts.createOrderDialog.priority")} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={Priority.LOW}>{t("alerts.priorities.low")}</SelectItem>
                      <SelectItem value={Priority.MEDIUM}>
                        {t("alerts.priorities.medium")}
                      </SelectItem>
                      <SelectItem value={Priority.HIGH}>{t("alerts.priorities.high")}</SelectItem>
                      <SelectItem value={Priority.URGENT}>
                        {t("alerts.priorities.urgent")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                  <FormDescription>
                    {t("alerts.createOrderDialog.notesHint")}
                  </FormDescription>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
