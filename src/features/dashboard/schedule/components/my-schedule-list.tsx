"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/shared/decimal-input";
import {
  CalendarOff,
  LogIn,
  Wallet,
  History as HistoryIcon,
  ImageOff,
  MapPin,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  openShiftSchema,
  closeShiftSchema,
  type OpenShiftInput,
  type CloseShiftInput,
} from "@/lib/validation/operations.schemas";
import { apiClient } from "@/lib/api/client";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { todayLocalISO } from "@/lib/utils/date-range";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { ClockInOutDialog } from "@/features/dashboard/shared/clock-in-out-dialog";
import type { StaffScheduleEntry } from "./staff-schedule-cell-dialog";

interface MySchedule extends StaffScheduleEntry {
  scheduleShift: { name: string; startTime: string; endTime: string; color: string | null } | null;
}

interface ShiftRow {
  id: string;
  closedAt: string | null;
}

interface UnifiedLogRow {
  id: string;
  timestamp: string;
  type: "CLOCK_IN" | "CLOCK_OUT" | "ABSENCE" | "CASH_IN" | "CASH_OUT";
  selfieUrl: string | null;
  locationLabel: string | null;
  amount: number | null;
}

// Cash In/Out (till open/close) only makes sense for a role that actually
// runs the register — matches the existing "openingCash is realistically
// cashier-only" rationale (see docs/roadmap.md).
const POS_CAPABLE_ROLES = new Set(["CASHIER", "OWNER", "MANAGER"]);

