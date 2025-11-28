"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUpdateSupplier } from "../hooks/use-suppliers";
import { FORM_DEFAULTS } from "@/lib/config/form-defaults";

// Zod validation schema
// Helper function to create supplier schema with translated messages
function createSupplierSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("common.validation.supplierNameMin")),
    contactPerson: z.string().optional().or(z.literal("")),
    email: z.string().email(t("common.validation.email")).optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
  });
}

type SupplierFormValues = z.infer<ReturnType<typeof createSupplierSchema>>;

interface EditSupplierDialogProps {
  supplier: SupplierWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSupplierDialog({ supplier, open, onOpenChange }: EditSupplierDialogProps) {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;

  const updateSupplier = useUpdateSupplier(storeId, supplier?.id || "");

  const supplierSchema = createSupplierSchema(t);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: FORM_DEFAULTS.supplier,
  });

  // Update form when supplier changes
  useEffect(() => {
    if (supplier && open) {
      form.reset({
        name: supplier.name || "",
        contactPerson: supplier.contactPerson || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        city: supplier.city || "",
        country: supplier.country || "",
        notes: supplier.notes || "",
      });
    }
  }, [supplier, open, form]);

  const onSubmit = async (data: SupplierFormValues) => {
    try {
      await updateSupplier.mutateAsync(data);

      toast.success(`${data.name} has been updated successfully.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update supplier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("data.suppliers.editTitle") || "Edit Supplier"}
        description="Update supplier information. Changes will be saved to your contacts."
        maxWidth="2xl"
        footer={
          <FormDialogFooter
            formId="edit-supplier-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("data.suppliers.update") || "Update Supplier"}
            isPending={updateSupplier.isPending}
          />
        }
      >
        <Form {...form}>
          <form
            id="edit-supplier-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-1"
          >
            {/* Basic Information */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t("data.suppliers.sections.basicInfo")}</h3>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.suppliers.form.name")} *</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid items-start gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.suppliers.form.contactPerson")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("data.suppliers.form.contactPersonPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("data.suppliers.form.contactPersonHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.suppliers.form.email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("data.suppliers.form.emailPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t("data.suppliers.form.emailHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.suppliers.form.phone")}</FormLabel>
                    <FormControl>
                      <PhoneInput
                        placeholder={t("data.suppliers.form.phonePlaceholder")}
                        value={field.value || ""}
                        onChange={field.onChange}
                        defaultCountry="FR"
                      />
                    </FormControl>
                    <FormDescription>{t("data.suppliers.form.phoneHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t("data.suppliers.sections.address")}</h3>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.suppliers.form.address")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.addressPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid items-start gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.suppliers.form.city")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("data.suppliers.form.cityPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("data.suppliers.form.country")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("data.suppliers.form.countryPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("data.suppliers.form.notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.suppliers.form.notesPlaceholder")}
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{t("data.suppliers.form.notesHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
