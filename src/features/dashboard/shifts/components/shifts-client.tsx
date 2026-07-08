"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { Label } from "@/components/ui/label";
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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  openShiftSchema,
  closeShiftSchema,
  type OpenShiftInput,
  type CloseShiftInput,
} from "@/lib/validation/operations.schemas";
import { apiClient } from "@/lib/api/client";
import { Clock, Plus, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatDateTime } from "@/lib/utils/formatting";

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface Shift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  closingCash: string | null;
  expectedCash: string | null;
  cashDifference: string | null;
  notes: string | null;
  staffMember: StaffMember;
  _count: { orders: number };
}

type SortField = "date" | "name" | "openingCash";
type SortDir = "asc" | "desc";

interface ShiftsClientProps {
  storeId: string;
  staff: StaffMember[];
}

function SortIcon({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
  );
}

export function ShiftsClient({ storeId, staff }: ShiftsClientProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const queryClient = useQueryClient();
  const [openOpen, setOpenOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<Shift | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["shifts", storeId],
    queryFn: () => apiClient.get<{ shifts: Shift[]; total: number }>(`/stores/${storeId}/shifts`),
  });

  const rawShifts = data?.shifts ?? [];
  const openShift = rawShifts.find((s) => !s.closedAt);

  const shifts = useMemo(() => {
    const sorted = [...rawShifts].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime();
      } else if (sortField === "name") {
        cmp = a.staffMember.name.localeCompare(b.staffMember.name);
      } else if (sortField === "openingCash") {
        cmp = Number(a.openingCash) - Number(b.openingCash);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rawShifts, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const openForm = useForm<OpenShiftInput>({
    resolver: zodResolver(openShiftSchema),
    defaultValues: { openingCash: 0 },
  });

  const closeForm = useForm<CloseShiftInput>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: { closingCash: 0 },
  });

  const openMutation = useMutation({
    mutationFn: (body: OpenShiftInput) => apiClient.post(`/stores/${storeId}/shifts`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", storeId] });
      setOpenOpen(false);
      openForm.reset();
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ shiftId, body }: { shiftId: string; body: CloseShiftInput }) =>
      apiClient.patch(`/stores/${storeId}/shifts/${shiftId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", storeId] });
      setCloseTarget(null);
      closeForm.reset();
    },
  });

  const fmtCash = (val: string | number | null) => (val != null ? formatPrice(Number(val)) : "—");

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("pages.shiftsTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pages.shiftsDesc")}</p>
        </div>
        {!openShift && (
          <Button size="sm" onClick={() => setOpenOpen(true)} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            {t("pages.openShift")}
          </Button>
        )}
        {openShift && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setCloseTarget(openShift)}
            className="shrink-0"
          >
            <X className="mr-2 h-4 w-4" />
            {t("pages.closeShift")}
          </Button>
        )}
      </div>

      {/* Mobile/Tablet: Card Layout */}
      <div className="space-y-3 lg:hidden">
        {isLoading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
        ) : shifts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Clock className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t("pages.openShift")}</p>
          </div>
        ) : (
          shifts.map((shift) => (
            <div key={shift.id} className="bg-muted/50 space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{shift.staffMember.name}</p>
                  <p className="text-muted-foreground text-xs">{formatDateTime(shift.openedAt)}</p>
                </div>
                <Badge variant={shift.closedAt ? "outline" : "default"}>
                  {shift.closedAt ? t("pages.shiftClosed") : t("pages.shiftOpen")}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("pages.openingCash")}</span>
                <span>{fmtCash(shift.openingCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("pages.closingCash")}</span>
                <span>{fmtCash(shift.closingCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("pages.cashDifference")}</span>
                {shift.cashDifference != null ? (
                  <span
                    className={
                      Number(shift.cashDifference) < 0 ? "text-destructive" : "text-green-600"
                    }
                  >
                    {Number(shift.cashDifference) >= 0 ? "+" : ""}
                    {fmtCash(shift.cashDifference)}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table Layout */}
      <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
        <div className="min-w-[560px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    className="hover:text-foreground flex items-center font-semibold"
                    onClick={() => toggleSort("name")}
                  >
                    {t("common.name")}
                    <SortIcon field="name" active={sortField === "name"} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="hover:text-foreground flex items-center font-semibold"
                    onClick={() => toggleSort("openingCash")}
                  >
                    {t("pages.openingCash")}
                    <SortIcon
                      field="openingCash"
                      active={sortField === "openingCash"}
                      dir={sortDir}
                    />
                  </button>
                </TableHead>
                <TableHead>{t("pages.closingCash")}</TableHead>
                <TableHead>{t("pages.cashDifference")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <button
                    className="hover:text-foreground flex items-center font-semibold"
                    onClick={() => toggleSort("date")}
                  >
                    Date
                    <SortIcon field="date" active={sortField === "date"} dir={sortDir} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="text-muted-foreground h-8 w-8" />
                      <p className="text-muted-foreground text-sm">{t("pages.openShift")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{shift.staffMember.name}</TableCell>
                    <TableCell>{fmtCash(shift.openingCash)}</TableCell>
                    <TableCell>{fmtCash(shift.closingCash)}</TableCell>
                    <TableCell>
                      {shift.cashDifference != null ? (
                        <span
                          className={
                            Number(shift.cashDifference) < 0 ? "text-destructive" : "text-green-600"
                          }
                        >
                          {Number(shift.cashDifference) >= 0 ? "+" : ""}
                          {fmtCash(shift.cashDifference)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={shift.closedAt ? "outline" : "default"}>
                        {shift.closedAt ? t("pages.shiftClosed") : t("pages.shiftOpen")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(shift.openedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Open Shift Dialog */}
      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.openShift")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={openForm.handleSubmit((data) => openMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label>Staff</Label>
              <Select onValueChange={(v) => openForm.setValue("staffId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pin">{t("pages.staffPin")}</Label>
              <Input
                id="pin"
                type="password"
                maxLength={4}
                inputMode="numeric"
                {...openForm.register("pin")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openingCash">{t("pages.openingCash")}</Label>
              <Controller
                control={openForm.control}
                name="openingCash"
                render={({ field }) => (
                  <DecimalInput
                    id="openingCash"
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenOpen(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={openMutation.isPending}>
                {t("pages.openShift")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      {closeTarget && (
        <Dialog open={!!closeTarget} onOpenChange={() => setCloseTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.closeShift")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={closeForm.handleSubmit((data) =>
                closeMutation.mutate({ shiftId: closeTarget.id, body: data })
              )}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="closingCash">{t("pages.closingCash")}</Label>
                <Controller
                  control={closeForm.control}
                  name="closingCash"
                  render={({ field }) => (
                    <DecimalInput
                      id="closingCash"
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
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" {...closeForm.register("notes")} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCloseTarget(null)}>
                  {t("common.actions.cancel")}
                </Button>
                <Button type="submit" variant="destructive" disabled={closeMutation.isPending}>
                  {t("pages.closeShift")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
