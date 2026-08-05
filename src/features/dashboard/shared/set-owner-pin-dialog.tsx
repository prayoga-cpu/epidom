"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSetOwnerPin } from "./hooks/use-owner-pin";
import { useI18n } from "@/components/lang/i18n-provider";

interface SetOwnerPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

/** Lets the account owner set (or overwrite) their own 4-digit PIN. */
export function SetOwnerPinDialog({
  open,
  onOpenChange,
  title,
  description,
  onSuccess,
}: SetOwnerPinDialogProps) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const setOwnerPin = useSetOwnerPin();
  const resolvedTitle = title ?? t("pages.ownerPinSetTitle");
  const resolvedDescription = description ?? t("pages.ownerPinSetDesc");

  const reset = () => {
    setPin("");
    setConfirmPin("");
  };

  const handleSave = async () => {
    if (pin.length !== 4) {
      toast.error(t("pages.staffPinLengthError"));
      return;
    }
    if (pin !== confirmPin) {
      toast.error(t("pages.ownerPinMismatch"));
      return;
    }
    try {
      await setOwnerPin.mutateAsync(pin);
      toast.success(t("pages.ownerPinSet"));
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.ownerPinSetFailed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <FormDialogLayout
        title={resolvedTitle}
        description={resolvedDescription}
        footer={
          <>
            <FormDialogFooter
              formId="set-owner-pin-form"
              onCancel={() => onOpenChange(false)}
              submitText={t("pages.ownerPinSavePin")}
              isPending={setOwnerPin.isPending}
              variant="full-width"
            />
          </>
        }
      >
        <form
          id="set-owner-pin-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label>{t("pages.staffNewPin")}</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder={t("pages.staffPinPlaceholder")}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("pages.ownerPinConfirmLabel")}</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder={t("pages.ownerPinConfirmPlaceholder")}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
