"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
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
import { apiClient } from "@/lib/api/client";
import { todayLocalISO, startOfMonthLocalISO } from "@/lib/utils/date-range";
import { formatDateTime } from "@/lib/utils/formatting";
import { toast } from "sonner";
import { MapPin, ImageOff, Printer } from "lucide-react";
import { DateRangeField } from "@/components/ui/date-range-field";
import type { StaffRole } from "@prisma/client";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
}

type LogType = "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE" | "CASH_IN" | "CASH_OUT";

interface UnifiedLogRow {
  id: string;
  timestamp: string;
  staffMemberId: string;
  staffName: string;
  type: LogType;
  selfieUrl: string | null;
  locationLabel: string | null;
  notes: string | null;
  amount: number | null;
}

interface DailyHoursRow {
  staffMemberId: string;
  staff: StaffOption | null;
  date: string;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
}

interface MissingClockOutRow {
  attendanceId: string;
  staffMemberId: string;
  staff: StaffOption | null;
  clockInAt: string;
  isOpen: boolean;
}

/**
 * The Schedule page's manager-facing Log & History section — absorbs what
 * used to be the standalone /attendance page's Log + Hours tabs and the
 * /shifts page's cash-reconciliation table into one place, since a manager
 * monitoring "who did what, when" wants clock events and till cash events
 * on the same timeline, not two separate pages.
 */
