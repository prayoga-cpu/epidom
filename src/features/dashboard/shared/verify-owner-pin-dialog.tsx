"use client";

import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinPad } from "@/components/ui/pin-pad";
import { toast } from "sonner";
import { useRequestOwnerPinOtp, useResetOwnerPin } from "./hooks/use-owner-pin";
import { useI18n } from "@/components/lang/i18n-provider";

interface VerifyOwnerPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the owner has proven their identity (PIN or OTP reset). */
  onVerified: () => void;
}

/** PIN entry to switch a shared device back to the Owner. Includes a "Forgot PIN?" → email OTP recovery. */
export function VerifyOwnerPinDialog({ open, onOpenChange, onVerified }: VerifyOwnerPinDialogProps) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [mode, setMode] = useState<"pin" | "otp">("pin");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);

  const requestOtp = useRequestOwnerPinOtp();
  const resetPin = useResetOwnerPin();

  const reset = () => {
    setPin("");
    setIsVerifying(false);
    setMode("pin");
    setOtp("");
    setNewPin("");
    setConfirmPin("");
    setOtpSentTo(null);
  };

  const verifyPin = useCallback(
    async (enteredPin: string) => {
      setIsVerifying(true);
      try {
        const res = await fetch("/api/user/verify-owner-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: enteredPin }),
        });
        if (!res.ok) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setPin("");
          toast.error(t("pages.staffAuthIncorrectPin"));
          return;
        }
        reset();
        onOpenChange(false);
        onVerified();
      } catch {
        toast.error(t("pages.staffAuthVerifyFailed"));
        setPin("");
      } finally {
        setIsVerifying(false);
      }
    },
    [onOpenChange, onVerified]
  );

  const handleKey = (key: string) => {
    if (isVerifying) return;
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) verifyPin(next);
  };

  const handleRequestOtp = async () => {
    try {
      const result = await requestOtp.mutateAsync();
      setOtpSentTo(result.email);
      setMode("otp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.ownerPinSendCodeFailed"));
    }
  };

  const handleResetSubmit = async () => {
    if (newPin.length !== 4) {
      toast.error(t("pages.staffPinLengthError"));
      return;
    }
    if (newPin !== confirmPin) {
      toast.error(t("pages.ownerPinMismatch"));
      return;
    }
    try {
      await resetPin.mutateAsync({ otp, newPin });
      toast.success(t("pages.ownerPinReset"));
      reset();
      onOpenChange(false);
      onVerified();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.ownerPinInvalidCode"));
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
      <DialogContent className="max-w-xs">
        {mode === "pin" ? (
          <>
            <DialogHeader className="text-center">
              <DialogTitle>{t("pages.ownerPinSwitchBackTitle")}</DialogTitle>
              <DialogDescription>{t("pages.ownerPinSwitchBackDesc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-2">
              <PinPad value={pin} onKey={handleKey} disabled={isVerifying} shake={shake} />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-4 text-xs"
                onClick={handleRequestOtp}
                disabled={requestOtp.isPending}
              >
                {t("pages.ownerPinForgot")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("pages.ownerPinResetTitle")}</DialogTitle>
              <DialogDescription>
                {otpSentTo
                  ? t("pages.ownerPinResetDescWithEmail").replace("{email}", otpSentTo)
                  : t("pages.ownerPinResetDescNoEmail")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>{t("pages.ownerPinCodeLabel")}</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("pages.staffNewPin")}</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={t("pages.staffPinPlaceholder")}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("pin")}>
                  {t("common.actions.back")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleResetSubmit}
                  disabled={resetPin.isPending}
                >
                  {t("pages.ownerPinResetSubmit")}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
