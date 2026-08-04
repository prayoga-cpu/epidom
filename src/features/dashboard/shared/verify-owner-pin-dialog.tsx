"use client";

import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinPad } from "@/components/ui/pin-pad";
import { toast } from "sonner";
import { useRequestOwnerPinOtp, useResetOwnerPin } from "./hooks/use-owner-pin";

interface VerifyOwnerPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the owner has proven their identity (PIN or OTP reset). */
  onVerified: () => void;
}

/** PIN entry to switch a shared device back to the Owner. Includes a "Forgot PIN?" → email OTP recovery. */
export function VerifyOwnerPinDialog({ open, onOpenChange, onVerified }: VerifyOwnerPinDialogProps) {
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
          toast.error("Incorrect PIN. Try again.");
          return;
        }
        reset();
        onOpenChange(false);
        onVerified();
      } catch {
        toast.error("Failed to verify PIN. Check your connection.");
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
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    }
  };

  const handleResetSubmit = async () => {
    if (newPin.length !== 4) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }
    try {
      await resetPin.mutateAsync({ otp, newPin });
      toast.success("Owner PIN reset");
      reset();
      onOpenChange(false);
      onVerified();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
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
              <DialogTitle>Switch back to Owner</DialogTitle>
              <DialogDescription>Enter your Owner PIN to continue</DialogDescription>
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
                Forgot PIN?
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset Owner PIN</DialogTitle>
              <DialogDescription>
                {otpSentTo
                  ? `Enter the code sent to ${otpSentTo} and set a new PIN.`
                  : "Enter the code sent to your email and set a new PIN."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>6-digit code</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <div className="space-y-1">
                <Label>New PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("pin")}>
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleResetSubmit}
                  disabled={resetPin.isPending}
                >
                  Reset PIN
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
