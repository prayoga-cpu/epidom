"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

interface FormDialogFooterProps {
  formId: string;
  onCancel: () => void;
  submitText: string;
  cancelText?: string;
  isPending?: boolean;
  disabled?: boolean;
  variant?: "default" | "full-width";
  additionalButtons?: React.ReactNode;
  showCancel?: boolean; // Default: true
}

/**
 * FormDialogFooter Component
 *
 * Standardized footer buttons for form dialogs.
 * Follows DRY principle by eliminating duplicate footer button patterns.
 *
 * @example
 * ```tsx
 * <FormDialogLayout
 *   footer={
 *     <FormDialogFooter
 *       formId="edit-product-form"
 *       onCancel={() => onOpenChange(false)}
 *       submitText={t("data.products.update")}
 *       isPending={isPending}
 *     />
 *   }
 * >
 * ```
 */
export function FormDialogFooter({
  formId,
  onCancel,
  submitText,
  cancelText,
  isPending = false,
  disabled = false,
  variant = "default",
  additionalButtons,
  showCancel = true,
}: FormDialogFooterProps) {
  const { t } = useI18n();

  return (
    <>
      {showCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending || disabled}
          className={cn(variant === "full-width" && "flex-1")}
        >
          {cancelText || t("common.actions.cancel") || "Cancel"}
        </Button>
      )}
      {additionalButtons}
      <Button
        type="submit"
        form={formId}
        disabled={isPending || disabled}
        className={cn(variant === "full-width" && "flex-1")}
      >
        {isPending && <LottieLoader size="xs" className="mr-2" />}
        {submitText}
      </Button>
    </>
  );
}

