"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
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
import { Plus, Loader2, X, Star, Trash2, RefreshCw, Check } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCreateMaterial, useMaterials } from "../hooks/use-materials";
import { useSuppliers, supplierKeys } from "../../suppliers/hooks/use-suppliers";
import { useParams } from "next/navigation";
import {
  createIngredientFormSchema,
  CreateIngredientFormInput,
} from "@/lib/validation/inventory.schemas";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrency } from "@/components/providers/currency-provider";
import { DecimalInput } from "@/components/shared/decimal-input";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { FORM_DEFAULTS } from "@/lib/config/form-defaults";
import { generateSku } from "@/lib/utils/sku-generator";
import { useSkuAvailability } from "@/hooks/use-sku-availability";

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
  const isSubmittingRef = useRef(false);
  const { t } = useI18n();
  const { currency, convertToBase } = useCurrency();
  const params = useParams();
  const storeId = params.storeId as string;
  const queryClient = useQueryClient();

  const createMaterial = useCreateMaterial(storeId);

  // Fetch suppliers for dropdown - only when dialog is open (performance optimization)
  // Increased staleTime to reduce unnecessary refetches
  const { data: suppliersData } = useSuppliers(storeId, SUPPLIER_FILTERS, {
    enabled: open, // Only fetch when dialog is open
    staleTime: 10 * 60 * 1000, // 10 minutes - suppliers don't change often
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
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
      staleTime: 10 * 60 * 1000, // 10 minutes - suppliers don't change often
      gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
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

  // Track if dialog is closing due to submission to prevent form reset

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

  // Auto-generate a SKU from name/category until the user edits it themselves
  const skuTouchedRef = useRef(false);
  const nameValue = form.watch("name");
  const categoryValue = form.watch("category");
  const skuValue = form.watch("sku") || "";

  useEffect(() => {
    if (skuTouchedRef.current) return;
    if (!nameValue) return;
    form.setValue("sku", generateSku(nameValue, categoryValue), { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, categoryValue]);

  const handleRegenerateSku = () => {
    skuTouchedRef.current = false;
    if (nameValue) {
      form.setValue("sku", generateSku(nameValue, categoryValue), { shouldValidate: true });
    }
  };

  const { status: skuStatus } = useSkuAvailability(
    `/api/stores/${storeId}/materials/check-sku`,
    skuValue
  );

  /**
   * Type assertion needed because React Hook Form's useFieldArray has type limitations
   * The actual data structure is validated by Zod schema before reaching this function
   * Actual type: CreateIngredientFormInput
   * TODO: Improve type inference when React Hook Form fixes useFieldArray types
   */
  async function onSubmit(data: CreateIngredientFormInput) {
    try {
      // Filter out invalid suppliers (those with "none" or empty supplierId)
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

        suppliers:
          validSuppliers.length > 0
            ? validSuppliers.map((s) => ({
                ...s,
                price: convertToBase(s.price ?? 0), // Convert supplier prices to EUR
              }))
            : undefined,
      };

      // OPTIMISTIC CLOSING
      isSubmittingRef.current = true;
      setOpen(false);

      // Use toast.promise to handle the async operation with immediate feedback
      // This solves the issue where production build takes ~15s to complete the request
      const promise = createMaterial.mutateAsync(payload);

      toast.promise(promise, {
        loading: (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("data.materials.toasts.adding") || "Adding material..."}</span>
          </div>
        ),
        success: (data) => {
          // Success! Reset everything
          isSubmittingRef.current = false;
          form.reset();
          return (
            t("data.materials.toasts.added.description")?.replace("{name}", data.name) ||
            "Material added successfully"
          );
        },
        error: (err) => {
          // Error! Re-open dialog
          isSubmittingRef.current = false;
          setOpen(true);
          return err instanceof Error ? err.message : t("messages.errorLoadingMaterials");
        },
      });

      // Await to ensure we catch any synchronous errors, though toast handles most
      await promise;
    } catch (error) {
      // Handled by toast.error / promise error
      console.error(error);
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Only reset form if closing AND NOT submitting (i.e. cancelled by user)
    // Also reset if opening (fresh start)
    if (!newOpen && !isSubmittingRef.current) {
      form.reset();
    }
    if (newOpen) {
      isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder={t("data.materials.form.skuPlaceholder")}
                            {...field}
                            onChange={(e) => {
                              skuTouchedRef.current = true;
                              field.onChange(e);
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={handleRegenerateSku}
                            title={t("data.materials.form.regenerateSku")}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                        {t("data.materials.form.unitCost")} ({getCurrencySymbol(currency)}) *
                      </FormLabel>
                      <FormControl>
                        <DecimalInput
                          decimals={2}
                          min={0}
                          placeholder={t("data.materials.form.costPlaceholder")}
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
                      isPreferred: false,
                    })
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
                        isPreferred: false,
                      })
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

                        <div className="flex items-start gap-4">
                          <FormField
                            control={form.control}
                            name={`suppliers.${index}.price` as any}
                            render={({ field }) => (
                              <FormItem className="flex-1 space-y-1">
                                <FormLabel className="text-xs font-medium">
                                  {t("data.materials.form.supplierPrice")} (
                                  {getCurrencySymbol(currency)})
                                </FormLabel>
                                <FormControl>
                                  <DecimalInput
                                    decimals={2}
                                    min={0}
                                    placeholder="25.00"
                                    className="h-9"
                                    value={field.value as number | undefined}
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
                            name={`suppliers.${index}.isPreferred` as any}
                            render={({ field }) => (
                              <FormItem className="flex flex-col items-start gap-1 pt-6">
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
