"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSetOwnerPin } from "./hooks/use-owner-pin";

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
  title = "Set Owner PIN",
  description = "This PIN protects switching a shared device back to your Owner account once staff can log in.",
  onSuccess,
}: SetOwnerPinDialogProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const setOwnerPin = useSetOwnerPin();

  const reset = () => {
    setPin("");
    setConfirmPin("");
  };

  const handleSave = async () => {
    if (pin.length !== 4) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }
    try {
      await setOwnerPin.mutateAsync(pin);
      toast.success("Owner PIN set");
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set PIN");
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
        title={title}
        description={description}
        footer={
          <>
            <FormDialogFooter
              formId="set-owner-pin-form"
              onCancel={() => onOpenChange(false)}
              submitText="Save PIN"
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
            <Label>New PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <div className="space-y-1">
            <Label>Confirm PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Re-enter PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
}
