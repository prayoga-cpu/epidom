"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/use-confirm";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { todayLocalISO, startOfMonthLocalISO, parseLocalISO } from "@/lib/utils/date-range";
import { toast } from "sonner";
import { MapPin, ImageOff, Printer, CheckCheck } from "lucide-react";
import { DateRangeField } from "@/components/ui/date-range-field";
import type { StaffRole } from "@prisma/client";
import type { HoursReportRow } from "@/lib/attendance/hours-report";
import { isOvertimeDecidable, type OvertimeDecisionValue } from "@/lib/attendance/overtime-approval";
import {
  SelfiePreviewDialog,
  type SelfiePreviewItem,
} from "@/features/dashboard/shared/selfie-preview-dialog";
import { DayStatus, DayTimes, LongPairWarning } from "./payroll-breakdown";
import { PayrollPanel } from "./payroll-panel";
import { OvertimeApprovalCell } from "./overtime-approval-cell";
import { differenceTone, useHoursFormat } from "./use-hours-format";

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
}

type LogType = "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE";
type LogTab = "log" | "hours" | "salary";
/** Which Hours rows to show: every day, days with overtime, or overtime still waiting for approval. */
type OvertimeFilter = "all" | "overtime" | "pending";

/** The POST /attendance/overtime batch ceiling (overtimeDecisionSchema). */
const DECISION_BATCH = 500;

/** Everything this log shows. Till cash is the Shifts page's, not attendance. */
const ATTENDANCE_TYPES: LogType[] = ["CLOCK_IN", "CLOCK_OUT", "ABSENCE"];

interface AttendanceLogRow {
  id: string;
  timestamp: string;
  staffMemberId: string | null;
  staffName: string;
  type: LogType;
  selfieUrl: string | null;
  locationLabel: string | null;
}

interface HoursDayRow extends HoursReportRow {
  staff: StaffOption | null;
}

interface MissingClockOutRow {
  attendanceId: string;
  staffMemberId: string;
  staff: StaffOption | null;
  clockInAt: string;
  isOpen: boolean;
}

interface ScheduleLogProps {
  storeId: string;
  staff: StaffOption[];
  /**
   * The real owner: the Salary tab and the "overtime needs approval" switch
   * (the payroll and settings APIs enforce the same).
   */
  canSeePayroll?: boolean;
}

/**
 * The Schedule page's manager-facing Log & History section: the attendance log
 * (clock-ins, clock-outs, absences), the hours it adds up to against what each
 * person was expected to work, and — for the owner — the salary it earns.
 *
 * Till cash — a shift's opening float, its closing count, tips and paid-outs —
 * is deliberately NOT here. That is the Shifts page's report (/shifts): who was
 * on the clock and what was in the drawer are different questions and were
 * being read off one mixed timeline.
 */
