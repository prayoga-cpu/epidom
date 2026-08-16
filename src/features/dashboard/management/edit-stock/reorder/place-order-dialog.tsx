"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { type LowStockAlert } from "@/features/dashboard/shared/hooks/use-alerts";
import { useCreateSupplierOrder } from "@/features/dashboard/shared/hooks/use-supplier-orders";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useSuppliers } from "@/features/dashboard/data/suppliers/hooks/use-suppliers";
import { CheckCircle2, Loader2, Mail, Package, Phone, Printer } from "lucide-react";
import { useParams } from "next/navigation";

// Zod validation schema
const placeOrderSchema = z.object({
  supplierId: z.string().min(1, "Please select a supplier"),
  materialId: z.string().min(1, "Please select a material"),
  quantity: z.coerce
    .number()
    .positive("Quantity must be positive")
    .min(0.001, "Quantity must be at least 0.001"),
  expectedDeliveryDate: z.string().min(1, "Please select an expected delivery date"),
  // DLC — optional, since dry goods and non-perishables don't carry one.
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

type PlaceOrderFormData = z.infer<typeof placeOrderSchema>;

/** What the dialog shows once the order exists — id/number drive the print link. */
interface CreatedOrder {
  id: string;
  orderNumber: string;
  supplierName: string;
}

interface PlaceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert?: LowStockAlert | null;
}

export function PlaceOrderDialog({ open, onOpenChange, alert }: PlaceOrderDialogProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const params = useParams();
  const storeId = params?.storeId as string;

  // Fetch materials
  const { data: materialsData } = useMaterials(storeId);
  const materials = useMemo(() => materialsData?.materials ?? [], [materialsData]);

  // Every supplier on file for this store — not just the ones already linked
  // to the material. A manual "Create Order" has no alert to read suppliers
  // from, which is why the picker used to be empty on that path.
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useSuppliers(storeId, {
    sortBy: "name",
    sortOrder: "asc",
    take: 100,
  });
  const suppliers = useMemo(() => suppliersData?.suppliers ?? [], [suppliersData]);

  // Create supplier order mutation
  const createOrder = useCreateSupplierOrder(storeId);

  // Set once the order exists — swaps the form for the confirmation view.
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

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
      expiryDate: "",
      notes: "",
    },
  });

  const selectedMaterialId = form.watch("materialId");
  const selectedSupplierId = form.watch("supplierId");

  /** The material being ordered, from the alert or the manual picker. */
  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId]
  );

  const unit = alert?.unit ?? selectedMaterial?.unit ?? "";

  // Suppliers that already carry this material come first with their agreed
  // price; the rest stay selectable so a merchant can order from anyone on
  // file (a one-off substitute supplier, say) without editing the material.
  const { linkedSuppliers, otherSuppliers } = useMemo(() => {
    const linked: typeof suppliers = [];
    const others: typeof suppliers = [];

    for (const supplier of suppliers) {
      const carriesMaterial = supplier.materialSuppliers?.some(
        (ms) => ms.materialId === selectedMaterialId
      );
      (carriesMaterial ? linked : others).push(supplier);
    }

    // Preferred supplier for this material floats to the top of its group.
    linked.sort((a, b) => {
      const aPreferred = a.materialSuppliers?.find(
        (ms) => ms.materialId === selectedMaterialId
      )?.isPreferred;
      const bPreferred = b.materialSuppliers?.find(
        (ms) => ms.materialId === selectedMaterialId
      )?.isPreferred;
      if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { linkedSuppliers: linked, otherSuppliers: others };
  }, [suppliers, selectedMaterialId]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) ?? null,
    [suppliers, selectedSupplierId]
  );

  /**
   * Price per material unit for the chosen supplier: the agreed
   * MaterialSupplier price when the two are linked, else what the alert
   * quoted, else the material's own unit cost. Never guesses zero silently
   * for a linked supplier.
   */
  const unitPrice = useMemo(() => {
    const link = selectedSupplier?.materialSuppliers?.find(
      (ms) => ms.materialId === selectedMaterialId
    );
    if (link) return Number(link.price);

    const fromAlert = alert?.suppliers?.find((s) => s.id === selectedSupplierId)?.price;
    if (fromAlert !== undefined) return Number(fromAlert);

    return Number(selectedMaterial?.unitCost ?? 0);
  }, [selectedSupplier, selectedMaterialId, selectedMaterial, alert, selectedSupplierId]);

  const quantity = form.watch("quantity");
  const estimatedTotal = (Number(quantity) || 0) * unitPrice;

  // Reset form when dialog opens or alert changes
  useEffect(() => {
    if (!open) return;
    setCreatedOrder(null);
    form.reset({
      supplierId: alert ? suggestedSupplier : "",
      materialId: alert?.materialId || "",
      quantity: alert ? suggestedQuantity : 0,
      expectedDeliveryDate: "",
      expiryDate: "",
      notes: alert ? `Restock order for ${alert.materialName} (${alert.materialSku})` : "",
    });
    // `form` is stable across renders (react-hook-form) and `suggested*` are
    // derived from `alert`, so open/alert are the real triggers here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, alert]);

  const onSubmit = async (data: PlaceOrderFormData) => {
    const supplierName =
      selectedSupplier?.name ??
      alert?.suppliers?.find((s) => s.id === data.supplierId)?.name ??
      "";

    try {
      const order = await createOrder.mutateAsync({
        supplierId: data.supplierId,
        items: [
          {
            materialId: data.materialId,
            quantity: data.quantity,
            unit,
            unitPrice,
            ...(data.expiryDate ? { expiryDate: data.expiryDate } : {}),
          },
        ],
        expectedDate: data.expectedDeliveryDate,
        notes: data.notes || `Restock order for ${selectedMaterial?.name ?? ""}`.trim(),
      });

      toast({
        title: t("alerts.toasts.orderCreated"),
        description: `${data.quantity} ${unit} — ${selectedMaterial?.name ?? ""} · ${supplierName}`,
      });

      setCreatedOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        supplierName: order.supplier?.name || supplierName,
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description:
          error instanceof Error ? error.message : "Failed to create order. Please try again.",
        variant: "destructive",
      });
    }
  };

  // The quote opens in its own tab and prints itself (window.print → Save as
  // PDF), matching every other printable document in the dashboard.
  const handlePrintQuote = () => {
    if (!createdOrder) return;
    window.open(`/store/${storeId}/management/print?orderId=${createdOrder.id}`, "_blank");
  };

  const handleCreateAnother = () => {
    setCreatedOrder(null);
    form.reset({
      supplierId: "",
      materialId: "",
      quantity: 0,
      expectedDeliveryDate: "",
      expiryDate: "",
      notes: "",
    });
  };

  const noSuppliersOnFile = !isLoadingSuppliers && suppliers.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={
          createdOrder
            ? t("alerts.createOrderDialog.createdTitle")
            : t("alerts.createOrderDialog.title")
        }
        description={
          createdOrder
            ? t("alerts.createOrderDialog.createdDescription")
            : t("alerts.createOrderDialog.description")
        }
        maxWidth="lg"
        footer={
          createdOrder ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                {t("common.actions.close")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateAnother}
                className="w-full sm:w-auto"
              >
                {t("alerts.createOrderDialog.createAnother")}
              </Button>
              <Button type="button" onClick={handlePrintQuote} className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" />
                {t("alerts.createOrderDialog.printQuote")}
              </Button>
            </div>
          ) : (
            <FormDialogFooter
              formId="place-order-form"
              onCancel={() => onOpenChange(false)}
              submitText={t("alerts.createOrderDialog.submit")}
              isPending={createOrder.isPending}
            />
          )
        }
      >
        {createdOrder ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {t("alerts.createOrderDialog.createdTitle")}
                </p>
                <p className="text-muted-foreground text-xs break-all">
                  {createdOrder.orderNumber} · {createdOrder.supplierName}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              {t("alerts.createOrderDialog.printQuoteHint")}
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form id="place-order-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Alert Info (if from alert) */}
              {alert && (
                <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{alert.materialName}</p>
                    <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>
                      {alert.severity === "critical"
                        ? t("common.stockStatus.outOfStock")
                        : t("common.stockStatus.lowStock")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t("alerts.detailsDialog.current")} {t("common.stock").toLowerCase()}:{" "}
                    {alert.currentStock} {alert.unit} / {t("alerts.detailsDialog.minimum")}:{" "}
                    {alert.minStock} {alert.unit} ({alert.stockPercentage}%)
                  </p>
                </div>
              )}

              {/* Material — picked first, since it decides which suppliers carry it */}
              {alert ? (
                <>
                  <input type="hidden" {...form.register("materialId")} />
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">{alert.materialName}</p>
                    <p className="text-muted-foreground text-xs">
                      {t("data.materials.form.sku")}: {alert.materialSku}
                    </p>
                  </div>
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="materialId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("alerts.createOrderDialog.material")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t("alerts.createOrderDialog.selectMaterial")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[...materials]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((mat) => (
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

              {/* Supplier */}
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("alerts.createOrderDialog.supplier")} *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoadingSuppliers || noSuppliersOnFile}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              isLoadingSuppliers
                                ? t("common.loading")
                                : t("alerts.createOrderDialog.selectSupplier")
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {linkedSuppliers.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>
                              {t("alerts.createOrderDialog.suppliersForMaterial")}
                            </SelectLabel>
                            {linkedSuppliers.map((supplier) => {
                              const link = supplier.materialSuppliers?.find(
                                (ms) => ms.materialId === selectedMaterialId
                              );
                              return (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  <span className="flex flex-wrap items-center gap-2">
                                    {supplier.name}
                                    {link?.isPreferred && (
                                      <Badge variant="secondary" className="text-xs">
                                        {t("alerts.createOrderDialog.preferred")}
                                      </Badge>
                                    )}
                                    {link && (
                                      <span className="text-muted-foreground text-xs">
                                        {formatPrice(Number(link.price))}
                                        {unit ? `/${unit}` : ""}
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        )}

                        {otherSuppliers.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>
                              {linkedSuppliers.length > 0
                                ? t("alerts.createOrderDialog.otherSuppliers")
                                : t("alerts.createOrderDialog.allSuppliers")}
                            </SelectLabel>
                            {otherSuppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                    {noSuppliersOnFile && (
                      <FormDescription className="text-destructive">
                        {t("alerts.createOrderDialog.noSuppliers")}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Selected supplier contact details */}
              {selectedSupplier && (
                <div className="bg-muted/30 space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Phone className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm font-medium">
                        {t("alerts.createOrderDialog.supplierPhone")}:
                      </span>
                    </div>
                    {selectedSupplier.phone ? (
                      <a
                        href={`tel:${selectedSupplier.phone}`}
                        className="text-primary hover:text-primary/80 text-sm font-medium underline transition-colors"
                        aria-label={t("alerts.createOrderDialog.callSupplier")}
                      >
                        {selectedSupplier.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">
                        {t("alerts.createOrderDialog.noPhoneAvailable")}
                      </span>
                    )}
                  </div>
                  {selectedSupplier.email && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Mail className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm font-medium">
                          {t("data.suppliers.form.email")}:
                        </span>
                      </div>
                      <a
                        href={`mailto:${selectedSupplier.email}`}
                        className="text-primary hover:text-primary/80 text-sm font-medium break-all underline transition-colors"
                      >
                        {selectedSupplier.email}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("alerts.createOrderDialog.quantity")} *</FormLabel>
                    <div className="flex items-start gap-2">
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
                          className="flex-1"
                        />
                      </FormControl>
                      {unit && (
                        <div className="bg-muted flex min-w-[60px] items-center justify-center gap-2 rounded-md px-3 py-2">
                          <Package className="text-muted-foreground h-4 w-4" />
                          <span className="text-sm font-medium">{unit}</span>
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      {alert && suggestedQuantity > 0 && (
                        <>
                          {t("alerts.createOrderDialog.suggested")}: {suggestedQuantity} {unit} ·{" "}
                        </>
                      )}
                      {t("alerts.orderTotal")}: {formatPrice(estimatedTotal)}
                      {unitPrice > 0 && (
                        <>
                          {" "}
                          ({formatPrice(unitPrice)}
                          {unit ? `/${unit}` : ""})
                        </>
                      )}
                    </FormDescription>
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

              {/* Requested DLC / expiration date */}
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("alerts.createOrderDialog.expiryDate")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t("alerts.createOrderDialog.expiryDateHint")}
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

              {createOrder.isPending && (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("alerts.placing")}
                </p>
              )}
            </form>
          </Form>
        )}
      </FormDialogLayout>
    </Dialog>
  );
}
