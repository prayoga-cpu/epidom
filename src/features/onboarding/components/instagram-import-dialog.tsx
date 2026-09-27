"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import type { InstagramPrefill } from "../lib/instagram-prefill";
import { InstagramImportStep } from "./instagram-import-step";

/**
 * "Fill from Instagram": the screenshot reader in a dialog, opened from the
 * wizard's first step. Closing it at any point leaves the form untouched.
 * The step only mounts while the dialog is open, so every opening starts
 * from the upload choice again.
 */
export function InstagramImportDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (prefill: InstagramPrefill) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <FormDialogLayout
          title={t("onboarding.instagram.title")}
          description={t("onboarding.instagram.subtitle")}
          maxWidth="md"
        >
          <InstagramImportStep onComplete={onComplete} onCancel={() => onOpenChange(false)} />
        </FormDialogLayout>
      ) : null}
    </Dialog>
  );
}