export function ScheduleLog({ storeId, staff }: { storeId: string; staff: StaffOption[] }) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(startOfMonthLocalISO());
  const [to, setTo] = useState(todayLocalISO());
  const [staffId, setStaffId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"log" | "hours">("log");

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ["schedule-log", storeId, from, to, staffId, typeFilter],
    queryFn: () =>
      apiClient.get<{ records: UnifiedLogRow[] }>(`/stores/${storeId}/schedule/log`, {
        from: new Date(from).toISOString(),
        to: new Date(new Date(to).getTime() + 86_400_000 - 1).toISOString(),
        ...(staffId !== "all" && { staffId }),
        ...(typeFilter !== "all" && { type: typeFilter }),
      }),
  });

  const { data: hoursData, isLoading: hoursLoading } = useQuery({
    queryKey: ["attendance-hours", storeId, from, to, staffId],
    queryFn: () =>
      apiClient.get<{
        dailyRows: DailyHoursRow[];
        missingClockOuts: MissingClockOutRow[];
        standardWorkMinutesPerDay: number;
      }>(`/stores/${storeId}/attendance/hours`, {
        from,
        to,
        ...(staffId !== "all" && { staffId }),
      }),
  });

  const [hoursInput, setHoursInput] = useState<string>("");
  const [minutesInput, setMinutesInput] = useState<string>("");

  // "Standard work minutes per day" is a duration (e.g. 8h 0m), not a time
  // of day — the fields below are hours/minutes counters, not a wall-clock
  // picker, so there's no AM/PM to misread.
  const standardMinutes = hoursData?.standardWorkMinutesPerDay ?? 480;
  const hoursValue = hoursInput !== "" ? hoursInput : String(Math.floor(standardMinutes / 60));
  const minutesValue = minutesInput !== "" ? minutesInput : String(standardMinutes % 60);

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
      queryClient.invalidateQueries({ queryKey: ["attendance-hours", storeId] });
    } catch {
      toast.error(t("common.error"));
    }
  };

  const openPrintView = () => {
    const params = new URLSearchParams({ from, to, tab: activeTab });
    if (staffId !== "all") params.set("staffId", staffId);
    window.open(`/store/${storeId}/attendance/print?${params.toString()}`, "_blank");
  };

  const submitCorrection = async () => {
    if (!closingId || !correctionNotes.trim()) return;
    try {
      await apiClient.post(`/stores/${storeId}/attendance/${closingId}/close`, {
        notes: correctionNotes,
      });
      toast.success(t("pages.attendanceCorrectionSaved"));
      setClosingId(null);
      setCorrectionNotes("");
      queryClient.invalidateQueries({ queryKey: ["attendance-hours", storeId] });
      queryClient.invalidateQueries({ queryKey: ["schedule-log", storeId] });
    } catch {
      toast.error(t("common.error"));
    }
  };

  const typeLabel = (type: LogType) => {
    switch (type) {
      case "CLOCK_IN":
        return t("clockInOut.typeClockIn");
      case "CLOCK_OUT":
        return t("clockInOut.typeClockOut");
      case "ABSENCE":
        return t("clockInOut.typeAbsence");
      case "CASH_IN":
        return t("clockInOut.typeCashIn");
      case "CASH_OUT":
        return t("clockInOut.typeCashOut");
    }
  };

  const typeBadgeVariant = (type: LogType): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "ABSENCE":
        return "destructive";
      case "CLOCK_IN":
      case "CASH_IN":
        return "default";
      default:
        return "secondary";
    }
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
                <SelectItem value="CASH_IN">{t("clockInOut.typeCashIn")}</SelectItem>
                <SelectItem value="CASH_OUT">{t("clockInOut.typeCashOut")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "log" | "hours")}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="log">{t("pages.attendanceLogTab")}</TabsTrigger>
          <TabsTrigger value="hours">{t("pages.attendanceHoursTab")}</TabsTrigger>
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
                    ) : (logData?.records.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-center">
                          {t("pages.noData")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      logData!.records.map((record) => (
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
                            {record.type === "CASH_IN" || record.type === "CASH_OUT" ? (
                              record.amount != null ? (
                                formatPrice(record.amount)
                              ) : (
                                "—"
                              )
                            ) : record.selfieUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={record.selfieUrl}
                                alt=""
                                className="h-10 w-10 rounded-md object-cover"
                              />
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
            <CardContent className="flex flex-wrap items-end gap-3 pt-4">
              <div className="space-y-1">
                <Label>{t("pages.attendanceStandardHoursLabel")}</Label>
                <div className="flex items-center gap-2">
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
            </CardContent>
          </Card>

          {(hoursData?.missingClockOuts.length ?? 0) > 0 && (
            <Card className="border-amber-500/40">
              <CardContent className="space-y-2 pt-4">
                <p className="text-sm font-medium">{t("pages.attendanceMissingClockOut")}</p>
                {hoursData!.missingClockOuts.map((m, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {m.staff?.name ?? m.staffMemberId} — {formatDateTime(m.clockInAt)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setClosingId(m.attendanceId)}
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
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date") ?? "Date"}</TableHead>
                      <TableHead>{t("pages.staff") ?? "Staff"}</TableHead>
                      <TableHead>{t("pages.attendanceRegularMinutes")}</TableHead>
                      <TableHead>{t("pages.attendanceOvertimeMinutes")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hoursLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground text-center">
                          {t("common.loading")}
                        </TableCell>
                      </TableRow>
                    ) : (hoursData?.dailyRows.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground text-center">
                          {t("pages.noData")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      hoursData!.dailyRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.staff?.name ?? row.staffMemberId}</TableCell>
                          <TableCell>{formatMinutes(row.regularMinutes)}</TableCell>
                          <TableCell>
                            {row.overtimeMinutes > 0 ? (
                              <Badge variant="secondary">{formatMinutes(row.overtimeMinutes)}</Badge>
                            ) : (
                              "—"
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
      </Tabs>

      <Dialog open={!!closingId} onOpenChange={(open) => !open && setClosingId(null)}>
        <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("pages.attendanceManuallyClose")}</DialogTitle>
            <DialogDescription>{t("pages.attendanceCorrectionReasonRequired")}</DialogDescription>
          </DialogHeader>
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
            disabled={!correctionNotes.trim()}
            onClick={submitCorrection}
          >
            {t("common.actions.save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
