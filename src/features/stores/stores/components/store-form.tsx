"use client";

import { useEffect, useRef, useState } from "react";
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
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Store } from "../hooks/use-stores";
import { useI18n } from "@/components/lang/i18n-provider";
import { compressImage } from "@/lib/utils/image-compression";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | undefined>(
    defaultValues?.image || undefined
  );

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

  const formId =
    !showActions && !defaultValues
      ? "create-store-form"
      : !showActions
        ? "edit-store-form"
        : undefined;

  // Handle form submission with image upload
  const handleFormSubmit = async (data: CreateStoreInput) => {
    try {
      // If there's a pending image file, upload it first
      if (pendingImageFile) {
        setIsImageUploading(true);

        // Compress image
        const compressedFile = await compressImage(pendingImageFile);

        // Upload to server
        const formData = new FormData();
        formData.append("file", compressedFile);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Upload failed");
        }

        const uploadData = await response.json();

        // Update form data with uploaded URL
        data.image = uploadData.data.url;
        setIsImageUploading(false);
      }

      // Submit form with image URL
      onSubmit(data);
    } catch (error) {
      setIsImageUploading(false);
      toast.error("Failed to upload image", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-3 sm:space-y-4"
      >
        {/* Store Image - Optional with Manual Upload (Placed first for visual identity) */}
        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("stores.storeImage") || "Store Image"}</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  {imagePreviewUrl ? (
                    <div className="relative overflow-hidden rounded-lg border">
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="h-40 w-full object-cover sm:h-48"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1.5 right-1.5 h-7 w-7 sm:top-2 sm:right-2 sm:h-8 sm:w-8"
                        onClick={() => {
                          if (imagePreviewUrl.startsWith("blob:")) {
                            URL.revokeObjectURL(imagePreviewUrl);
                          }
                          setImagePreviewUrl(undefined);
                          setPendingImageFile(null);
                          field.onChange("");
                        }}
                        disabled={isLoading || isImageUploading}
                      >
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="hover:border-primary hover:bg-muted/50 bg-muted/30 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-primary/10 mb-3 rounded-full p-3">
                          <Upload className="text-primary h-6 w-6" />
                        </div>
                        <p className="text-foreground mb-1 text-sm font-medium">
                          Click to upload store image
                        </p>
                        <p className="text-muted-foreground text-xs">
                          JPEG, PNG, WebP, or GIF (max 5MB)
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Create preview
                        const preview = URL.createObjectURL(file);
                        setImagePreviewUrl(preview);
                        // Store file for upload on submit
                        setPendingImageFile(file);
                        // Clear the form field value (will be set after upload)
                        field.onChange("");
                      }
                      // Reset input
                      e.target.value = "";
                    }}
                    disabled={isLoading || isImageUploading}
                    className="hidden"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                <PhoneInput
                  placeholder={t("stores.phonePlaceholder") || "e.g., +33 1 23 45 67 89"}
                  value={field.value || ""}
                  onChange={field.onChange}
                  defaultCountry="FR"
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

        {/* Form Actions - Only show if showActions is true */}
        {showActions && (
          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading || isImageUploading}
              >
                {t("actions.cancel")}
              </Button>
            )}
            <Button type="submit" disabled={isLoading || isImageUploading}>
              {isImageUploading
                ? "Uploading image..."
                : isLoading
                  ? t("actions.saving") || "Saving..."
                  : submitText}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
