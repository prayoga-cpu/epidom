"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/components/lang/i18n-provider";
import { updateBusinessSchema } from "@/lib/validation/business.schemas";
import { toast } from "sonner";
import { useUpdateBusiness } from "../hooks/use-profile";

interface EditBusinessInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business?: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  userId: string;
  onUpdate?: () => void;
}

type FormData = z.infer<typeof updateBusinessSchema>;

export function EditBusinessInfoDialog({
  open,
  onOpenChange,
  business,
  userId,
  onUpdate,
}: EditBusinessInfoDialogProps) {
  const { t } = useI18n();
  const updateBusiness = useUpdateBusiness();
  const isCreating = !business;

  const form = useForm<FormData>({
    resolver: zodResolver(updateBusinessSchema),
    defaultValues: {
      name: business?.name || "",
      email: business?.email || "",
      phone: business?.phone || "",
      website: business?.website || "",
      address: business?.address || "",
      city: business?.city || "",
      country: business?.country || "",
    },
  });

  // Reset form when business data changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: business?.name || "",
        email: business?.email || "",
        phone: business?.phone || "",
        website: business?.website || "",
        address: business?.address || "",
        city: business?.city || "",
        country: business?.country || "",
      });
    }
  }, [open, business, form]);

  async function onSubmit(data: FormData) {
    try {
      await updateBusiness.mutateAsync(data);

      toast.success(
        business
          ? t("profile.toasts.businessUpdated.title")
          : t("profile.toasts.businessCreated.title"),
        {
          description: business
            ? t("profile.toasts.businessUpdated.description")
            : t("profile.toasts.businessCreated.description"),
        }
      );

      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(t("common.error"), {
        description:
          error instanceof Error ? error.message : t("profile.errors.businessUpdateFailed"),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={
          business ? t("profile.forms.editBusinessInfo") : t("profile.business.addBusinessInfo")
        }
        description={
          business
            ? t("profile.forms.editBusinessInfoDescription")
            : t("profile.forms.addBusinessInfoDescription")
        }
        maxWidth="2xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateBusiness.isPending}
              className="flex-1"
            >
              {t("profile.actions.cancel")}
            </Button>
            <Button type="submit" form="edit-business-info-form" disabled={updateBusiness.isPending} className="flex-1">
              {updateBusiness.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? t("profile.business.addBusinessInfo") : t("profile.actions.save")}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="edit-business-info-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("profile.business.name")} <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building2 className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                      <Input
                        placeholder={t("profile.forms.businessNamePlaceholder") || "Epidom Bakery"}
                        className="pl-9"
                        {...field}
                        value={field.value || ""}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.business.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("profile.forms.emailPlaceholder")}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.business.phone")}</FormLabel>
                    <FormControl>
                      <PhoneInput
                        placeholder={t("profile.forms.phonePlaceholder")}
                        value={field.value || ""}
                        onChange={field.onChange}
                        defaultCountry="FR"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.business.website")}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={t("profile.forms.websitePlaceholder")}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.business.address")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("profile.forms.addressPlaceholder")}
                      {...field}
                      value={field.value || ""}
                    />
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
                    <FormLabel>{t("profile.business.city")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("profile.forms.cityPlaceholder")}
                        {...field}
                        value={field.value || ""}
                      />
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
                    <FormLabel>{t("profile.business.country")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("profile.forms.countryPlaceholder")}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
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
