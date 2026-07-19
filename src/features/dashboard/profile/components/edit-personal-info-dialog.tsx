"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/constants/currencies";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/components/lang/i18n-provider";
import { updateProfileSchema } from "@/lib/validation/auth.schemas";
import { toast } from "sonner";
import { useUpdateProfile } from "../hooks/use-profile";

interface EditPersonalInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    locale: "en" | "fr" | "id" | undefined;
    timezone: string;
    currency: string;
    defaultLanding?: string;
  };
  onUpdate?: () => void;
}

type FormData = z.infer<typeof updateProfileSchema>;

const CURRENCY_OPTIONS: ComboboxOption[] = CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.name}`,
}));

const TIMEZONE_OPTIONS: ComboboxOption[] = Intl.supportedValuesOf("timeZone").map((tz) => ({
  value: tz,
  label: tz.replace(/_/g, " "),
}));

export function EditPersonalInfoDialog({
  open,
  onOpenChange,
  user,
  onUpdate,
}: EditPersonalInfoDialogProps) {
  const { t } = useI18n();
  const updateProfile = useUpdateProfile();

  const form = useForm<FormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name || "",
      phone: user.phone || "",
      locale: user.locale,
      timezone: user.timezone,
      currency: user.currency,
      defaultLanding: (user.defaultLanding ?? "dashboard") as
        | "dashboard"
        | "pos"
        | "storefront"
        | "data",
    },
  });

  // Reset form when user data changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: user.name || "",
        phone: user.phone || "",
        locale: user.locale,
        timezone: user.timezone,
        currency: user.currency,
        defaultLanding: (user.defaultLanding ?? "dashboard") as
          | "dashboard"
          | "pos"
          | "storefront"
          | "data",
      });
    }
  }, [open, user, form]);

  async function onSubmit(data: FormData) {
    try {
      await updateProfile.mutateAsync(data);

      // Note: Toast notification is now handled in useUpdateProfile hook
      // to prevent duplicate notifications
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("profile.errors.updateFailed"),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("profile.forms.editPersonalInfo")}
        description={t("profile.forms.editPersonalInfoDescription")}
        maxWidth="md"
        footer={
          <FormDialogFooter
            formId="edit-personal-info-form"
            onCancel={() => onOpenChange(false)}
            submitText={t("profile.actions.save")}
            isPending={updateProfile.isPending}
            variant="full-width"
          />
        }
      >
        <Form {...form}>
          <form
            id="edit-personal-info-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.personal.name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("profile.forms.namePlaceholder")}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>{t("profile.personal.email")}</FormLabel>
              <FormControl>
                <Input type="email" value={user.email} disabled className="bg-muted" />
              </FormControl>
              <FormDescription>{t("profile.forms.emailCannotBeChanged")}</FormDescription>
            </FormItem>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.personal.phone")}</FormLabel>
                  <FormControl>
                    <PhoneInput
                      placeholder={t("profile.forms.phonePlaceholder")}
                      value={field.value || ""}
                      onChange={field.onChange}
                      defaultCountry="ID"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 items-start gap-4">
              <FormField
                control={form.control}
                name="locale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.personal.language")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">{t("common.language.en")}</SelectItem>
                        <SelectItem value="fr">{t("common.language.fr")}</SelectItem>
                        <SelectItem value="id">{t("common.language.id")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.personal.currency")}</FormLabel>
                    <Combobox
                      options={CURRENCY_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      searchPlaceholder={t("profile.personal.currencySearchPlaceholder")}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.personal.timezone")}</FormLabel>
                  <Combobox
                    options={TIMEZONE_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    searchPlaceholder={t("profile.personal.timezoneSearchPlaceholder")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultLanding"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.personal.defaultLanding")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="dashboard">
                        {t("profile.personal.landingOptions.dashboard")}
                      </SelectItem>
                      <SelectItem value="pos">
                        {t("profile.personal.landingOptions.pos")}
                      </SelectItem>
                      <SelectItem value="storefront">
                        {t("profile.personal.landingOptions.storefront")}
                      </SelectItem>
                      <SelectItem value="data">
                        {t("profile.personal.landingOptions.data")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>{t("profile.personal.defaultLandingHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </FormDialogLayout>
    </Dialog>
  );
}
