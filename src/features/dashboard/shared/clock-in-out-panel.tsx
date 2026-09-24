"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
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
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";
import { Textarea } from "@/components/ui/textarea";
import { SelfieCapture } from "@/components/shared/selfie-capture";
import { apiClient } from "@/lib/api/client";
import { useGeolocation } from "@/hooks/use-geolocation";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { compressImage } from "@/lib/utils/image-compression";
import { cn } from "@/lib/utils";
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

type HeadingComponent = ComponentType<{ children: ReactNode; className?: string }>;

export interface ClockInOutPanelProps {
  storeId: string;
  /**
   * Called after a successful clock-in / clock-out / absence (a photo retake
   * returns to the history instead). When omitted (inline use), the panel
   * restarts at its first step.
   */
  onComplete?: () => void;
  /** Heading components; default to plain elements. The dialog passes DialogTitle / DialogDescription. */
  Title?: HeadingComponent;
  Description?: HeadingComponent;
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

/**
 * Every react-query cache that shows attendance, by prefix — a clock event or a
 * retaken photo has to reach them without a reload now that this flow can sit
 * inline next to them (POS Operational page) instead of in a throwaway dialog.
 */
const ATTENDANCE_VIEW_KEYS = [
  "attendance-history", // this panel's own history step
  "schedule-my-log", // My Schedule's history list
  "schedule-log", // Back Office Schedule → attendance log
  "attendance-hours", // Back Office Schedule → Hours & Overtime
  "operations-status", // dashboard operations card (on duty / late)
] as const;

// Same look as DialogTitle / DialogDescription / DialogHeader, without the Radix
// primitives — those throw outside a <Dialog>, and this panel also renders inline.
function PlainTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-lg leading-none font-semibold", className)}>{children}</h2>;
}

function PlainDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-muted-foreground text-sm", className)}>{children}</p>;
}

function Header({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 text-center sm:text-left", className)}>{children}</div>
  );
}

/** h-10: at least 40px tall, so it stays an easy tap on a POS touchscreen. */
function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-10 self-start" onClick={onClick}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

/**
 * The whole clock in / out flow (kiosk staff grid → PIN → selfie, absence,
 * history and photo retake), renderable inline or inside ClockInOutDialog.
 * Mounting it is "opening" it: every step's state lives here and starts fresh
 * on mount, so a host that hides it must unmount it (which also lets
 * SelfieCapture stop the camera).
 */
