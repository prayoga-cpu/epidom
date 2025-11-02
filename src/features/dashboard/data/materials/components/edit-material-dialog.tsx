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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { MOCK_SUPPLIERS } from "@/mocks";
import { Material, MaterialCategory } from "@/types/entities";
import { useI18n } from "@/components/lang/i18n-provider";

// Zod validation schema (same as add-material-dialog)
const materialSchema = z.object({
  name: z.string().min(2, "Material name must be at least 2 characters"),
  sku: z.string().optional(),
  category: z.nativeEnum(MaterialCategory, { required_error: "Please select a category" }),
  description: z.string().optional(),
  supplierId: z.string({ required_error: "Please select a supplier" }),
  unit: z.string().min(1, "Please select a unit"),
  costPerUnit: z.coerce.number().positive("Cost must be greater than 0"),
  currentStock: z.coerce.number().min(0, "Stock cannot be negative"),
  minStock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  maxStock: z.coerce.number().positive("Maximum stock must be greater than 0"),
  location: z.string().optional(),
  barcode: z.string().optional(),
});

type MaterialFormValues = z.infer<typeof materialSchema>;

interface EditMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  onSave?: (materialId: string, data: MaterialFormValues) => void;
}

export default function EditMaterialDialog({
  open,
  onOpenChange,
  material,
  onSave,
}: EditMaterialDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      sku: "",
      category: undefined,
      description: "",
      supplierId: "",
      unit: "",
      costPerUnit: 0,
      currentStock: 0,
      minStock: 0,
      maxStock: 0,
      location: "",
      barcode: "",
    },
  });

  // Update form values when material changes
  useEffect(() => {
    if (material) {
      form.reset({
        name: material.name,
        sku: material.sku || "",
        category: material.category,
        description: material.description || "",
        supplierId: material.supplierId,
        unit: material.unit,
        costPerUnit: material.costPerUnit,
        currentStock: material.currentStock,
        minStock: material.minStock,
        maxStock: material.maxStock,
        location: material.location || "",
        barcode: material.barcode || "",
      });
    }
  }, [material, form]);

  const onSubmit = async (data: MaterialFormValues) => {
    if (!material) return;

    setIsSubmitting(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // TODO: Replace with actual API call
    // const response = await fetch(`/api/materials/${material.id}`, {
    //   method: "PATCH",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(data),
    // });

    console.log("Material update data:", { id: material.id, ...data });

    setIsSubmitting(false);

    if (onSave) {
      onSave(material.id, data);
    }

    const updatedDesc = t("data.materials.toasts.updated.description") || "{name} has been updated successfully.";
    toast({
      title: t("data.materials.toasts.updated.title"),
      description: updatedDesc.replace(
        "{name}",
        data.name
      ),
    });

    onOpenChange(false);
  };

  if (!material) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("data.materials.editTitle") || "Edit Material"}</DialogTitle>
          <DialogDescription>
            {t("data.materials.editDescription") ||
              "Update material information. All fields marked with * are required."}
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
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.products.form.skuPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category & Supplier */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("data.materials.form.selectCategory")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={MaterialCategory.RAW_MATERIALS}>
                          Raw Materials
                        </SelectItem>
                        <SelectItem value={MaterialCategory.PACKAGING}>Packaging</SelectItem>
                        <SelectItem value={MaterialCategory.DAIRY}>Dairy Products</SelectItem>
                        <SelectItem value={MaterialCategory.GRAINS}>Grains & Flour</SelectItem>
                        <SelectItem value={MaterialCategory.SPICES}>Spices & Seasonings</SelectItem>
                        <SelectItem value={MaterialCategory.OTHER}>Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("data.materials.form.selectSupplier")} />
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
            </div>

            {/* Stock Levels */}
            <div className="grid gap-4 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="currentStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="100" {...field} />
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
                      <Input type="number" step="0.01" placeholder="20" {...field} />
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
                      <Input type="number" step="0.01" placeholder="500" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                        <SelectItem value="units">Units/Pieces</SelectItem>
                        <SelectItem value="box">Box</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cost & Location */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="costPerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Unit ($) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="1.20" {...field} />
                    </FormControl>
                    <FormDescription>Enter the cost in your local currency</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Location</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.materials.form.locationPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Barcode */}
            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Barcode/Product Code</FormLabel>
                  <FormControl>
                    <Input placeholder={t("data.materials.form.barcodePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("data.materials.form.notesPlaceholder")}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
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
                {t("actions.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? t("common.actions.saving") || "Saving..."
                  : t("common.actions.saveChanges") || "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
