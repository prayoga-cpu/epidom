"use client";

import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
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
import { toast } from "sonner";
import { Plus, Loader2, X, Star } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCreateMaterial } from "../hooks/use-materials";
import { useSuppliers, supplierKeys } from "../../suppliers/hooks/use-suppliers";
import { useParams } from "next/navigation";
import { createIngredientFormSchema, CreateIngredientFormInput } from "@/lib/validation/inventory.schemas";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  formatNumberForInput,
  createNumberInputHandler,
} from "@/lib/utils/number-input";
import { FORM_DEFAULTS } from "@/lib/config/form-defaults";

// Use the form schema (without storeId)
const formSchema = createIngredientFormSchema;

interface AddMaterialDialogProps {
  trigger?: React.ReactNode;
}

// Supplier filter configuration (extracted for reuse in prefetch)
const SUPPLIER_FILTERS = {
  sortBy: "name" as const,
  sortOrder: "asc" as const,
  skip: 0,
  take: 100,
};

export default function AddMaterialDialog({ trigger }: AddMaterialDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { currency, convertToBase } = useCurrency();
  const params = useParams();
  const storeId = params.storeId as string;
  const queryClient = useQueryClient();

  const createMaterial = useCreateMaterial(storeId);

  // Fetch suppliers for dropdown - only when dialog is open (performance optimization)
  const { data: suppliersData } = useSuppliers(
    storeId,
    SUPPLIER_FILTERS,
    { enabled: open } // Only fetch when dialog is open
  );
  const suppliers = suppliersData?.suppliers || [];

  // Prefetch suppliers on hover for perceived performance
  // This starts loading data before user clicks, so dialog opens faster
  const handlePrefetchSuppliers = useCallback(() => {
    if (!storeId) return;

    queryClient.prefetchQuery({
      queryKey: supplierKeys.list(storeId, SUPPLIER_FILTERS),
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append("sortBy", SUPPLIER_FILTERS.sortBy);
        params.append("sortOrder", SUPPLIER_FILTERS.sortOrder);
        params.append("skip", String(SUPPLIER_FILTERS.skip));
        params.append("take", String(SUPPLIER_FILTERS.take));
        const response = await fetch(`/api/stores/${storeId}/suppliers?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to prefetch suppliers");
        return response.json();
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [storeId, queryClient]);

  /**
   * Type assertion needed because React Hook Form's zodResolver has type incompatibility
   * with complex nested schemas
   * Actual type: Resolver<CreateIngredientFormInput>
   * Known issue: https://github.com/react-hook-form/react-hook-form/issues/7764
   */
  const form = useForm<CreateIngredientFormInput>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: FORM_DEFAULTS.material as any,
  });

  /**
   * Type assertion needed because React Hook Form's useFieldArray has type limitations
   * with dynamic field arrays
   * Actual type: Control<CreateIngredientFormInput>
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

  /**
   * Type assertion needed because React Hook Form's useFieldArray has type limitations
   * The actual data structure is validated by Zod schema before reaching this function
   * Actual type: CreateIngredientFormInput
   * TODO: Improve type inference when React Hook Form fixes useFieldArray types
   */
  async function onSubmit(data: CreateIngredientFormInput) {
    try {
      // Filter out invalid suppliers (those with "none" or empty supplierId)
      /**
       * Type assertion needed because React Hook Form's useFieldArray has type limitations
       * Actual type: CreateIngredientFormInput["suppliers"][number]
       * TODO: Improve type inference when React Hook Form fixes useFieldArray types
       */
      const validSuppliers =
        data.suppliers?.filter((s) => s.supplierId && s.supplierId !== "none") || [];

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
            ? validSuppliers.map((s) => ({
                ...s,
                price: convertToBase(s.price ?? 0), // Convert supplier prices to EUR
              }))
            : undefined,
      };

      // Wait for mutation to complete before closing dialog
      // Material will appear in list immediately via optimistic update
      await createMaterial.mutateAsync(payload);

      toast.success(t("data.materials.toasts.added.title"), {
        description:
          t("data.materials.toasts.added.description")?.replace("{name}", data.name) || "",
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      // Handle validation errors
      toast.error(error instanceof Error ? error.message : t("messages.errorLoadingMaterials"));
      // Don't close dialog on error - let user see the error and potentially retry
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            className="gap-2"
            onMouseEnter={handlePrefetchSuppliers}
            onFocus={handlePrefetchSuppliers}
          >
            <Plus className="h-4 w-4" />
            {t("data.materials.addButton")}
          </Button>
        )}
      </DialogTrigger>
      <FormDialogLayout
        title={t("data.materials.addTitle")}
        description={t("data.materials.addDescription")}
        maxWidth="xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMaterial.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" form="add-material-form" disabled={createMaterial.isPending}>
              {createMaterial.isPending && (
                <Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" />
              )}
              {t("data.materials.addButton")}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="add-material-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
            {/* Basic Information */}
            <div className="space-y-1">
              <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                {t("data.materials.sections.basicInfo")}
              </h3>

              <div className="grid grid-cols-2 items-start gap-1.5">
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
