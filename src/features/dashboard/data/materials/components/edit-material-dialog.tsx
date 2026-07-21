"use client";

import { useEffect, useRef, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
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
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Plus, X, Star, Trash2, Check } from "lucide-react";
import { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUpdateMaterial, useMaterials } from "../hooks/use-materials";
import { useSuppliers } from "../../suppliers/hooks/use-suppliers";
import {
  updateIngredientFormSchema,
  type UpdateIngredientFormInput,
} from "@/lib/validation/inventory.schemas";
import { useCurrency } from "@/components/providers/currency-provider";
import { DecimalInput } from "@/components/shared/decimal-input";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { useSkuAvailability } from "@/hooks/use-sku-availability";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import {
  roundToSixDecimals,
  formatDerivedUnitCost,
  SupplierPackPriceFields,
} from "./pack-price-fields";

interface EditMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialWithSuppliers | null;
}

export function EditMaterialDialog({ open, onOpenChange, material }: EditMaterialDialogProps) {
  const { t } = useI18n();
  const { currency, convertPrice, convertToBase } = useCurrency();
  const params = useParams();
  const storeId = params.storeId as string;
  const materialId = material?.id || "";

  const isSubmittingRef = useRef(false);
  const savedFormDataRef = useRef<UpdateIngredientFormInput | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    // If closing manually (not submitting), clear saved data
    if (!newOpen && !isSubmittingRef.current) {
      savedFormDataRef.current = null;
    }
    onOpenChange(newOpen);
  };

  const updateMaterial = useUpdateMaterial(storeId, materialId);

  // Fetch suppliers for dropdown
  const { data: suppliersData } = useSuppliers(storeId, {
    sortBy: "name",
    sortOrder: "asc",
    skip: 0,
    take: 100,
  });
  const suppliers = suppliersData?.suppliers || [];

  // Existing categories, for the category combobox's suggestions
  const { data: materialsData } = useMaterials(storeId);
  const categoryOptions = useMemo(() => {
    const cats = new Set(
      (materialsData?.materials || []).map((m) => m.category).filter(Boolean) as string[]
    );
    return Array.from(cats)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [materialsData]);

  /**
   * Type assertion needed because React Hook Form's zodResolver has type incompatibility
   * with complex nested schemas
   * Actual type: Resolver<UpdateIngredientFormInput>
   * Known issue: https://github.com/react-hook-form/react-hook-form/issues/7764
   */
  const form = useForm<UpdateIngredientFormInput>({
    resolver: zodResolver(updateIngredientFormSchema) as any,
    mode: "onSubmit", // Validate only on submit to allow undefined values during editing
    defaultValues: {
      name: "",
      sku: "",
      category: "",
      description: "",
      unit: "",
      unitCost: undefined,
      purchaseQuantity: 1,
      currentStock: undefined,
      minStock: undefined,
      maxStock: undefined,
      suppliers: [],
    },
  });

  /**
   * Type assertion needed because React Hook Form's useFieldArray has type limitations
   * with dynamic field arrays
   * Actual type: Control<UpdateIngredientFormInput>
   * Known issue: https://github.com/react-hook-form/react-hook-form/issues/7764
   */
  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    /**
     * Type assertion needed for dynamic field array names
     * Actual type: "suppliers"
     * Known issue: TypeScript cannot infer dynamic field paths
     */
    name: "suppliers" as any,
  });

  // Update form values when material changes
  useEffect(() => {
    if (!open) return;

    // Restore saved data if any
    if (savedFormDataRef.current) {
      requestAnimationFrame(() => {
        form.reset(savedFormDataRef.current!);
      });
      return;
    }

    if (material) {
      const unitCost = Number(material.unitCost) || 0;
      const purchaseQuantity = Number(material.purchaseQuantity) || 1;
      const currentStock = Number(material.currentStock) || 0;
      const minStock = Number(material.minStock) || 0;
      const maxStock = Number(material.maxStock) || 0;

      // Reconstruct what the user originally paid for one purchase pack
      // (unitCost × purchaseQuantity), so editing shows "Purchase Quantity:
      // 1000, Purchase Price: €2" again instead of forcing them to re-derive
      // it from the stored per-unit cost.
      const purchasePrice =
        unitCost > 0 ? roundToSixDecimals(convertPrice(unitCost) * purchaseQuantity) : undefined;

      form.reset({
        name: material.name,
        sku: material.sku || "",
        category: material.category || "",
        description: material.description || "",
        unit: material.unit,
        unitCost: unitCost > 0 ? convertPrice(unitCost) : undefined, // Convert EUR to user's currency, undefined if 0
        purchaseQuantity,
        purchasePrice,
        currentStock: currentStock > 0 ? currentStock : undefined,
        minStock: minStock > 0 ? minStock : undefined,
        maxStock: maxStock > 0 ? maxStock : undefined,
        suppliers:
          material.materialSuppliers?.map((s) => {
            const supplierUnitCost = Number(s.price) || 0;
            const supplierPurchaseQuantity = Number(s.purchaseQuantity) || 1;
            const supplierPurchasePrice =
              supplierUnitCost > 0
                ? roundToSixDecimals(convertPrice(supplierUnitCost) * supplierPurchaseQuantity)
                : undefined;
            return {
              supplierId: s.supplierId,
              price: convertPrice(supplierUnitCost), // Convert EUR to user's currency for display
              purchaseQuantity: supplierPurchaseQuantity,
              purchasePrice: supplierPurchasePrice,
              isPreferred: s.isPreferred,
            };
          }) || [],
      } as any);
    }
  }, [material, open, form, convertPrice]);

  const skuValue = form.watch("sku") || "";
  const { status: skuStatus } = useSkuAvailability(
    `/api/stores/${storeId}/materials/check-sku`,
    skuValue,
    materialId
  );

  // Auto-derive Unit Cost from Purchase Quantity + Purchase Price, so the
  // user edits cost the way they actually buy it (e.g. "€2 for a 1000g bag")
  // instead of dividing it into a per-gram rate by hand. `purchasePrice` isn't
  // part of the submitted schema — it only exists to compute `unitCost`,
  // which is what's actually validated and sent to the server.
  const unitValue = form.watch("unit") || "kg";
  const purchaseQuantityValue = form.watch("purchaseQuantity");
  const purchasePriceValue = form.watch("purchasePrice" as any) as number | undefined;

  useEffect(() => {
    const qty = purchaseQuantityValue ?? 1;
    const price = purchasePriceValue ?? 0;
    if (!(qty > 0)) return;
    form.setValue("unitCost", roundToSixDecimals(price / qty), {
      shouldValidate: true,
      shouldDirty: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseQuantityValue, purchasePriceValue]);

  const unitCostValue = form.watch("unitCost");
  const derivedUnitCostHint =
    unitCostValue && unitCostValue > 0
      ? t("data.materials.form.derivedUnitCostHint")
          .replace(
            "{value}",
            `${getCurrencySymbol(currency)}${formatDerivedUnitCost(unitCostValue)}`
          )
          .replace("{unit}", unitValue)
      : undefined;

  const onSubmit = async (data: UpdateIngredientFormInput) => {
    if (!material) return;

    try {
      // Filter out invalid suppliers (those with "none" or empty supplierId)
      const validSuppliers =
        data.suppliers?.filter((s) => s.supplierId && s.supplierId !== "none") || [];

      const payload = {
        ...data,
        unitCost: convertToBase(data.unitCost ?? 0), // Convert back to EUR before saving, default to 0 if undefined
        purchaseQuantity: data.purchaseQuantity ?? 1,
        currentStock: data.currentStock ?? 0, // Default to 0 if undefined
        minStock: data.minStock ?? 0, // Default to 0 if undefined
        maxStock: data.maxStock ?? 0, // Default to 0 if undefined
        // Always send suppliers array, even if empty, to allow removing all suppliers
        suppliers: validSuppliers.map((s) => ({
          ...s,
          price: convertToBase(s.price ?? 0), // Convert supplier prices back to EUR
          purchaseQuantity: s.purchaseQuantity ?? 1,
        })),
      };

      // OPTIMISTIC CLOSING
      savedFormDataRef.current = data;
      isSubmittingRef.current = true;
      onOpenChange(false);

      const promise = updateMaterial.mutateAsync(payload);

      toast.promise(promise, {
        loading: t("common.actions.saving"),
        success: () => {
          isSubmittingRef.current = false;
          savedFormDataRef.current = null;
          return (
            t("data.materials.toasts.updated.description")?.replace(
              "{name}",
              data.name || material.name
            ) || ""
          );
        },
        error: (err) => {
          isSubmittingRef.current = false;
          onOpenChange(true);
          const fieldSummary = applyServerFieldErrors(form, err);
          if (fieldSummary) return fieldSummary;
          return err instanceof Error ? err.message : t("messages.failedToUpdateMaterial");
        },
      });

      await promise;
    } catch (error) {
      // Handled by toast.promise
      console.error(error);
    }
  };

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FormDialogLayout
        title={t("data.materials.editTitle")}
        description={
          t("data.materials.editDescription") ||
          "Update material information. Fields marked with * are required."
        }
        maxWidth="xl"
        footer={
          <FormDialogFooter
            formId="edit-material-form"
            onCancel={() => onOpenChange(false)}
            submitText={
              updateMaterial.isPending
                ? t("common.actions.saving")
                : t("common.actions.saveChanges")
            }
            isPending={updateMaterial.isPending}
          />
        }
      >
        <Form {...form}>
          <form
            id="edit-material-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-1"
          >
            {/* Basic Information */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.materials.sections.basicInfo")}
              </h3>
              {/* Material Name & SKU */}
              <div className="grid items-start gap-1.5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.name")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.materials.form.namePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.sku")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.materials.form.skuPlaceholder")} {...field} />
                      </FormControl>
                      {skuStatus === "checking" && (
                        <FormDescription className="text-xs">
                          {t("data.materials.form.skuChecking")}
                        </FormDescription>
                      )}
                      {skuStatus === "available" && (
                        <FormDescription className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" /> {t("data.materials.form.skuAvailable")}
                        </FormDescription>
                      )}
                      {skuStatus === "taken" && (
                        <FormDescription className="text-destructive flex items-center gap-1 text-xs">
                          <X className="h-3 w-3" /> {t("data.materials.form.skuTaken")}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 items-start gap-1.5">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.category")}</FormLabel>
                      <FormControl>
                        <Combobox
                          creatable
                          options={categoryOptions}
                          value={field.value || undefined}
                          onChange={field.onChange}
                          placeholder={t("data.materials.form.categoryPlaceholder")}
                          searchPlaceholder={t("data.materials.form.categorySearchPlaceholder")}
                          createLabel={(v) =>
                            t("data.materials.form.createCategory").replace("{value}", v)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.unit")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.materials.form.selectUnit")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="kg">{t("data.materials.units.kg")}</SelectItem>
                          <SelectItem value="g">{t("data.materials.units.g")}</SelectItem>
                          <SelectItem value="l">{t("data.materials.units.l")}</SelectItem>
                          <SelectItem value="ml">{t("data.materials.units.ml")}</SelectItem>
                          <SelectItem value="pcs">{t("data.materials.units.pcs")}</SelectItem>
                          <SelectItem value="box">{t("data.materials.units.box")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">
                      {t("data.materials.form.description")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.materials.form.descriptionPlaceholder")}
                        className="text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing & Stock */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.materials.sections.pricingStock")}
              </h3>

              <div className="grid grid-cols-2 items-start gap-1.5">
                <FormField
                  control={form.control}
                  name="purchaseQuantity"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.purchaseQuantity")} ({unitValue}) *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="1000"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.materials.form.purchaseQuantityHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={"purchasePrice" as any}
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.purchasePrice")} ({getCurrencySymbol(currency)}) *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={2}
                          min={0}
                          placeholder={t("data.materials.form.costPlaceholder")}
                          value={field.value as number | undefined}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      {derivedUnitCostHint && (
                        <FormDescription className="text-xs">{derivedUnitCostHint}</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 items-start gap-1.5">
                <FormField
                  control={form.control}
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.currentStock")}
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="100"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.minStockLevel")}
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="20"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.materials.form.alertMinStock")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.maxStockLevel")}
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={3}
                          min={0}
                          placeholder="500"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        {t("data.materials.form.alertMaxStock")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Suppliers */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  {t("data.materials.sections.suppliers")}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      supplierId: "",
                      price: undefined as number | undefined,
                      purchaseQuantity: 1,
                      purchasePrice: undefined as number | undefined,
                      isPreferred: false,
                    } as any)
                  }
                  className="h-8 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("data.materials.form.addSupplier")}</span>
                </Button>
              </div>

              {fields.length === 0 && (
                <div className="animate-in fade-in-50 flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center text-sm">
                  <p className="text-muted-foreground">{t("data.materials.form.noSuppliersYet")}</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-primary h-auto p-0"
                    onClick={() =>
                      append({
                        supplierId: "",
                        price: undefined as number | undefined,
                        purchaseQuantity: 1,
                        purchasePrice: undefined as number | undefined,
                        isPreferred: false,
                      } as any)
                    }
                  >
                    {t("data.materials.form.addSupplier")}
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="bg-card hover:border-primary/20 relative rounded-lg border shadow-sm transition-all"
                  >
                    <div className="bg-muted/30 flex items-center justify-between border-b px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span className="text-muted-foreground text-xs font-medium">
                          {t("data.materials.form.supplier")}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1 h-6 w-6"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="p-3">
                      <div className="grid gap-3">
                        <FormField
                          control={form.control}
                          name={`suppliers.${index}.supplierId` as any}
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="sr-only">
                                {t("data.materials.form.supplier")}
                              </FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={(field.value as string) || "none"}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={t(
                                        "data.materials.form.selectSupplierPlaceholder"
                                      )}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none" disabled>
                                    {t("data.materials.form.selectSupplierPlaceholder")}
                                  </SelectItem>
                                  {[...suppliers]
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((supplier) => (
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

                        <SupplierPackPriceFields form={form} index={index} currency={currency} />

                        <FormField
                          control={form.control}
                          name={`suppliers.${index}.isPreferred` as any}
                          render={({ field }) => (
                            <FormItem className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value as boolean}
                                    onCheckedChange={field.onChange}
                                    className="data-[state=checked]:bg-primary"
                                  />
                                </FormControl>
                                <FormLabel className="text-muted-foreground cursor-pointer text-xs font-normal">
                                  {t("data.materials.form.preferred")}
                                </FormLabel>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
