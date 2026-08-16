"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  LogIn,
  LogOut,
  CalendarOff,
  UserRound,
  Loader2,
  History,
  RotateCcw,
  MapPin,
} from "lucide-react";
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
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { compressImage } from "@/lib/utils/image-compression";
import { toast } from "sonner";
import type { StaffRole } from "@prisma/client";
import { useI18n } from "@/components/lang/i18n-provider";

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
}

interface AttendanceHistoryRecord {
  id: string;
  type: "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE";
  timestamp: string;
  selfieUrl: string | null;
  locationLabel: string | null;
  notes: string | null;
}

interface ClockInOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

type Step =
  | "select-staff"
  | "choose-action"
  | "pin"
  | "selfie"
  | "absence-reason"
  | "submitting"
  | "history"
  | "retake-pin"
  | "retake-selfie";
type Action = "clockIn" | "clockOut" | "absence";

// A retake only counts as touching up "the same" record when it's done
// shortly after the original — mirrors RETAKE_WINDOW_MS server-side, kept in
// sync there rather than trusting the server's 409 as the only signal.
const RETAKE_WINDOW_MS = 30 * 60 * 1000;

export function ClockInOutDialog({ open, onOpenChange, storeId }: ClockInOutDialogProps) {
  const { t, formatDateTime } = useI18n();
  const geolocation = useGeolocation();
  const posSession = usePosSession();
  const queryClient = useQueryClient();

  // A PIN is only meant to prove identity once, at login — if this device is
  // already operating as a specific (non-owner) staff persona, re-asking for
  // the PIN here just to clock that same person in/out is redundant. Skip
  // straight to picking clock-in/out for them; the kiosk-style "pick anyone,
  // enter their PIN" flow below still applies when no persona is active.
  const actingAsStaff =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER";

  const [step, setStep] = useState<Step>("select-staff");
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [action, setAction] = useState<Action>("clockIn");
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [absenceReason, setAbsenceReason] = useState("");
  const [retakeTargetId, setRetakeTargetId] = useState<string | null>(null);
  const [retakePin, setRetakePin] = useState("");
  const [retakeShake, setRetakeShake] = useState(false);

  const { data } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffOption[] }>(`/stores/${storeId}/staff`),
    enabled: open && !actingAsStaff,
  });
  const activeStaff = (data?.staff ?? []).filter((s) => s.isActive && s.role !== "OWNER");

  const historyQuery = useQuery({
    queryKey: ["attendance-history", storeId, selected?.id],
    queryFn: () =>
      apiClient.get<{ records: AttendanceHistoryRecord[] }>(
        `/stores/${storeId}/attendance/history`,
        { staffId: selected!.id }
      ),
    enabled: step === "history" && !!selected,
  });
  const historyRecords = historyQuery.data?.records ?? [];

  const reset = () => {
    setStep("select-staff");
    setSelected(null);
    setPin("");
    setAbsenceReason("");
    setRetakeTargetId(null);
    setRetakePin("");
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

  useEffect(() => {
    if (open && actingAsStaff && step === "select-staff" && posSession.staffId) {
      handleSelectStaff({
        id: posSession.staffId,
        name: posSession.staffName ?? "",
        role: (posSession.staffRole as StaffRole) ?? "CASHIER",
        isActive: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actingAsStaff]);

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

  const canRetake = (record: AttendanceHistoryRecord) =>
    record.type !== "ABSENCE" &&
    Date.now() - new Date(record.timestamp).getTime() <= RETAKE_WINDOW_MS;

  const handleRetakeClick = (record: AttendanceHistoryRecord) => {
    setRetakeTargetId(record.id);
    setRetakePin("");
    setStep(actingAsStaff ? "retake-selfie" : "retake-pin");
  };

  const handleRetakePinKey = (key: string) => {
    if (key === "del") {
      setRetakePin((p) => p.slice(0, -1));
      return;
    }
    if (retakePin.length >= 4) return;
    const next = retakePin + key;
    setRetakePin(next);
    if (next.length === 4) setStep("retake-selfie");
  };

  const submitRetake = async (file: File) => {
    if (!retakeTargetId || !selected) return;
    setStep("submitting");
    try {
      const compressedFile = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressedFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error(t("clockInOut.error"));
      const uploadData = await uploadRes.json();
      await apiClient.post(`/stores/${storeId}/attendance/${retakeTargetId}/retake-photo`, {
        staffId: selected.id,
        pin: retakePin,
        selfieUrl: uploadData.data.url,
      });
      toast.success(t("clockInOut.retakeSuccess"));
      await queryClient.invalidateQueries({
        queryKey: ["attendance-history", storeId, selected.id],
      });
      setRetakeTargetId(null);
      setRetakePin("");
      setStep("history");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("clockInOut.error");
      if (message.toLowerCase().includes("pin")) {
        setRetakeShake(true);
        setTimeout(() => setRetakeShake(false), 500);
        setRetakePin("");
        setStep("retake-pin");
        toast.error(t("clockInOut.incorrectPin"));
      } else {
        toast.error(message);
        setStep("history");
      }
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
          const compressedFile = await compressImage(selfieFile);
          const formData = new FormData();
          formData.append("file", compressedFile);
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
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] max-w-sm flex-col overflow-y-auto">
        {step === "select-staff" &&
          (actingAsStaff ? (
            <div className="flex justify-center py-10">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
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
          ))}

        {step === "choose-action" && selected && (
          <>
            {!actingAsStaff && (
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
            )}
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
                    setStep(actingAsStaff ? "selfie" : "pin");
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
                      setStep(actingAsStaff ? "absence-reason" : "pin");
                    }}
                  >
                    <CalendarOff className="mr-2 h-4 w-4" />
                    {t("clockInOut.reportAbsence")}
                  </Button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => setStep("history")}
              >
                <History className="h-3.5 w-3.5" />
                {t("clockInOut.viewHistory")}
              </Button>
            </div>
          </>
        )}

        {step === "history" && selected && (
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
            <DialogHeader>
              <DialogTitle>{t("clockInOut.historyTitle")}</DialogTitle>
              <DialogDescription>{selected.name}</DialogDescription>
            </DialogHeader>
            {historyQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : historyRecords.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t("clockInOut.historyEmpty")}
              </p>
            ) : (
              <div className="flex flex-col gap-2 py-1">
                {historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border-border/60 flex items-center gap-3 rounded-lg border p-2.5"
                  >
                    {record.selfieUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={record.selfieUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                        {record.type === "ABSENCE" ? (
                          <CalendarOff className="text-muted-foreground h-4 w-4" />
                        ) : record.type === "CLOCK_IN" ? (
                          <LogIn className="text-muted-foreground h-4 w-4" />
                        ) : (
                          <LogOut className="text-muted-foreground h-4 w-4" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {record.type === "ABSENCE"
                          ? t("clockInOut.typeAbsence")
                          : record.type === "CLOCK_IN"
                            ? t("clockInOut.typeClockIn")
                            : t("clockInOut.typeClockOut")}
                      </p>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {formatDateTime(record.timestamp)}
                      </p>
                      {record.locationLabel && (
                        <p className="text-muted-foreground flex items-center gap-1 truncate text-[11px]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {record.locationLabel}
                        </p>
                      )}
                    </div>
                    {canRetake(record) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 text-xs"
                        onClick={() => handleRetakeClick(record)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t("clockInOut.retake")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === "retake-pin" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 self-start"
              onClick={() => setStep("history")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.actions.back")}
            </Button>
            <div className="flex flex-col items-center py-2">
              <p className="text-muted-foreground mb-4 text-xs">{t("clockInOut.enterPin")}</p>
              <PinPad value={retakePin} onKey={handleRetakePinKey} shake={retakeShake} />
            </div>
          </>
        )}

        {step === "retake-selfie" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("clockInOut.retakePhotoTitle")}</DialogTitle>
            </DialogHeader>
            <SelfieCapture onConfirm={(file) => submitRetake(file)} />
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
