"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";

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
  onUpdate: () => void;
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
  const { toast } = useToast();
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
      // TODO: Replace with actual API call using TanStack Query
      const response = await fetch("/api/user/business", {
        method: business ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          ...data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (result.error?.code === "VALIDATION_ERROR" && result.error?.details) {
          result.error.details.forEach((detail: { field: string; message: string }) => {
            form.setError(detail.field as keyof FormData, {
              type: "manual",
              message: detail.message,
            });
          });
          return;
        }

        throw new Error(result.error?.message || "Failed to update business information");
      }

      toast({
        title: business
          ? t("profile.toasts.businessUpdated.title")
          : t("profile.toasts.businessCreated.title"),
        description: business
          ? t("profile.toasts.businessUpdated.description")
          : t("profile.toasts.businessCreated.description"),
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating business:", error);
      toast({
        title: t("common.error"),
        description:
          error instanceof Error
            ? error.message
            : t("profile.errors.businessUpdateFailed"),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {business
              ? t("profile.forms.editBusinessInfo")
              : t("profile.business.addBusinessInfo")}
          </DialogTitle>
          <DialogDescription>
            {business
              ? t("profile.forms.editBusinessInfoDescription")
              : t("profile.forms.addBusinessInfoDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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

            <div className="grid gap-4 sm:grid-cols-2">
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
                      <Input
                        type="tel"
                        placeholder={t("profile.forms.phonePlaceholder")}
                        {...field}
                        value={field.value || ""}
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

            <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
                className="flex-1"
              >
                {t("profile.actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="flex-1"
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isCreating
                  ? t("profile.business.addBusinessInfo")
                  : t("profile.actions.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
