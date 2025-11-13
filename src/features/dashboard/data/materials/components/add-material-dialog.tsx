"use client";

import { useState } from "react";
import { useFieldArray } from "react-hook-form";
import { DialogWrapper } from "@/features/dashboard/shared/components/dialog-wrapper";
import { useDialogForm } from "@/features/dashboard/shared/hooks/use-dialog-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Loader2, X, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCreateMaterial } from "../hooks/use-materials";
import { useSuppliers } from "../../suppliers/hooks/use-suppliers";
import { useParams } from "next/navigation";
import {
  createIngredientFormSchema,
  type CreateIngredientFormInput,
} from "@/lib/validation/inventory.schemas";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  parseNumberInput,
  formatNumberForInput,
  createNumberInputHandler,
} from "@/lib/utils/number-input";
import { FORM_DEFAULTS } from "@/lib/config/form-defaults";

// Use the form schema (without storeId)
const formSchema = createIngredientFormSchema;

interface AddMaterialDialogProps {
  trigger?: React.ReactNode;
}

export default function AddMaterialDialog({ trigger }: AddMaterialDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { currency, convertToBase } = useCurrency();
  const params = useParams();
  const storeId = params.storeId as string;

  const createMaterial = useCreateMaterial(storeId);

  // Fetch suppliers for dropdown
  const { data: suppliersData } = useSuppliers(storeId, {
    sortBy: "name",
    sortOrder: "asc",
    skip: 0,
    take: 100,
  });
  const suppliers = suppliersData?.suppliers || [];

  const { form, handleSubmit, isSubmitting, reset } = useDialogForm({
    schema: formSchema,
    defaultValues: { ...FORM_DEFAULTS.material, suppliers: [...FORM_DEFAULTS.material.suppliers] },
    onSubmit: async (data) => {
      // Filter out invalid suppliers (those with "none" or empty supplierId)
      const validSuppliers =
        data.suppliers?.filter((s: any) => s.supplierId && s.supplierId !== "none") || [];

      // Ensure we have default values for required fields
      // Convert undefined to 0 for API submission
      const payload = {
        ...data,
        unit: data.unit || "kg",
        unitCost: convertToBase(data.unitCost ?? 0), // Convert from user's currency to EUR
        currentStock: data.currentStock ?? 0,
        minStock: data.minStock ?? 0,
        maxStock: data.maxStock ?? 1000,
        isActive: data.isActive ?? true,
        suppliers:
          validSuppliers.length > 0
            ? validSuppliers.map((s: any) => ({
                ...s,
                price: convertToBase(s.price ?? 0), // Convert supplier prices to EUR
              }))
            : undefined,
      };

      await createMaterial.mutateAsync(payload);
    },
    onSuccess: () => {
      setOpen(false);
    },
    successMessage: t("data.materials.toasts.added.title"),
    successDescription: (data) =>
      t("data.materials.toasts.added.description")?.replace("{name}", data.name) || "",
    errorMessage: t("messages.errorLoadingMaterials"),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    name: "suppliers" as any,
  });

  return (
    <DialogWrapper
      open={open}
      onOpenChange={setOpen}
      title={t("data.materials.addTitle")}
      description={t("data.materials.addDescription")}
      trigger={
        trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("data.materials.addButton")}
          </Button>
        )
      }
      size="large"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" form="add-material-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("data.materials.addButton")}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form id="add-material-form" onSubmit={handleSubmit} className="space-y-1.5">
            {/* Basic Information */}
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("data.materials.sections.basicInfo")}</h3>

              <div className="grid items-start grid-cols-2 gap-1.5">
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

              <div className="grid items-start grid-cols-2 gap-1.5">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.category")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.materials.form.categoryPlaceholder")} {...field} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-0.5">
                    <FormLabel className="text-sm">{t("data.materials.form.description")}</FormLabel>
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
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("data.materials.sections.pricingStock")}</h3>

              <div className="grid items-start grid-cols-2 gap-1.5">
                <FormField
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.unitCost")} ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
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
                      <FormLabel className="text-sm">{t("data.materials.form.currentStock")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
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

              <div className="grid items-start grid-cols-2 gap-1.5">
                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.minStockLevel")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="20"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">{t("data.materials.form.alertMinStock")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStock"
                  render={({ field }) => (
                    <FormItem className="space-y-0.5">
                      <FormLabel className="text-sm">{t("data.materials.form.maxStockLevel")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="500"
                          value={formatNumberForInput(field.value)}
                          onChange={createNumberInputHandler(field.onChange)}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">{t("data.materials.form.alertMaxStock")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Suppliers */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("data.materials.sections.suppliers")}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ supplierId: "", price: undefined as number | undefined, isPreferred: false })}
                >
                  <Plus className="mr-2 h-4 w-4" />
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
                      name={`suppliers.${index}.supplierId` as any}
                      render={({ field }) => (
                        <FormItem className="space-y-0.5">
                          <FormLabel className="text-sm">{t("data.materials.form.supplier")} *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={(field.value as string) || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("data.materials.form.selectSupplierPlaceholder")} />
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

                    <div className="grid items-start grid-cols-2 gap-1.5">
                      <FormField
                        control={form.control}
                        name={`suppliers.${index}.price` as any}
                        render={({ field }) => (
                          <FormItem className="space-y-0.5">
                            <FormLabel className="text-sm">{t("data.materials.form.supplierPrice")} ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
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
    </DialogWrapper>
  );
}
