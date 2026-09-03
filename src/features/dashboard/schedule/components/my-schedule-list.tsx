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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecimalInput } from "@/components/shared/decimal-input";
import {
  Banknote,
  CalendarOff,
  LogIn,
  Wallet,
  History as HistoryIcon,
  ImageOff,
  MapPin,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  openShiftSchema,
  closeShiftSchema,
  createCashMovementSchema,
  type OpenShiftInput,
  type CloseShiftInput,
  type CreateCashMovementInput,
} from "@/lib/validation/operations.schemas";
import {
  INBOUND_CASH_MOVEMENT_TYPES,
  OUTBOUND_CASH_MOVEMENT_TYPES,
} from "@/lib/finance/cash-drawer";
import { apiClient } from "@/lib/api/client";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { todayLocalISO } from "@/lib/utils/date-range";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { useRecordCashMovement } from "@/features/pos/hooks/use-cash-movements";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { ClockInOutDialog } from "@/features/dashboard/shared/clock-in-out-dialog";
import type { CashMovementType } from "@prisma/client";
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
  /** A cash movement's reason, or a till session's close-out notes. */
  notes: string | null;
  amount: number | null;
}

// Cash In/Out (till open/close) only makes sense for a role that actually
// runs the register — matches the existing "openingCash is realistically
// cashier-only" rationale (see docs/roadmap.md).
const POS_CAPABLE_ROLES = new Set(["CASHIER", "OWNER", "MANAGER"]);

// Inbound first, then outbound — the picker reads as "money in / money out"
// without a second hand-written list of the five types drifting from the
// direction table in lib/finance/cash-drawer.ts.
const CASH_MOVEMENT_TYPES: CashMovementType[] = [
  ...INBOUND_CASH_MOVEMENT_TYPES,
  ...OUTBOUND_CASH_MOVEMENT_TYPES,
];

