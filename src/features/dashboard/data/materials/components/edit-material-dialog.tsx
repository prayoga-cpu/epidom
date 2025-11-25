"use client";

import { useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Plus, X, Star } from "lucide-react";
import { MaterialWithSuppliers } from "@/lib/repositories/material.repository";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUpdateMaterial } from "../hooks/use-materials";
import { useSuppliers } from "../../suppliers/hooks/use-suppliers";
import {
  updateIngredientFormSchema,
  type UpdateIngredientFormInput,
} from "@/lib/validation/inventory.schemas";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatNumberForInput, createNumberInputHandler } from "@/lib/utils/number-input";

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

  const updateMaterial = useUpdateMaterial(storeId, materialId);

  // Fetch suppliers for dropdown
  const { data: suppliersData } = useSuppliers(storeId, {
    sortBy: "name",
    sortOrder: "asc",
    skip: 0,
    take: 100,
  });
  const suppliers = suppliersData?.suppliers || [];

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
    if (material && open) {
      const unitCost = Number(material.unitCost) || 0;
      const currentStock = Number(material.currentStock) || 0;
      const minStock = Number(material.minStock) || 0;
      const maxStock = Number(material.maxStock) || 0;

      form.reset({
        name: material.name,
        sku: material.sku || "",
        category: material.category || "",
        description: material.description || "",
        unit: material.unit,
        unitCost: unitCost > 0 ? convertPrice(unitCost) : undefined, // Convert EUR to user's currency, undefined if 0
        currentStock: currentStock > 0 ? currentStock : undefined,
        minStock: minStock > 0 ? minStock : undefined,
        maxStock: maxStock > 0 ? maxStock : undefined,
        suppliers:
          material.materialSuppliers?.map((s) => ({
            supplierId: s.supplierId,
            price: convertPrice(Number(s.price) || 0), // Convert EUR to user's currency for display
            isPreferred: s.isPreferred,
          })) || [],
      });
    }
  }, [material, open, form, convertPrice]);

  const onSubmit = async (data: UpdateIngredientFormInput) => {
    if (!material) return;

    try {
      // Filter out invalid suppliers (those with "none" or empty supplierId)
      const validSuppliers =
        data.suppliers?.filter((s) => s.supplierId && s.supplierId !== "none") || [];

      const payload = {
        ...data,
        unitCost: convertToBase(data.unitCost ?? 0), // Convert back to EUR before saving, default to 0 if undefined
        currentStock: data.currentStock ?? 0, // Default to 0 if undefined
        minStock: data.minStock ?? 0, // Default to 0 if undefined
        maxStock: data.maxStock ?? 0, // Default to 0 if undefined
        // Always send suppliers array, even if empty, to allow removing all suppliers
        suppliers: validSuppliers.map((s) => ({
          ...s,
          price: convertToBase(s.price ?? 0), // Convert supplier prices back to EUR
        })),
      };

      await updateMaterial.mutateAsync(payload);
      toast.success(
        t("data.materials.toasts.updated.description")?.replace(
          "{name}",
          data.name || material.name
        ) || ""
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.failedToUpdateMaterial"));
    }
  };

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            className="space-y-1.5"
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
                        <Input
                          placeholder={t("data.materials.form.categoryPlaceholder")}
                          {...field}
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
                        className="min-h-[55px] text-sm"
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
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.unitCost")} ({currency === "EUR" ? "€" : "$"}) *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={t("data.materials.form.costPlaceholder")}
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
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
                  name="currentStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.currentStock")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="100"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 items-start gap-1.5">
                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">
                        {t("data.materials.form.minStockLevel")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="20"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
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
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="500"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
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
            <div className="space-y-1">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
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
                      isPreferred: false,
                    })
                  }
                >
                  <Plus className="mr-1 hidden h-4 w-4 sm:inline" />
                  {t("data.materials.form.addSupplier")}
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("data.materials.form.noSuppliersYet")}
                </p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 rounded-lg border p-2">
                  <div className="flex-1 space-y-1">
                    <FormField
                      control={form.control}
                      /**
                       * Type assertion needed because TypeScript cannot infer dynamic field paths
                       * in React Hook Form's useFieldArray
                       * Actual type: `suppliers.${number}.supplierId`
                       * Known limitation: Dynamic field paths require type assertion
                       */
                      name={`suppliers.${index}.supplierId` as any}
                      render={({ field }) => (
                        <FormItem className="space-y-0.5">
                          <FormLabel className="text-sm">
                            {t("data.materials.form.supplier")} *
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={(field.value as string) || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("data.materials.form.selectSupplierPlaceholder")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none" disabled>
                                {t("data.materials.form.selectSupplierPlaceholder")}
                              </SelectItem>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            {t("data.materials.form.chooseSupplier")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 items-start gap-1.5">
                      <FormField
                        control={form.control}
                        /**
                         * Type assertion needed because TypeScript cannot infer dynamic field paths
                         * in React Hook Form's useFieldArray
                         * Actual type: `suppliers.${number}.price`
                         * Known limitation: Dynamic field paths require type assertion
                         */
                        name={`suppliers.${index}.price` as any}
                        render={({ field }) => (
                          <FormItem className="space-y-0.5">
                            <FormLabel className="text-sm">
                              {t("data.materials.form.supplierPrice")} (
                              {currency === "EUR" ? "€" : "$"}) *
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="25.00"
                                value={formatNumberForInput(field.value as number | undefined)}
                                onChange={createNumberInputHandler(field.onChange)}
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
                        /**
                         * Type assertion needed because TypeScript cannot infer dynamic field paths
                         * in React Hook Form's useFieldArray
                         * Actual type: `suppliers.${number}.isPreferred`
                         * Known limitation: Dynamic field paths require type assertion
                         */
                        name={`suppliers.${index}.isPreferred` as any}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-y-0 space-x-2 pt-8">
                            <FormControl>
                              <Checkbox
                                checked={field.value as boolean}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {t("data.materials.form.preferred")}
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
