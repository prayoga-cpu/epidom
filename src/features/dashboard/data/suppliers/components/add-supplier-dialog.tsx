"use client";

import { useState } from "react";
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
  DialogTrigger,
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
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCreateSupplier } from "../hooks/use-suppliers";

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

interface AddSupplierDialogProps {
  children?: React.ReactNode;
}

export default function AddSupplierDialog({ children }: AddSupplierDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;

  const createSupplier = useCreateSupplier(storeId);

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

  async function onSubmit(data: SupplierFormValues) {
    try {
      const payload = {
        ...data,
        storeId,
        isActive: true,
      };

      await createSupplier.mutateAsync(payload);

      toast.success(t("data.suppliers.toasts.added.title"), {
        description: t("data.suppliers.toasts.added.description")?.replace("{name}", data.name) || "",
      });

      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("data.suppliers.addButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl [&>button]:hidden">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-xl font-bold sm:text-2xl">
            {t("data.suppliers.addTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {t("data.suppliers.addDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form id="add-supplier-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
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

              <div className="grid gap-4 sm:grid-cols-2">
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
                      <FormDescription>{t("data.suppliers.form.contactPersonHint")}</FormDescription>
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

              <div className="grid gap-4 sm:grid-cols-2">
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
              <h3 className="text-sm font-semibold">{t("data.suppliers.sections.additionalNotes")}</h3>
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
                    <FormDescription>
                      {t("data.suppliers.form.notesHint")}
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
              onClick={() => setOpen(false)}
              disabled={createSupplier.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="add-supplier-form"
              disabled={createSupplier.isPending}
            >
              {createSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("data.suppliers.addButton")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
