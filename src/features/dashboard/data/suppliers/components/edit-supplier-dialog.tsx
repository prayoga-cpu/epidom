"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { SupplierWithRelations } from "@/lib/repositories/supplier.repository";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUpdateSupplier } from "../hooks/use-suppliers";

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

export default function EditSupplierDialog({
  supplier,
  open,
  onOpenChange,
}: EditSupplierDialogProps) {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;

  const updateSupplier = useUpdateSupplier(storeId, supplier?.id || "");

  const supplierSchema = createSupplierSchema(t);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      notes: "",
    },
  });

  // Update form when supplier changes
  useEffect(() => {
    if (supplier) {
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
  }, [supplier, form]);

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
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-xl font-bold sm:text-2xl">
            {t("data.suppliers.editTitle") || "Edit Supplier"}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Update supplier information. Changes will be saved to your contacts.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form id="edit-supplier-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name *</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("data.suppliers.form.contactPersonPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Primary contact name</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("data.suppliers.form.emailPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Business email</FormDescription>
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.phonePlaceholder")} {...field} />
                    </FormControl>
                    <FormDescription>Business phone number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Address</h3>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder={t("data.suppliers.form.addressPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
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
                      <FormLabel>Country</FormLabel>
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
              <h3 className="text-sm font-semibold">Additional Notes</h3>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("data.suppliers.form.notesPlaceholder")}
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Special requirements, preferences, or important details
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </form>
          </Form>
        </div>

        {/* Fixed Footer with Actions */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateSupplier.isPending}
            >
              {t("actions.cancel") || "Cancel"}
            </Button>
            <Button
              type="submit"
              form="edit-supplier-form"
              disabled={updateSupplier.isPending}
            >
              {updateSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("data.suppliers.update") || "Update Supplier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
