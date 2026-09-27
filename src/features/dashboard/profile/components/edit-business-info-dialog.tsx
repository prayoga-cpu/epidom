"use client";

import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { updateBusinessSchema, type UpdateBusinessInput } from "@/lib/validation/business.schemas";
import { OTHER_COUNTRY_CODE, countryCodeFromName, getCountry } from "@/lib/onboarding/markets";
import { CountrySelect, getBrowserTimezone } from "@/features/stores/shared";
import { toast } from "sonner";
import { useUpdateBusiness } from "../hooks/use-profile";
import { businessTimezoneKeys } from "../hooks/use-business-timezone";
import { BusinessTimezoneSelect } from "./business-timezone-select";

export interface EditBusinessInfoDialogBusiness {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  /** IANA zone (Business.timezone); undefined while it isn't known yet. */
  timezone?: string | null;
}

interface EditBusinessInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  business?: EditBusinessInfoDialogBusiness | null;
  userId: string;
  onUpdate?: () => void;
}

/**
 * The business fields plus `countryCode`, the country picker's value (UI
 * only): Business.country stays a free-text column holding the country's
 * English name, or the owner's text for "Other country".
 */
const businessFormSchema = updateBusinessSchema.extend({
  countryCode: z.string().optional(),
});

type FormData = z.infer<typeof businessFormSchema>;

/** What the form starts from, and what "changed" is measured against. */
export function businessFormDefaults(
  business: EditBusinessInfoDialogBusiness | null | undefined
): FormData {
  // A country the list recognises pre-fills the picker; any other saved text
  // is kept as it is (shown as the current value) until a country is picked.
  const code = countryCodeFromName(business?.country);
  return {
    name: business?.name || "",
    email: business?.email || "",
    phone: business?.phone || "",
    website: business?.website || "",
    address: business?.address || "",
    city: business?.city || "",
    countryCode: code ?? "",
    country: code ? "" : business?.country || "",
    // A new business starts on the browser's zone rather than the column default.
    timezone: business ? business.timezone || undefined : getBrowserTimezone(),
  };
}

/**
 * PATCH /api/user/business body. The country is only sent when the owner
 * picked a different one (as its English name, or their text for "Other
 * country"), so a legacy value is never overwritten silently. The timezone is
 * sent when it changed, or always for a new business.
 */
export function buildBusinessPayload(
  values: FormData,
  initial: FormData,
  isCreating: boolean
): UpdateBusinessInput {
  const { countryCode, country, timezone, ...rest } = values;
  const payload: UpdateBusinessInput = { ...rest };
  const code = countryCode ?? "";
  const text = country?.trim() ?? "";
  const countryChanged =
    code !== (initial.countryCode ?? "") ||
    (code === OTHER_COUNTRY_CODE && text !== (initial.country ?? "").trim());
  if (code && countryChanged) {
    payload.country = code === OTHER_COUNTRY_CODE ? text : (getCountry(code)?.name ?? text);
  }
  if (timezone && (isCreating || timezone !== initial.timezone)) {
    payload.timezone = timezone;
  }
  return payload;
}

export function EditBusinessInfoDialog({
  open,
  onOpenChange,
  business,
  userId,
  onUpdate,
}: EditBusinessInfoDialogProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const updateBusiness = useUpdateBusiness();
  const isCreating = !business;

  const form = useForm<FormData>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: businessFormDefaults(business),
  });
  // The values the dialog opened with, to tell what the owner changed.
  const initialRef = useRef<FormData>(businessFormDefaults(business));

  // Reset the form each time the dialog opens (not on every refetch while it
  // is open, which would wipe what the owner is typing).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const defaults = businessFormDefaults(business);
      initialRef.current = defaults;
      form.reset(defaults);
    }
    wasOpenRef.current = open;
  }, [open, business, form]);

  // The timezone may arrive after the dialog opened (it is fetched on its
  // own); fill it in unless the owner already picked one.
  const knownTimezone = business?.timezone;
  useEffect(() => {
    if (!open || !knownTimezone) return;
    if (form.getFieldState("timezone").isDirty) return;
    initialRef.current = { ...initialRef.current, timezone: knownTimezone };
    if (form.getValues("timezone") !== knownTimezone) {
      form.setValue("timezone", knownTimezone, { shouldDirty: false });
    }
  }, [open, knownTimezone, form]);

  const countryCode = useWatch({ control: form.control, name: "countryCode" });
  const isOtherCountry = countryCode === OTHER_COUNTRY_CODE;
  const legacyCountry =
    !initialRef.current.countryCode && initialRef.current.country
      ? initialRef.current.country
      : null;
  const suggestedTimezones = getCountry(countryCode)?.timezones ?? [];

  async function onSubmit(data: FormData) {
    try {
      await updateBusiness.mutateAsync(buildBusinessPayload(data, initialRef.current, isCreating));
      await queryClient.invalidateQueries({ queryKey: businessTimezoneKeys.all });

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
          <FormDialogFooter
            formId="edit-business-info-form"
            onCancel={() => onOpenChange(false)}
            submitText={
              isCreating ? t("profile.business.addBusinessInfo") : t("profile.actions.save")
            }
            isPending={updateBusiness.isPending}
            variant="full-width"
          />
        }
      >
        <Form {...form}>
          <form
            id="edit-business-info-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
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
                  <FormItem className="min-w-0">
                    <FormLabel>{t("profile.business.city")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("profile.forms.cityPlaceholder")}
                        {...field}
                        value={field.value || ""}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>{t("profile.business.country")}</FormLabel>
                    <FormControl>
                      <CountrySelect
                        ref={field.ref}
                        name={field.name}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                        // The saved free text stands in for the empty picker.
                        placeholder={legacyCountry ?? undefined}
                      />
                    </FormControl>
                    {legacyCountry && !field.value ? (
                      <FormDescription className="text-xs">
                        {t("profile.business.countryLegacy").replace("{country}", legacyCountry)}
                      </FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isOtherCountry ? (
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>{t("profile.business.otherCountryName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("profile.business.otherCountryNamePlaceholder")}
                        autoComplete="country-name"
                        maxLength={100}
                        {...field}
                        value={field.value || ""}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>{t("profile.business.timezone")}</FormLabel>
                  <FormControl>
                    <BusinessTimezoneSelect
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      suggested={suggestedTimezones}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {t("profile.business.timezoneHint")}
                  </FormDescription>
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
