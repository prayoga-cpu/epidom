"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStoreSchema, CreateStoreInput } from "@/lib/validation/business.schemas";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/shared/image-upload";
import { Store } from "../hooks/use-stores";
import { useI18n } from "@/components/lang/i18n-provider";

interface StoreFormProps {
  /**
   * Default values for edit mode
   */
  defaultValues?: Partial<Store>;
  /**
   * Submit handler
   */
  onSubmit: (data: CreateStoreInput) => void;
  /**
   * Loading state (e.g., during API call)
   */
  isLoading?: boolean;
  /**
   * Submit button text
   */
  submitText?: string;
  /**
   * Cancel handler
   */
  onCancel?: () => void;
  /**
   * Whether to show action buttons (if false, buttons are handled externally)
   */
  showActions?: boolean;
}

/**
 * Shared form component for creating and editing stores
 * Following DRY principle - used by both CreateStoreDialog and EditStoreDialog
 */
export function StoreForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  submitText = "Save",
  onCancel,
  showActions = true,
}: StoreFormProps) {
  const { t } = useI18n();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateStoreInput>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      address: defaultValues?.address || "",
      city: defaultValues?.city || "",
      country: defaultValues?.country || "",
      phone: defaultValues?.phone || "",
      email: defaultValues?.email || "",
      image: defaultValues?.image || "",
    },
  });

  // Auto-focus first field when form mounts (for create mode)
  useEffect(() => {
    if (!defaultValues && firstInputRef.current) {
      const timer = setTimeout(() => firstInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [defaultValues]);

  const formId = !showActions && !defaultValues ? "create-store-form" : !showActions ? "edit-store-form" : undefined;

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* Store Name - Required */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("stores.storeName")} <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  ref={firstInputRef}
                  placeholder={t("stores.storeNamePlaceholder") || "e.g., Artisan Bakery Paris"}
                  disabled={isLoading}
                  autoFocus={!defaultValues}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Address - Optional */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.address") || "Address"}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ""}
                  placeholder={t("stores.addressPlaceholder") || "e.g., 123 Rue de la Paix"}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* City - Optional */}
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("stores.city")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ""}
                  placeholder={t("stores.cityPlaceholder") || "e.g., Paris"}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Country - Optional */}
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("stores.country") || "Country"}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ""}
                  placeholder={t("stores.countryPlaceholder") || "e.g., France"}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Phone - Optional */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.phone")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ""}
                  type="tel"
                  placeholder={t("stores.phonePlaceholder") || "e.g., +33 1 23 45 67 89"}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email - Optional */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.email")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ""}
                  type="email"
                  placeholder={t("stores.emailPlaceholder") || "e.g., contact@store.com"}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Store Image - Optional with Upload */}
        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("stores.storeImage") || "Store Image"}</FormLabel>
              <FormControl>
                <ImageUpload
                  value={field.value || undefined}
                  onChange={(url) => field.onChange(url || "")}
                  disabled={isLoading}
                  maxSize={5}
                  aspectRatio="16/9"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form Actions - Only show if showActions is true */}
        {showActions && (
          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                {t("actions.cancel")}
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("actions.saving") || "Saving..." : submitText}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
