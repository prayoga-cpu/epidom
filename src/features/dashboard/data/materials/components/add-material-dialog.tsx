"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

  const form = useForm({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      category: "",
      unit: "kg",
      unitCost: 0,
      currentStock: 0,
      minStock: 0,
      maxStock: 1000,
      suppliers: [],
      isActive: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    name: "suppliers" as any,
  });

  async function onSubmit(data: any) {
    try {
      // Filter out invalid suppliers (those with "none" or empty supplierId)
      const validSuppliers =
        data.suppliers?.filter((s: any) => s.supplierId && s.supplierId !== "none") || [];

      // Ensure we have default values for required fields
      const payload = {
        ...data,
        unit: data.unit || "kg",
        unitCost: convertToBase(data.unitCost), // Convert from user's currency to EUR
        currentStock: data.currentStock || 0,
        minStock: data.minStock || 0,
        maxStock: data.maxStock || 1000,
        isActive: data.isActive ?? true,
        suppliers:
          validSuppliers.length > 0
            ? validSuppliers.map((s: any) => ({
                ...s,
                price: convertToBase(s.price), // Convert supplier prices to EUR
              }))
            : undefined,
      };

      await createMaterial.mutateAsync(payload);

      toast.success(`${data.name} has been added to your inventory.`);

      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messages.errorLoadingMaterials"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("data.materials.addButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("data.materials.addTitle")}</DialogTitle>
          <DialogDescription>
            {t("data.materials.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Basic Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Flour, Sugar, Butter" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., FLR-T55-25KG" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Grains, Dairy" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("data.materials.form.selectUnit")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="kg">Kilograms (kg)</SelectItem>
                          <SelectItem value="g">Grams (g)</SelectItem>
                          <SelectItem value="l">Liters (L)</SelectItem>
                          <SelectItem value="ml">Milliliters (mL)</SelectItem>
                          <SelectItem value="pcs">Pieces</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
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
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional information about this material..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Pricing & Stock */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Pricing & Stock</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="25.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                    <FormItem>
                      <FormLabel>Current Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="100"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Stock Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="20"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Alert when stock falls below this level</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Stock Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="500"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Alert when stock exceeds this level</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Suppliers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Suppliers (Optional)</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ supplierId: "", price: 0, isPreferred: false })}
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
                <div key={field.id} className="flex gap-4 rounded-lg border p-4">
                  <div className="flex-1 space-y-4">
                    <FormField
                      control={form.control}
                      name={`suppliers.${index}.supplierId` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={(field.value as string) || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a supplier..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none" disabled>
                                Select a supplier...
                              </SelectItem>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Choose a supplier for this material
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`suppliers.${index}.price` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price ({currency === "EUR" ? "€" : "$"}) *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="25.00"
                                {...field}
                                value={field.value as number}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                                Preferred
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMaterial.isPending}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={createMaterial.isPending}>
                {createMaterial.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("data.materials.addButton")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
