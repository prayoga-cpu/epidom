"use client";

import { useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { useI18n } from "@/components/lang/i18n-provider";

interface UseDialogFormOptions<T extends z.ZodTypeAny> {
  schema: T;
  defaultValues?: Partial<z.infer<T>> | Readonly<Partial<z.infer<T>>>;
  onSubmit: (data: z.infer<T>) => Promise<void>;
  onSuccess?: () => void;
  successMessage?: string;
  successDescription?: string | ((data: z.infer<T>) => string);
  errorMessage?: string;
}

interface UseDialogFormReturn<T extends z.ZodTypeAny> {
  form: UseFormReturn<z.infer<T>>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  reset: () => void;
}

/**
 * useDialogForm Hook
 *
 * Standardized form handling for dialog forms.
 * Provides consistent error handling, loading states, and toast notifications.
 * Follows DRY principle by centralizing form submission patterns.
 *
 * @example
 * const { form, handleSubmit, isSubmitting } = useDialogForm({
 *   schema: materialSchema,
 *   defaultValues: FORM_DEFAULTS.material,
 *   onSubmit: async (data) => {
 *     await createMaterial.mutateAsync(data);
 *   },
 *   onSuccess: () => {
 *     setOpen(false);
 *   },
 * });
 */
export function useDialogForm<T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  onSubmit,
  onSuccess,
  successMessage,
  successDescription,
  errorMessage,
}: UseDialogFormOptions<T>): UseDialogFormReturn<T> {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: defaultValues ? ({ ...defaultValues } as any) : undefined,
  });

  const handleSubmit = async (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();

    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const data = form.getValues();
      await onSubmit(data);

      const description = typeof successDescription === "function"
        ? successDescription(data)
        : successDescription;

      toast.success(
        successMessage || t("common.success") || "Success",
        description ? { description } : undefined
      );

      form.reset();
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : errorMessage || t("common.error") || "An error occurred";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    handleSubmit,
    isSubmitting,
    reset: () => form.reset(),
  };
}

