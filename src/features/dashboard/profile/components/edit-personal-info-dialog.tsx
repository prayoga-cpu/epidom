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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  };
  onUpdate?: () => void;
}

type FormData = z.infer<typeof updateProfileSchema>;

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
          <form id="edit-personal-info-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="grid items-start grid-cols-2 gap-4">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="IDR">IDR (Rp) — Indonesia</SelectItem>
                        <SelectItem value="USD">USD ($) — US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR (€) — Euro</SelectItem>
                        <SelectItem value="MGA">MGA (Ar) — Ariary Madagascar</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      <SelectItem value="America/New_York">America/New York</SelectItem>
                      <SelectItem value="Asia/Jakarta">Asia/Jakarta</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
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