export function ScheduleLog({ storeId, staff, canSeePayroll = false }: ScheduleLogProps) {
  const { t, formatDateTime, dateLocale } = useI18n();
  const { duration, signedDuration } = useHoursFormat();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(startOfMonthLocalISO());
  const [to, setTo] = useState(todayLocalISO());
  const [staffId, setStaffId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [closing, setClosing] = useState<{ attendanceId: string; clockInAt: string } | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState("");
  // "yyyy-MM-ddTHH:mm" in the viewer's own clock, what <input type="datetime-local"> takes.
  const [closeAt, setCloseAt] = useState("");
  const [activeTab, setActiveTab] = useState<LogTab>("log");
  const [selfieIndex, setSelfieIndex] = useState<number | null>(null);
  const [overtimeFilter, setOvertimeFilter] = useState<OvertimeFilter>("all");
  // The row whose decision is in flight ("staffId:date"), or "bulk".
  const [deciding, setDeciding] = useState<string | null>(null);
  const [savingApproval, setSavingApproval] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ["schedule-log", storeId, from, to, staffId, typeFilter],
    queryFn: () =>
      apiClient.get<{ records: AttendanceLogRow[] }>(`/stores/${storeId}/schedule/log`, {
        from: new Date(from).toISOString(),
        to: new Date(new Date(to).getTime() + 86_400_000 - 1).toISOString(),
        ...(staffId !== "all" && { staffId }),
        // Always explicit: "all" means all ATTENDANCE types, never the route's own
        // default of every kind (which would bring till cash back in).
        type: typeFilter !== "all" ? typeFilter : ATTENDANCE_TYPES.join(","),
      }),
  });

  const { data: hoursData, isLoading: hoursLoading } = useQuery({
    queryKey: ["attendance-hours", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{
        days: HoursDayRow[];
        missingClockOuts: MissingClockOutRow[];
        standardWorkMinutesPerDay: number;
        overtimeRequiresApproval: boolean;
        selfStaffMemberId: string | null;
      }>(`/stores/${storeId}/attendance/hours`, {
        from,
        to,
        ...(staffId !== "all" && { staffId }),
      }),
  });

  const typeLabel = (type: LogType) => {
    switch (type) {
      case "CLOCK_IN":
        return t("clockInOut.typeClockIn");
      case "CLOCK_OUT":
        return t("clockInOut.typeClockOut");
      case "ABSENCE":
        return t("clockInOut.typeAbsence");
    }
  };

  // Every selfie in the current log, in the table's order — what the preview
  // steps through with Previous / Next.
  const records = useMemo(() => logData?.records ?? [], [logData]);
  const selfies = useMemo<SelfiePreviewItem[]>(
    () =>
      records
        .filter((r): r is AttendanceLogRow & { selfieUrl: string } => !!r.selfieUrl)
        .map((r) => ({
          id: r.id,
          selfieUrl: r.selfieUrl,
          staffName: r.staffName,
          typeLabel: typeLabel(r.type),
          timestamp: r.timestamp,
          locationLabel: r.locationLabel,
        })),
    // typeLabel only reads `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, t]
  );

  const [hoursInput, setHoursInput] = useState<string>("");
  const [minutesInput, setMinutesInput] = useState<string>("");

  // "Standard work minutes per day" is a duration (e.g. 8h 0m), not a time
  // of day — the fields below are hours/minutes counters, not a wall-clock
  // picker, so there's no AM/PM to misread.
  const standardMinutes = hoursData?.standardWorkMinutesPerDay ?? 480;
  const hoursValue = hoursInput !== "" ? hoursInput : String(Math.floor(standardMinutes / 60));
  const minutesValue = minutesInput !== "" ? minutesInput : String(standardMinutes % 60);

  // Salary, My Pay and Finance's labour cost are priced off the same hours,
  // so anything that changes them (the standard, a clock-out correction, an
  // overtime decision) refreshes them too.
  const invalidateHours = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance-hours", storeId] });
    queryClient.invalidateQueries({ queryKey: ["payroll", storeId] });
    queryClient.invalidateQueries({ queryKey: ["payroll-me", storeId] });
    queryClient.invalidateQueries({ queryKey: ["finance-labour", storeId] });
  };

  const requiresApproval = hoursData?.overtimeRequiresApproval ?? false;
  const selfStaffMemberId = hoursData?.selfStaffMemberId ?? null;
  const allDays = useMemo(() => hoursData?.days ?? [], [hoursData]);
  const visibleDays = useMemo(
    () =>
      overtimeFilter === "overtime"
        ? allDays.filter((d) => d.overtimeMinutes > 0)
        : overtimeFilter === "pending"
          ? allDays.filter((d) => d.overtime.status === "pending")
          : allDays,
    [allDays, overtimeFilter]
  );
  const waitingDays = useMemo(() => allDays.filter((d) => d.overtime.status === "pending"), [allDays]);
  const waitingMinutes = waitingDays.reduce((sum, d) => sum + d.overtime.pendingMinutes, 0);
  // What "Approve all" approves: finished days, never the viewer's own.
  const approvableDays = useMemo(
    () => waitingDays.filter((d) => isOvertimeDecidable(d) && d.staffMemberId !== selfStaffMemberId),
    [waitingDays, selfStaffMemberId]
  );

  const decisionError = (err: unknown) => {
    const reason =
      err instanceof ApiClientError
        ? (err.response.error.details as { reason?: string } | undefined)?.reason
        : undefined;
    toast.error(
      reason === "self"
        ? t("pages.overtimeOwnerApprovesYours")
        : reason === "notDecidable"
          ? t("pages.overtimeFinishDayFirst")
          : reason === "alreadyDecided"
            ? t("pages.overtimeAlreadyDecided")
            : t("common.error")
    );
  };

  const decideOvertime = async (day: HoursDayRow, decision: OvertimeDecisionValue) => {
    setDeciding(`${day.staffMemberId}:${day.date}`);
    try {
      await apiClient.post(`/stores/${storeId}/attendance/overtime`, {
        decision,
        days: [{ staffMemberId: day.staffMemberId, date: day.date }],
      });
      toast.success(
        (decision === "APPROVED" ? t("pages.overtimeApprovedToast") : t("pages.overtimeRejectedToast")).replace(
          "{name}",
          day.staff?.name ?? ""
        )
      );
    } catch (err) {
      decisionError(err);
    } finally {
      setDeciding(null);
      invalidateHours();
    }
  };

  const undoOvertime = async (day: HoursDayRow) => {
    setDeciding(`${day.staffMemberId}:${day.date}`);
    try {
      const params = new URLSearchParams({ staffMemberId: day.staffMemberId, date: day.date });
      await apiClient.delete(`/stores/${storeId}/attendance/overtime?${params.toString()}`);
      toast.success(t("pages.overtimeUndoneToast"));
    } catch (err) {
      decisionError(err);
    } finally {
      setDeciding(null);
      invalidateHours();
    }
  };

  const approveAll = async () => {
    const days = approvableDays;
    if (days.length === 0) return;
    const minutes = days.reduce((sum, d) => sum + d.overtime.pendingMinutes, 0);
    const ok = await confirm({
      title: t("pages.overtimeApproveAllTitle"),
      description: t("pages.overtimeApproveAllDesc")
        .replace("{count}", String(days.length))
        .replace("{hours}", duration(minutes)),
      confirmText: t("pages.overtimeApprove"),
    });
    if (!ok) return;
    setDeciding("bulk");
    try {
      let decided = 0;
      for (let i = 0; i < days.length; i += DECISION_BATCH) {
        const result = await apiClient.post<{ decided: number }>(`/stores/${storeId}/attendance/overtime`, {
          decision: "APPROVED",
          days: days.slice(i, i + DECISION_BATCH).map((d) => ({ staffMemberId: d.staffMemberId, date: d.date })),
        });
        decided += result.decided;
      }
      toast.success(t("pages.overtimeApprovedAllToast").replace("{count}", String(decided)));
    } catch (err) {
      decisionError(err);
    } finally {
      setDeciding(null);
      invalidateHours();
    }
  };

  const toggleApproval = async (next: boolean) => {
    if (next) {
      const ok = await confirm({
        title: t("pages.overtimeApprovalOnTitle"),
        description: t("pages.overtimeApprovalOnDesc"),
        confirmText: t("pages.overtimeApprovalOnConfirm"),
      });
      if (!ok) return;
    }
    setSavingApproval(true);
    try {
      await apiClient.patch(`/stores/${storeId}/attendance/settings`, { overtimeRequiresApproval: next });
      toast.success(t("pages.attendanceSettingsSaved"));
      if (next) setOvertimeFilter("pending");
      else setOvertimeFilter((current) => (current === "pending" ? "all" : current));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSavingApproval(false);
      invalidateHours();
    }
  };

  const saveThreshold = async () => {
    const h = Number(hoursValue);
    const m = Number(minutesValue);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return;
    const value = h * 60 + m;
    if (value < 1 || value > 1440) return;
    try {
      await apiClient.patch(`/stores/${storeId}/attendance/settings`, {
        standardWorkMinutesPerDay: value,
      });
      toast.success(t("pages.attendanceSettingsSaved"));
      invalidateHours();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const openPrintView = () => {
    const params = new URLSearchParams({ from, to, tab: activeTab });
    if (staffId !== "all") params.set("staffId", staffId);
    window.open(`/store/${storeId}/attendance/print?${params.toString()}`, "_blank");
  };

  // Closing a forgotten clock-in at "now" — the old behaviour — turned a missed
  // clock-out into days of worked time, and now of overtime pay. The dialog
  // starts at the end of that day's expected hours instead, never in the future.
  const startClosing = (attendanceId: string, clockInAt: string) => {
    const day = hoursData?.days.find((d) => d.openClockIn?.attendanceId === attendanceId);
    const minutes = day && day.expectedMinutes > 0 ? day.expectedMinutes : standardMinutes;
    const end = Math.min(new Date(clockInAt).getTime() + minutes * 60_000, Date.now());
    setClosing({ attendanceId, clockInAt });
    setCloseAt(format(new Date(end), "yyyy-MM-dd'T'HH:mm"));
  };
  const closeAtDate = closeAt ? new Date(closeAt) : null;
  const closeAtValid =
    !!closing &&
    !!closeAtDate &&
    !Number.isNaN(closeAtDate.getTime()) &&
    closeAtDate.getTime() > new Date(closing.clockInAt).getTime() &&
    closeAtDate.getTime() <= Date.now() + 60_000;

  const submitCorrection = async () => {
    if (!closing || !correctionNotes.trim() || !closeAtValid) return;
    try {
      await apiClient.post(`/stores/${storeId}/attendance/${closing.attendanceId}/close`, {
        notes: correctionNotes,
        timestamp: closeAtDate!.toISOString(),
      });
      toast.success(t("pages.attendanceCorrectionSaved"));
      setClosing(null);
      setCorrectionNotes("");
      invalidateHours();
      queryClient.invalidateQueries({ queryKey: ["schedule-log", storeId] });
    } catch {
      toast.error(t("common.error"));
    }
  };

  const typeBadgeVariant = (type: LogType): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "ABSENCE":
        return "destructive";
      case "CLOCK_IN":
        return "default";
      default:
        return "secondary";
    }
  };

  const expectedSourceLabel = (day: HoursDayRow) => {
    if (day.expectedSource === "roster") {
      return day.expectedWindows.map((w) => `${w.start}–${w.end}`).join(", ");
    }
    return day.expectedSource === "dayOff"
      ? t("pages.attendanceExpectedDayOff")
      : t("pages.attendanceExpectedStandard");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("pages.scheduleLogTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("pages.scheduleLogDesc")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={openPrintView}>
          <Printer className="mr-2 h-4 w-4" />
          {t("pages.attendancePrint")}
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="space-y-1">
          <Label htmlFor="schedule-log-date-range">{t("common.datePicker.dateRange")}</Label>
          <DateRangeField
            id="schedule-log-date-range"
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("pages.attendanceFilterStaff")}</Label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pages.attendanceFilterAllStaff")}</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {activeTab === "hours" && (
          <div className="space-y-1">
            <Label>{t("pages.overtimeFilterLabel")}</Label>
            <Select value={overtimeFilter} onValueChange={(v) => setOvertimeFilter(v as OvertimeFilter)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pages.overtimeFilterAll")}</SelectItem>
                <SelectItem value="overtime">{t("pages.overtimeFilterOvertime")}</SelectItem>
                {requiresApproval && (
                  <SelectItem value="pending">{t("pages.overtimeFilterWaiting")}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        {activeTab === "log" && (
          <div className="space-y-1">
            <Label>{t("pages.scheduleLogFilterType")}</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pages.scheduleLogFilterAllTypes")}</SelectItem>
                <SelectItem value="CLOCK_IN">{t("clockInOut.typeClockIn")}</SelectItem>
                <SelectItem value="CLOCK_OUT">{t("clockInOut.typeClockOut")}</SelectItem>
                <SelectItem value="ABSENCE">{t("clockInOut.typeAbsence")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LogTab)}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="log">{t("pages.attendanceLogTab")}</TabsTrigger>
          <TabsTrigger value="hours">{t("pages.attendanceHoursTab")}</TabsTrigger>
          {canSeePayroll && <TabsTrigger value="salary">{t("pages.payrollTab")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="log">
          <Card>
            <CardContent className="pt-4">
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.timestamp") ?? "Time"}</TableHead>
                      <TableHead>{t("pages.staff") ?? "Staff"}</TableHead>
                      <TableHead>{t("pages.attendanceTypeColumn")}</TableHead>
                      <TableHead>{t("pages.scheduleLogDetailColumn")}</TableHead>
                      <TableHead>{t("pages.attendanceLocationColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-center">
                          {t("common.loading")}
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-center">
                          {t("pages.noData")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(record.timestamp)}
                          </TableCell>
                          <TableCell>{record.staffName}</TableCell>
                          <TableCell>
                            <Badge variant={typeBadgeVariant(record.type)}>
                              {typeLabel(record.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.selfieUrl ? (
                              <button
                                type="button"
                                className="focus-visible:ring-ring block h-11 w-11 overflow-hidden rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
                                aria-label={t("pages.attendanceSelfieOpen").replace("{name}", record.staffName)}
                                onClick={() => setSelfieIndex(selfies.findIndex((s) => s.id === record.id))}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={record.selfieUrl}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <ImageOff className="text-muted-foreground/40 h-5 w-5" />
                            )}
                          </TableCell>
                          <TableCell>
                            {record.locationLabel ? (
                              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                <span className="max-w-[180px] truncate">
                                  {record.locationLabel}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-1">
                <Label>{t("pages.attendanceStandardHoursLabel")}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      className="w-16"
                      value={hoursValue}
                      onChange={(e) => setHoursInput(e.target.value)}
                    />
                    <span className="text-muted-foreground text-sm">{t("common.time.hoursShort")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      className="w-16"
                      value={minutesValue}
                      onChange={(e) => setMinutesInput(e.target.value)}
                    />
                    <span className="text-muted-foreground text-sm">{t("common.time.minutesShort")}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={saveThreshold}>
                    {t("common.actions.save")}
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground max-w-2xl text-xs">{t("pages.attendanceDifferenceHint")}</p>
              {canSeePayroll ? (
                <div className="flex items-start gap-3 border-t pt-3">
                  <Switch
                    id="overtime-requires-approval"
                    className="mt-1"
                    checked={requiresApproval}
                    disabled={savingApproval || !hoursData}
                    onCheckedChange={toggleApproval}
                  />
                  <div className="min-w-0 space-y-0.5">
                    <Label htmlFor="overtime-requires-approval" className="block min-h-6 cursor-pointer leading-6">
                      {t("pages.overtimeApprovalToggle")}
                    </Label>
                    <p className="text-muted-foreground max-w-2xl text-xs">{t("pages.overtimeApprovalToggleHint")}</p>
                  </div>
                </div>
              ) : (
                requiresApproval && (
                  <p className="text-muted-foreground max-w-2xl border-t pt-3 text-xs">
                    {t("pages.overtimeApprovalOnManagerNote")}
                  </p>
                )
              )}
            </CardContent>
          </Card>

          {requiresApproval && waitingDays.length > 0 && (
            <Card className="border-amber-500/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t("pages.overtimeWaitingSummary")
                      .replace("{count}", String(waitingDays.length))
                      .replace("{hours}", duration(waitingMinutes))}
                  </p>
                  <p className="text-muted-foreground text-xs">{t("pages.overtimeWaitingHint")}</p>
                </div>
                <Button
                  type="button"
                  className="h-11"
                  disabled={approvableDays.length === 0 || deciding !== null}
                  onClick={approveAll}
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  {t("pages.overtimeApproveAll").replace("{count}", String(approvableDays.length))}
                </Button>
              </CardContent>
            </Card>
          )}

          {(hoursData?.missingClockOuts.length ?? 0) > 0 && (
            <Card className="border-amber-500/40">
              <CardContent className="space-y-2 pt-4">
                <p className="text-sm font-medium">{t("pages.attendanceMissingClockOut")}</p>
                {hoursData!.missingClockOuts.map((m) => (
                  <div
                    key={m.attendanceId}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {m.staff?.name ?? m.staffMemberId} — {formatDateTime(m.clockInAt)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startClosing(m.attendanceId, m.clockInAt)}
                    >
                      {t("pages.attendanceManuallyClose")}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <Table className={requiresApproval ? "min-w-[980px]" : "min-w-[820px]"}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date") ?? "Date"}</TableHead>
                      <TableHead>{t("pages.staff") ?? "Staff"}</TableHead>
                      <TableHead>{t("pages.attendanceInOutColumn")}</TableHead>
                      <TableHead>{t("pages.attendanceExpectedColumn")}</TableHead>
                      <TableHead>{t("pages.attendanceWorkedColumn")}</TableHead>
                      <TableHead>{t("pages.attendanceDifferenceColumn")}</TableHead>
                      <TableHead>{t("pages.attendanceOvertimeMinutes")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hoursLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground text-center">
                          {t("common.loading")}
                        </TableCell>
                      </TableRow>
                    ) : visibleDays.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground text-center">
                          {t("pages.noData")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleDays.map((day) => (
                        <TableRow key={`${day.staffMemberId}:${day.date}`}>
                          <TableCell className="whitespace-nowrap">
                            {format(parseLocalISO(day.date), "EEE d MMM", { locale: dateLocale })}
                          </TableCell>
                          <TableCell>{day.staff?.name ?? day.staffMemberId}</TableCell>
                          <TableCell className="text-muted-foreground text-xs tabular-nums">
                            <DayTimes day={day} />
                            {day.hasLongPair && <LongPairWarning />}
                          </TableCell>
                          <TableCell>
                            <span className="tabular-nums">{duration(day.expectedMinutes)}</span>
                            <span className="text-muted-foreground block text-xs">
                              {expectedSourceLabel(day)}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <DayStatus day={day} fallback={duration(day.workedMinutes)} />
                          </TableCell>
                          <TableCell
                            className={`font-medium whitespace-nowrap tabular-nums ${
                              day.differenceMinutes !== null ? differenceTone(day.differenceMinutes) : ""
                            }`}
                          >
                            {day.differenceMinutes !== null ? signedDuration(day.differenceMinutes) : "—"}
                          </TableCell>
                          <TableCell>
                            <OvertimeApprovalCell
                              day={day}
                              isSelf={day.staffMemberId === selfStaffMemberId}
                              busy={deciding !== null}
                              onDecide={(decision) => decideOvertime(day, decision)}
                              onUndo={() => undoOvertime(day)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canSeePayroll && (
          <TabsContent value="salary">
            <PayrollPanel
              storeId={storeId}
              from={from}
              to={to}
              staffId={staffId !== "all" ? staffId : null}
            />
          </TabsContent>
        )}
      </Tabs>

      <SelfiePreviewDialog items={selfies} index={selfieIndex} onIndexChange={setSelfieIndex} />
      {confirmDialog}

      <Dialog open={!!closing} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent className="max-h-[calc(90dvh/var(--app-zoom,1))] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("pages.attendanceManuallyClose")}</DialogTitle>
            <DialogDescription>{t("pages.attendanceCorrectionReasonRequired")}</DialogDescription>
          </DialogHeader>
          {closing && (
            <div className="space-y-1">
              <Label htmlFor="attendance-close-at">{t("pages.attendanceCloseTimeLabel")}</Label>
              <Input
                id="attendance-close-at"
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
              />
              <p className={closeAtValid ? "text-muted-foreground text-xs" : "text-destructive text-xs"}>
                {closeAtValid ? t("pages.attendanceCloseTimeHint") : t("pages.attendanceCloseTimeInvalid")}
              </p>
            </div>
          )}
          <Textarea
            value={correctionNotes}
            onChange={(e) => setCorrectionNotes(e.target.value)}
            rows={3}
            maxLength={500}
            className="min-h-0"
          />
          <Button
            type="button"
            className="h-11 w-full"
            disabled={!correctionNotes.trim() || !closeAtValid}
            onClick={submitCorrection}
          >
            {t("common.actions.save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
