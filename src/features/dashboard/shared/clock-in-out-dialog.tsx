"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LogIn, LogOut, CalendarOff, UserRound, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";
import { Textarea } from "@/components/ui/textarea";
import { SelfieCapture } from "@/components/shared/selfie-capture";
import { apiClient } from "@/lib/api/client";
import { useGeolocation } from "@/hooks/use-geolocation";
import { toast } from "sonner";
import type { StaffRole } from "@prisma/client";
import { useI18n } from "@/components/lang/i18n-provider";

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
}

interface ClockInOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

type Step = "select-staff" | "choose-action" | "pin" | "selfie" | "absence-reason" | "submitting";
type Action = "clockIn" | "clockOut" | "absence";

export function ClockInOutDialog({ open, onOpenChange, storeId }: ClockInOutDialogProps) {
  const { t } = useI18n();
  const geolocation = useGeolocation();

  const [step, setStep] = useState<Step>("select-staff");
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [action, setAction] = useState<Action>("clockIn");
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [absenceReason, setAbsenceReason] = useState("");

  const { data } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffOption[] }>(`/stores/${storeId}/staff`),
    enabled: open,
  });
  const activeStaff = (data?.staff ?? []).filter((s) => s.isActive && s.role !== "OWNER");

  const reset = () => {
    setStep("select-staff");
    setSelected(null);
    setPin("");
    setAbsenceReason("");
  };

  const handleSelectStaff = async (member: StaffOption) => {
    setSelected(member);
    try {
      const status = await apiClient.get<{ isClockedIn: boolean }>(
        `/stores/${storeId}/attendance/status`,
        { staffId: member.id }
      );
      setIsClockedIn(status.isClockedIn);
      setAction(status.isClockedIn ? "clockOut" : "clockIn");
    } catch {
      setIsClockedIn(false);
      setAction("clockIn");
    }
    setStep("choose-action");
  };

  const handlePinKey = (key: string) => {
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      setStep(action === "absence" ? "absence-reason" : "selfie");
    }
  };

  const submit = async (selfieFile: File | null) => {
    setStep("submitting");
    try {
      const coords = await geolocation.locate();

      if (action === "absence") {
        await apiClient.post(`/stores/${storeId}/attendance/absence`, {
          staffId: selected!.id,
          pin,
          notes: absenceReason,
          ...coords,
        });
      } else {
        let selfieUrl: string | undefined;
        if (selfieFile) {
          const formData = new FormData();
          formData.append("file", selfieFile);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
          if (!uploadRes.ok) throw new Error(t("clockInOut.error"));
          const uploadData = await uploadRes.json();
          selfieUrl = uploadData.data.url;
        }
        const endpoint = action === "clockIn" ? "clock-in" : "clock-out";
        await apiClient.post(`/stores/${storeId}/attendance/${endpoint}`, {
          staffId: selected!.id,
          pin,
          selfieUrl,
          ...coords,
        });
      }

      toast.success(
        action === "clockIn"
          ? t("clockInOut.success")
          : action === "clockOut"
            ? t("clockInOut.success")
            : t("clockInOut.absenceRecorded")
      );
      onOpenChange(false);
      reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("clockInOut.error");
      if (message.toLowerCase().includes("pin")) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPin("");
        setStep("pin");
        toast.error(t("clockInOut.incorrectPin"));
      } else {
        toast.error(message);
        setStep(action === "absence" ? "absence-reason" : "selfie");
      }
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
      <DialogContent className="flex max-h-[90dvh] max-w-sm flex-col overflow-y-auto">
        {step === "select-staff" && (
          <>
            <DialogHeader className="text-center">
              <DialogTitle>{t("clockInOut.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("clockInOut.selectStaff")}</DialogDescription>
            </DialogHeader>
            {activeStaff.length === 0 ? (
              <div className="space-y-2 py-8 text-center">
                <UserRound className="text-muted-foreground/50 mx-auto h-10 w-10" />
                <p className="text-muted-foreground text-sm">{t("pages.staffAuthNoActiveStaff")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 py-2">
                {activeStaff.map((member) => (
                  <Button
                    key={member.id}
                    type="button"
                    variant="outline"
                    className="hover:bg-muted/50 hover:border-primary/50 flex h-20 flex-col items-center justify-center gap-1.5"
                    onClick={() => handleSelectStaff(member)}
                  >
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="w-full truncate px-1 text-center text-xs font-medium">
                      {member.name}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </>
        )}

        {step === "choose-action" && selected && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 self-start"
              onClick={() => setStep("select-staff")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.actions.back")}
            </Button>
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-lg font-bold tracking-tight">{selected.name}</p>
              <div className="flex w-full flex-col gap-2">
                <Button
                  type="button"
                  className="h-11"
                  onClick={() => {
                    setAction(isClockedIn ? "clockOut" : "clockIn");
                    setStep("pin");
                  }}
                >
                  {isClockedIn ? (
                    <LogOut className="mr-2 h-4 w-4" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                  {isClockedIn ? t("clockInOut.clockOutAction") : t("clockInOut.clockInAction")}
                </Button>
                {!isClockedIn && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      setAction("absence");
                      setStep("pin");
                    }}
                  >
                    <CalendarOff className="mr-2 h-4 w-4" />
                    {t("clockInOut.reportAbsence")}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {step === "pin" && selected && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 self-start"
              onClick={() => setStep("choose-action")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.actions.back")}
            </Button>
            <div className="flex flex-col items-center py-2">
              <p className="text-muted-foreground mb-4 text-xs">{t("clockInOut.enterPin")}</p>
              <PinPad value={pin} onKey={handlePinKey} shake={shake} />
            </div>
          </>
        )}

        {step === "selfie" && selected && (
          <>
            <DialogHeader>
              <DialogTitle>
                {action === "clockIn" ? t("clockInOut.clockInAction") : t("clockInOut.clockOutAction")}
              </DialogTitle>
            </DialogHeader>
            <SelfieCapture onConfirm={(file) => submit(file)} />
          </>
        )}

        {step === "absence-reason" && selected && (
          <>
            <DialogHeader>
              <DialogTitle>{t("clockInOut.reportAbsence")}</DialogTitle>
              <DialogDescription>{t("clockInOut.absenceReasonLabel")}</DialogDescription>
            </DialogHeader>
            <Textarea
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="min-h-0"
            />
            <Button
              type="button"
              className="h-11 w-full"
              disabled={!absenceReason.trim()}
              onClick={() => submit(null)}
            >
              {t("clockInOut.submit")}
            </Button>
          </>
        )}

        {step === "submitting" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-sm">
              {geolocation.status === "locating" ? t("clockInOut.locating") : t("clockInOut.submit")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
