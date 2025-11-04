"use client";

import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/components/lang/i18n-provider";
import { MOCK_SUPPLIERS } from "@/mocks";
import { PackagePlus, Loader2 } from "lucide-react";

// Stock item interface
export interface StockItem {
  id: string;
  name: string;
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
const restockSchema = z.object({
  supplierId: z.string().min(1, "Please select a supplier"),
  quantity: z.coerce
    .number()
    .positive("Quantity must be positive")
    .min(0.01, "Quantity must be at least 0.01"),
  deliveryDate: z.string().min(1, "Please select a delivery date"),
  priority: z.nativeEnum(Priority),
  notes: z.string().optional(),
});

type RestockFormData = z.infer<typeof restockSchema>;

interface RestockDialogProps {
  item?: StockItem;
  triggerButton?: React.ReactNode;
}

export default function RestockDialog({ item, triggerButton }: RestockDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate suggested quantity (fill to max stock)
  const suggestedQuantity = item
    ? Math.max(0, item.maxStock - item.currentStock)
    : 0;

  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      supplierId: "",
      quantity: suggestedQuantity,
      deliveryDate: "",
      priority: Priority.MEDIUM,
      notes: "",
    },
  });

  const onSubmit = async (data: RestockFormData) => {
    setIsSubmitting(true);

    try {
      // TODO: Replace with TanStack Query mutation
      // const mutation = useMutation({
      //   mutationFn: createRestockOrder,
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
      //   itemId: item?.id,
      //   supplierId: data.supplierId,
      //   quantity: data.quantity,
      //   deliveryDate: data.deliveryDate,
      //   priority: data.priority,
      //   notes: data.notes,
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const supplier = MOCK_SUPPLIERS.find((s) => s.id === data.supplierId);

      toast({
        title: t("tracking.toasts.restockInitiated.title"),
        description: `${data.quantity} ${item?.unit || "units"} of ${item?.name || "product"} from ${supplier?.name || "supplier"}`,
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create restock order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button size="sm" className="gap-2">
            <PackagePlus className="h-4 w-4" />
            {t("tracking.restock")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("tracking.dialogs.restock.title")}</DialogTitle>
          <DialogDescription>
            {t("tracking.dialogs.restock.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product Info */}
            {item && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("tracking.currentStock")}: {item.currentStock} {item.unit} •{" "}
                  {t("tracking.maxLevel")}: {item.maxStock} {item.unit}
                </p>
              </div>
            )}

            {/* Supplier Selection */}
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tracking.selectSupplier")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("tracking.selectSupplier")} />
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

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tracking.reorderQuantity")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={t("tracking.enterQuantity")}
                      {...field}
                    />
                  </FormControl>
                  {suggestedQuantity > 0 && (
                    <FormDescription>
                      {t("tracking.suggestedQuantity")}: {suggestedQuantity} {item?.unit}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Optional</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {t("tracking.createOrder")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}