export function ClockInOutPanel({
  storeId,
  onComplete,
  Title = PlainTitle,
  Description = PlainDescription,
}: ClockInOutPanelProps) {
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
  const personaId = actingAsStaff ? posSession.staffId : null;

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

  // Bumped by every staff selection and every restart: a status lookup that
  // resolves after a newer selection (or after the flow restarted) is dropped
  // instead of landing its clocked-in state on the wrong person.
  const selectSeq = useRef(0);

  // Only the kiosk grid needs the roster — a staff persona is clocked in as itself.
  const { data } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffOption[] }>(`/stores/${storeId}/staff`),
    enabled: !actingAsStaff,
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

  const restart = () => {
    selectSeq.current += 1;
    setStep("select-staff");
    setSelected(null);
    setPin("");
    setAbsenceReason("");
    setRetakeTargetId(null);
    setRetakePin("");
  };

  const handleSelectStaff = async (member: StaffOption) => {
    const seq = ++selectSeq.current;
    setSelected(member);
    // A new person starts clean, whatever the last one left half-typed.
    setPin("");
    setAbsenceReason("");
    let clockedIn = false;
    try {
      const status = await apiClient.get<{ isClockedIn: boolean }>(
        `/stores/${storeId}/attendance/status`,
        { staffId: member.id }
      );
      clockedIn = status.isClockedIn;
    } catch {
      clockedIn = false;
    }
    if (seq !== selectSeq.current) return;
    setIsClockedIn(clockedIn);
    setAction(clockedIn ? "clockOut" : "clockIn");
    setStep("choose-action");
  };

  // The persona switched (or appeared / went away) while this stayed mounted —
  // an inline panel outlives a dialog, so start over for whoever is here now.
  const lastPersonaId = useRef(personaId);
  useEffect(() => {
    if (lastPersonaId.current === personaId) return;
    lastPersonaId.current = personaId;
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaId]);

  // A persona skips the staff grid: select them whenever the flow is at its
  // start — on mount, and again each time it restarts after a success (an
  // inline panel must never sit on this spinner after the first clock-in).
  useEffect(() => {
    if (step !== "select-staff" || !personaId) return;
    handleSelectStaff({
      id: personaId,
      name: posSession.staffName ?? "",
      role: (posSession.staffRole as StaffRole) ?? "CASHIER",
      isActive: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, personaId]);

  const refreshAttendanceViews = () => {
    for (const key of ATTENDANCE_VIEW_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [key, storeId] });
    }
  };

  const finish = () => {
    refreshAttendanceViews();
    if (onComplete) onComplete();
    else restart();
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

  // Back out of the PIN / selfie / absence-reason step to the action choice. The
  // PIN and the typed reason go with it: on a shared kiosk they belong to this
  // attempt, not to whoever picks an action next.
  const backToChooseAction = () => {
    setPin("");
    setAbsenceReason("");
    setStep("choose-action");
  };

  const backToHistory = () => {
    setRetakeTargetId(null);
    setRetakePin("");
    setStep("history");
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
      // Back to the history the retake started from, with the new photo — not
      // the end of the flow: a retake fixes a record, it doesn't clock anyone.
      refreshAttendanceViews();
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
      finish();
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

  const backLabel = t("common.actions.back");
  // Steps with a visible heading render their own <Title>; every other step gets
  // this screen-reader-only one, so a dialog host always has exactly one title.
  const hasVisibleTitle =
    (step === "select-staff" && !actingAsStaff) ||
    step === "history" ||
    step === "retake-selfie" ||
    step === "selfie" ||
    step === "absence-reason";

  return (
    <div className="flex flex-col gap-4">
      {!hasVisibleTitle && <Title className="sr-only">{t("clockInOut.dialogTitle")}</Title>}

      {step === "select-staff" &&
        (actingAsStaff ? (
          <div className="flex justify-center py-10">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <Header className="text-center">
              <Title>{t("clockInOut.dialogTitle")}</Title>
              <Description>{t("clockInOut.selectStaff")}</Description>
            </Header>
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
            <BackButton label={backLabel} onClick={() => setStep("select-staff")} />
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
          <BackButton label={backLabel} onClick={() => setStep("choose-action")} />
          <Header>
            <Title>{t("clockInOut.historyTitle")}</Title>
            <Description>{selected.name}</Description>
          </Header>
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
          <BackButton label={backLabel} onClick={() => setStep("history")} />
          <div className="flex flex-col items-center py-2">
            <p className="text-muted-foreground mb-4 text-xs">{t("clockInOut.enterPin")}</p>
            <PinPad value={retakePin} onKey={handleRetakePinKey} shake={retakeShake} />
          </div>
        </>
      )}

      {step === "retake-selfie" && (
        <>
          <BackButton label={backLabel} onClick={backToHistory} />
          <Header>
            <Title>{t("clockInOut.retakePhotoTitle")}</Title>
          </Header>
          <SelfieCapture onConfirm={(file) => submitRetake(file)} />
        </>
      )}

      {step === "pin" && selected && (
        <>
          <BackButton label={backLabel} onClick={backToChooseAction} />
          <div className="flex flex-col items-center py-2">
            <p className="text-muted-foreground mb-4 text-xs">{t("clockInOut.enterPin")}</p>
            <PinPad value={pin} onKey={handlePinKey} shake={shake} />
          </div>
        </>
      )}

      {step === "selfie" && selected && (
        <>
          <BackButton label={backLabel} onClick={backToChooseAction} />
          <Header>
            <Title>
              {action === "clockIn"
                ? t("clockInOut.clockInAction")
                : t("clockInOut.clockOutAction")}
            </Title>
          </Header>
          <SelfieCapture onConfirm={(file) => submit(file)} />
        </>
      )}

      {step === "absence-reason" && selected && (
        <>
          <BackButton label={backLabel} onClick={backToChooseAction} />
          <Header>
            <Title>{t("clockInOut.reportAbsence")}</Title>
            <Description>{t("clockInOut.absenceReasonLabel")}</Description>
          </Header>
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
    </div>
  );
}
