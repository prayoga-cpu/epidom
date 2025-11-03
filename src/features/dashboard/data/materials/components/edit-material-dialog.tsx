"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Star } from "lucide-react";
import { Material } from "@/types/entities";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUpdateMaterial } from "../hooks/use-materials";
import {
  updateIngredientFormSchema,
  type UpdateIngredientFormInput,
} from "@/lib/validation/inventory.schemas";

interface EditMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
}

export default function EditMaterialDialog({
  open,
  onOpenChange,
  material,
}: EditMaterialDialogProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;
  const materialId = material?.id || "";

  const updateMaterial = useUpdateMaterial(storeId, materialId);

  const form = useForm<UpdateIngredientFormInput>({
    resolver: zodResolver(updateIngredientFormSchema) as any,
    defaultValues: {
      name: "",
      sku: "",
      category: "",
      description: "",
      unit: "",
      unitCost: 0,
      currentStock: 0,
      minStock: 0,
      maxStock: 0,
      suppliers: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control as any,
    name: "suppliers" as any,
  });

  // Update form values when material changes
  useEffect(() => {
    if (material) {
      form.reset({
        name: material.name,
        sku: material.sku || "",
        category: material.category || "",
        description: material.description || "",
        unit: material.unit,
        unitCost: Number(material.unitCost),
        currentStock: Number(material.currentStock),
        minStock: Number(material.minStock),
        maxStock: Number(material.maxStock),
        suppliers:
          material.ingredientSuppliers?.map((s) => ({
            supplierId: s.supplierId,
            price: Number(s.price),
            isPreferred: s.isPreferred,
          })) || [],
      });
    }
  }, [material, form]);

  const onSubmit = async (data: UpdateIngredientFormInput) => {
    if (!material) return;

    try {
      await updateMaterial.mutateAsync(data);
      toast({
        title: t("data.materials.toasts.updated.title") || "Success",
        description:
          t("data.materials.toasts.updated.description")?.replace(
            "{name}",
            data.name || material.name
          ) || "Material updated successfully",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t("common.error") || "Error",
        description: error instanceof Error ? error.message : "Failed to update material",
        variant: "destructive",
      });
    }
  };

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("data.materials.editTitle") || "Edit Material"}</DialogTitle>
          <DialogDescription>
            {t("data.materials.editDescription") ||
              "Update material information. Fields marked with * are required."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Material Name & SKU */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Flour, Sugar" {...field} />
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
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. MAT-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Dairy, Flour, Packaging" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unit & Unit Cost */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="g">Grams (g)</SelectItem>
                        <SelectItem value="l">Liters (L)</SelectItem>
                        <SelectItem value="ml">Milliliters (mL)</SelectItem>
                        <SelectItem value="piece">Pieces</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost ($) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Stock Levels */}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="currentStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
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
                name="minStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. Stock *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
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
                name="maxStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. Stock *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1000"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
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
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this material..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  Add Supplier
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No suppliers added yet. Click "Add Supplier" to link suppliers to this material.
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
                          <FormLabel>Supplier ID *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Supplier ID or name"
                              {...field}
                              value={field.value as string}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Enter supplier ID (future: dropdown selector)
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
                            <FormLabel>Price ($) *</FormLabel>
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

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMaterial.isPending}
              >
                {t("actions.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={updateMaterial.isPending}>
                {updateMaterial.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {updateMaterial.isPending
                  ? t("common.actions.saving") || "Saving..."
                  : t("common.actions.saveChanges") || "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