export function MyScheduleList({ storeId, staffMemberId }: { storeId: string; staffMemberId: string }) {
  const { t, formatDateTime } = useI18n();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const posSession = usePosSession();
  const canUseCash = POS_CAPABLE_ROLES.has(posSession.staffRole ?? "");

  const [clockDialogOpen, setClockDialogOpen] = useState(false);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-schedules", storeId, "mine", staffMemberId],
    queryFn: () =>
      apiClient.get<{ schedules: MySchedule[] }>(`/stores/${storeId}/staff-schedules`, {
        staffId: staffMemberId,
        from: todayLocalISO(),
      }),
  });
  const upcoming = (data?.schedules ?? []).filter((s) => s.date >= todayLocalISO());
  const today = todayLocalISO();

  const { data: shiftData } = useQuery({
    queryKey: ["my-shift", storeId, staffMemberId],
    queryFn: () =>
      apiClient.get<{ shifts: ShiftRow[] }>(`/stores/${storeId}/shifts`, {
        staffId: staffMemberId,
        take: "1",
      }),
    enabled: canUseCash,
  });
  const openShift = shiftData?.shifts.find((s) => !s.closedAt) ?? null;

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["schedule-my-log", storeId, staffMemberId],
    queryFn: () =>
      apiClient.get<{ records: UnifiedLogRow[] }>(`/stores/${storeId}/schedule/my-log`, {
        staffId: staffMemberId,
      }),
  });

  const invalidateShift = () => {
    queryClient.invalidateQueries({ queryKey: ["my-shift", storeId, staffMemberId] });
    queryClient.invalidateQueries({ queryKey: ["schedule-my-log", storeId, staffMemberId] });
  };

  const openForm = useForm<OpenShiftInput>({
    resolver: zodResolver(openShiftSchema),
    defaultValues: { staffId: staffMemberId, pin: "", openingCash: 0 },
  });
  const closeForm = useForm<CloseShiftInput>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: { closingCash: 0 },
  });

  const openMutation = useMutation({
    mutationFn: (body: OpenShiftInput) => apiClient.post(`/stores/${storeId}/shifts`, body),
    onSuccess: () => {
      invalidateShift();
      setCashDialogOpen(false);
      openForm.reset({ staffId: staffMemberId, pin: "", openingCash: 0 });
    },
  });
  const closeMutation = useMutation({
    mutationFn: (body: CloseShiftInput) =>
      apiClient.patch(`/stores/${storeId}/shifts/${openShift!.id}`, body),
    onSuccess: () => {
      invalidateShift();
      setCashDialogOpen(false);
      closeForm.reset({ closingCash: 0 });
    },
  });

  const typeLabel = (type: UnifiedLogRow["type"]) => {
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

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("pages.scheduleMyScheduleTitle")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setClockDialogOpen(true)}>
            <LogIn className="mr-2 h-4 w-4" />
            {t("pages.scheduleClockInOut")}
          </Button>
          {canUseCash && (
            <Button size="sm" variant="outline" onClick={() => setCashDialogOpen(true)}>
              <Wallet className="mr-2 h-4 w-4" />
              {openShift ? t("pages.closeShift") : t("pages.openShift")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : upcoming.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("pages.scheduleNoPublishedSchedule")}</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((entry) => (
            <Card key={entry.id} className={entry.date === today ? "border-primary/50" : undefined}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {entry.date}
                    {entry.date === today && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                        {t("pages.scheduleToday")}
                      </Badge>
                    )}
                  </p>
                  {entry.isDayOff ? (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <CalendarOff className="h-3.5 w-3.5" />
                      {t("pages.scheduleDayOffOn")}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {entry.scheduleShift
                        ? `${entry.scheduleShift.name} (${entry.scheduleShift.startTime}–${entry.scheduleShift.endTime})`
                        : `${entry.customStartTime}–${entry.customEndTime}`}
                    </p>
                  )}
                </div>
                {entry.department && <Badge variant="secondary">{entry.department}</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <HistoryIcon className="h-4 w-4" />
          {t("pages.scheduleMyHistoryTitle")}
        </h2>
        {historyLoading ? (
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        ) : (historyData?.records.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">{t("pages.noData")}</p>
        ) : (
          <div className="space-y-2">
            {historyData!.records.map((record) => (
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
                    <ImageOff className="text-muted-foreground/40 h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{typeLabel(record.type)}</p>
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
                {record.amount != null && (
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {formatPrice(record.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ClockInOutDialog open={clockDialogOpen} onOpenChange={setClockDialogOpen} storeId={storeId} />

      {canUseCash && (
        <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
          {openShift ? (
            <FormDialogLayout
              title={t("pages.closeShift")}
              footer={
                <>
                  <Button type="button" variant="outline" onClick={() => setCashDialogOpen(false)}>
                    {t("common.actions.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    form="my-close-shift-form"
                    variant="destructive"
                    disabled={closeMutation.isPending}
                  >
                    {t("pages.closeShift")}
                  </Button>
                </>
              }
            >
              <form
                id="my-close-shift-form"
                onSubmit={closeForm.handleSubmit((data) => closeMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <Label htmlFor="my-closingCash">{t("pages.closingCash")}</Label>
                  <Controller
                    control={closeForm.control}
                    name="closingCash"
                    render={({ field }) => (
                      <DecimalInput
                        id="my-closingCash"
                        decimals={2}
                        min={0}
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="my-notes">Notes</Label>
                  <Input id="my-notes" {...closeForm.register("notes")} />
                </div>
              </form>
            </FormDialogLayout>
          ) : (
            <FormDialogLayout
              title={t("pages.openShift")}
              footer={
                <>
                  <Button type="button" variant="outline" onClick={() => setCashDialogOpen(false)}>
                    {t("common.actions.cancel")}
                  </Button>
                  <Button type="submit" form="my-open-shift-form" disabled={openMutation.isPending}>
                    {t("pages.openShift")}
                  </Button>
                </>
              }
            >
              <form
                id="my-open-shift-form"
                onSubmit={openForm.handleSubmit((data) => openMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <Label htmlFor="my-openingCash">{t("pages.openingCash")}</Label>
                  <Controller
                    control={openForm.control}
                    name="openingCash"
                    render={({ field }) => (
                      <DecimalInput
                        id="my-openingCash"
                        decimals={2}
                        min={0}
                        value={field.value}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    )}
                  />
                </div>
              </form>
            </FormDialogLayout>
          )}
        </Dialog>
      )}
    </div>
  );
}