export function MyScheduleList({ storeId, staffMemberId }: { storeId: string; staffMemberId: string }) {
  const { t, formatDateTime } = useI18n();
  // Till floats, closing counts and cash-movement amounts are all Shift/
  // CashMovement-derived and already literal in the store's own currency. The
  // bare one-arg formatPrice() defaults `fromCurrency` to IDR and would
  // convert them, re-scaling every amount for any non-IDR store — the same
  // trap operations-card.tsx guards against.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number) => formatPriceRaw(value, currency);
  const queryClient = useQueryClient();
  const posSession = usePosSession();
  const canUseCash = POS_CAPABLE_ROLES.has(posSession.staffRole ?? "");

  const [clockDialogOpen, setClockDialogOpen] = useState(false);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  // The shift just closed, kept so the "View report" link survives the
  // openShift query flipping to null the moment the close succeeds.
  const [closedShiftId, setClosedShiftId] = useState<string | null>(null);

  // Whether closing a till should immediately produce its daily report.
  // Persisted so a cashier who wants the paper every night doesn't re-tick it
  // each shift; the report stays reachable either way (see the link below),
  // so this controls automation, never access.
  const [{ printOnClose }, setPrintOnClose] = usePersistedState(
    `epidom-shift-close-print-${storeId}`,
    { printOnClose: false },
    (raw, defaults) =>
      raw && typeof raw === "object" && typeof (raw as any).printOnClose === "boolean"
        ? { printOnClose: (raw as any).printOnClose }
        : defaults
  );

  const dailyReportHref = (shiftId: string, autoPrint: boolean) =>
    `/store/${storeId}/pos/orders/daily-report?shiftId=${shiftId}${autoPrint ? "" : "&print=0"}`;

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
      // Captured before invalidateShift() clears `openShift` — the report
      // needs the id of the session that was just closed.
      const closedId = openShift!.id;
      setClosedShiftId(closedId);
      invalidateShift();
      setCashDialogOpen(false);
      closeForm.reset({ closingCash: 0 });
      if (printOnClose) {
        // A new tab, not an inline dialog: the report auto-calls
        // window.print(), which would otherwise capture this whole page.
        window.open(dailyReportHref(closedId, true), "_blank");
      }
    },
  });

  // Cash that moves through the drawer outside of sales. Deliberately its own
  // dialog rather than a field on close-till: a paid-out or a safe drop happens
  // mid-shift, and asking a cashier to remember it until close is how the
  // "where did the money go" answer gets lost.
  const movementDefaults: Partial<CreateCashMovementInput> = {
    staffMemberId,
    pin: "",
    type: "TIP",
    amount: undefined,
    reason: "",
  };
  const movementForm = useForm<CreateCashMovementInput>({
    // The very schema the POST route validates with — the reason-required rule
    // for outbound types is stated once and enforced on both sides.
    resolver: zodResolver(createCashMovementSchema),
    defaultValues: movementDefaults,
  });
  const selectedMovementType = movementForm.watch("type");
  const reasonRequired = OUTBOUND_CASH_MOVEMENT_TYPES.includes(selectedMovementType);

  const recordMovement = useRecordCashMovement(storeId);

  // Every close path goes through here. Closing without resetting left the
  // abandoned amount, reason and any red validation errors sitting in the
  // dialog, so the next Cash In / Out — often a different movement entirely —
  // opened pre-filled with the last one's numbers.
  const setMovementDialog = (open: boolean) => {
    setMovementDialogOpen(open);
    if (!open) movementForm.reset(movementDefaults);
  };

  const submitMovement = (values: CreateCashMovementInput) =>
    recordMovement.mutate(
      // Attach the till only when one is actually open. The API rejects a
      // closed session on purpose (it would rewrite a signed-off variance) and
      // accepts no session at all, which is the honest shape for cash moved
      // before the first shift or after the last one.
      { ...values, ...(openShift && { shiftId: openShift.id }) },
      {
        // The hook already refreshes the ledger and the expected-cash surfaces;
        // these two are local to this page's own history list.
        onSuccess: () => {
          toast.success(t("pages.cashMovementSaved"));
          invalidateShift();
          setMovementDialog(false);
        },
        onError: () => toast.error(t("pages.cashMovementFailed")),
      }
    );

  const movementTypeLabel = (type: CashMovementType) => {
    switch (type) {
      case "TIP":
        return t("pages.cashMovementTypeTip");
      case "PETTY_IN":
        return t("pages.cashMovementTypePettyIn");
      case "PETTY_OUT":
        return t("pages.cashMovementTypePettyOut");
      case "DROP":
        return t("pages.cashMovementTypeDrop");
      case "PAYOUT":
        return t("pages.cashMovementTypePayout");
    }
  };

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
        {/* h-10 overrides size="sm"'s 32px: this row is the cashier's
            primary control surface on an iPad, and AGENTS.md sets a 40px
            floor for anything tappable. Applied to the whole row so one
            button isn't taller than its neighbours. */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-10" onClick={() => setClockDialogOpen(true)}>
            <LogIn className="mr-2 h-4 w-4" />
            {t("pages.scheduleClockInOut")}
          </Button>
          {canUseCash && (
            <Button size="sm" variant="outline" className="h-10" onClick={() => setCashDialogOpen(true)}>
              <Wallet className="mr-2 h-4 w-4" />
              {openShift ? t("pages.closeShift") : t("pages.openShift")}
            </Button>
          )}
          {canUseCash && (
            <Button size="sm" variant="outline" className="h-10" onClick={() => setMovementDialogOpen(true)}>
              <Banknote className="mr-2 h-4 w-4" />
              {t("pages.cashMovementRecord")}
            </Button>
          )}
          {/* Survives the close: `openShift` goes null immediately, but the
              cashier still needs one click to the report they just generated
              (or to reach it if the print-on-close toggle was off). */}
          {canUseCash && !openShift && closedShiftId && (
            <Button
              size="sm"
              variant="outline"
              className="h-10"
              onClick={() => window.open(dailyReportHref(closedShiftId, false), "_blank")}
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              {t("pages.shiftViewReport")}
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
                  {/* The reason a cash movement was recorded — the part a
                      cashier double-checks when their drawer doesn't balance. */}
                  {record.notes && (
                    <p className="text-muted-foreground line-clamp-2 text-[11px] break-words">
                      {record.notes}
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
        <Dialog open={movementDialogOpen} onOpenChange={setMovementDialog}>
          <FormDialogLayout
            title={t("pages.cashMovementTitle")}
            description={t("pages.cashMovementDesc")}
            footer={
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => setMovementDialog(false)}
                >
                  {t("common.actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  form="my-cash-movement-form"
                  className="flex-1 sm:flex-none"
                  disabled={recordMovement.isPending}
                >
                  {t("pages.cashMovementSubmit")}
                </Button>
              </>
            }
          >
            <form
              id="my-cash-movement-form"
              onSubmit={movementForm.handleSubmit(submitMovement)}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="my-movement-type">{t("pages.cashMovementType")}</Label>
                <Controller
                  control={movementForm.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="my-movement-type" className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CASH_MOVEMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type} className="min-h-10">
                            {movementTypeLabel(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="my-movement-amount">{t("pages.cashMovementAmount")}</Label>
                <Controller
                  control={movementForm.control}
                  name="amount"
                  render={({ field }) => (
                    <DecimalInput
                      id="my-movement-amount"
                      className="h-11"
                      decimals={2}
                      // Always positive: direction comes from the type above,
                      // so a minus sign here would double-negate a paid-out.
                      min={0}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  )}
                />
                {movementForm.formState.errors.amount && (
                  <p className="text-destructive text-xs">{t("common.validation.positive")}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="my-movement-reason">
                  {t("pages.cashMovementReason")}
                  {reasonRequired && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <Textarea
                  id="my-movement-reason"
                  rows={2}
                  maxLength={500}
                  className="min-h-0"
                  placeholder={t("pages.cashMovementReasonPlaceholder")}
                  {...movementForm.register("reason")}
                />
                {/* The schema raises this for the outbound types; the server
                    re-raises it, so the client is a courtesy, not the guard. */}
                {movementForm.formState.errors.reason && (
                  <p className="text-destructive text-xs">
                    {t("pages.cashMovementReasonRequired")}
                  </p>
                )}
              </div>
            </form>
          </FormDialogLayout>
        </Dialog>
      )}

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

                <div className="flex items-center justify-between gap-3 border-t pt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="my-print-on-close" className="text-sm font-medium">
                      {t("pages.shiftPrintReportOnClose")}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {t("pages.shiftPrintReportOnCloseDesc")}
                    </p>
                  </div>
                  <Switch
                    id="my-print-on-close"
                    checked={printOnClose}
                    onCheckedChange={(checked) => setPrintOnClose({ printOnClose: checked })}
                  />
                </div>

                {/* Reachable mid-shift too — a cashier can sanity-check the
                    numbers before committing the closing cash count. */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => window.open(dailyReportHref(openShift.id, false), "_blank")}
                >
                  <ReceiptText className="h-3.5 w-3.5" />
                  {t("pages.shiftViewReport")}
                </Button>
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
