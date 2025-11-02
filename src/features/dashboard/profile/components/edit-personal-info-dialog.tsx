"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useToast } from "@/hooks/use-toast";

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
  onUpdate: () => void;
}

type FormData = z.infer<typeof updateProfileSchema>;

export function EditPersonalInfoDialog({
  open,
  onOpenChange,
  user,
  onUpdate,
}: EditPersonalInfoDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name || "",
      phone: user.phone || "",
      locale: user.locale,
      timezone: user.timezone,
      currency: user.currency,
      image: "",
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
        image: "",
      });
    }
  }, [open, user, form]);

  async function onSubmit(data: FormData) {
    try {
      // TODO: Replace with actual API call using TanStack Query
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

        throw new Error(result.error?.message || "Failed to update profile");
      }

      toast({
        title: t("profile.toasts.profileUpdated.title"),
        description: t("profile.toasts.profileUpdated.description"),
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: t("common.error"),
        description:
          error instanceof Error ? error.message : t("profile.errors.updateFailed"),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profile.forms.editPersonalInfo")}</DialogTitle>
          <DialogDescription>{t("profile.forms.editPersonalInfoDescription")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="IDR">IDR (Rp)</SelectItem>
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
              <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("profile.actions.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
