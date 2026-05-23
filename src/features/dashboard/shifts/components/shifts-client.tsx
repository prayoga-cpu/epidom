"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  openShiftSchema,
  closeShiftSchema,
  type OpenShiftInput,
  type CloseShiftInput,
} from "@/lib/validation/operations.schemas";
import { apiClient } from "@/lib/api/client";
import { Clock, Plus, X } from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/utils/formatting";

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

interface ShiftsClientProps {
  storeId: string;
  staff: StaffMember[];
}

export function ShiftsClient({ storeId, staff }: ShiftsClientProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [openOpen, setOpenOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<Shift | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shifts", storeId],
    queryFn: () => apiClient.get<{ shifts: Shift[]; total: number }>(`/api/stores/${storeId}/shifts`),
  });

  const shifts = data?.shifts ?? [];
  const openShift = shifts.find((s) => !s.closedAt);

  const openForm = useForm<OpenShiftInput>({
    resolver: zodResolver(openShiftSchema),
    defaultValues: { openingCash: 0 },
  });

  const closeForm = useForm<CloseShiftInput>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: { closingCash: 0 },
  });

  const openMutation = useMutation({
    mutationFn: (body: OpenShiftInput) =>
      apiClient.post(`/api/stores/${storeId}/shifts`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", storeId] });
      setOpenOpen(false);
      openForm.reset();
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ shiftId, body }: { shiftId: string; body: CloseShiftInput }) =>
      apiClient.patch(`/api/stores/${storeId}/shifts/${shiftId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", storeId] });
      setCloseTarget(null);
      closeForm.reset();
    },
  });

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("pages.shiftsTitle")}</h1>
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

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <div className="min-w-[520px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("pages.openingCash")}</TableHead>
                <TableHead>{t("pages.closingCash")}</TableHead>
                <TableHead>{t("pages.cashDifference")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    {t("common.loading")}
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
                    <TableCell>{formatCurrency(Number(shift.openingCash))}</TableCell>
                    <TableCell>
                      {shift.closingCash ? formatCurrency(Number(shift.closingCash)) : "—"}
                    </TableCell>
                    <TableCell>
                      {shift.cashDifference != null ? (
                        <span
                          className={
                            Number(shift.cashDifference) < 0
                              ? "text-destructive"
                              : "text-green-600"
                          }
                        >
                          {Number(shift.cashDifference) >= 0 ? "+" : ""}
                          {formatCurrency(Number(shift.cashDifference))}
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
              <Label>{t("nav.staff")}</Label>
              <Select onValueChange={(v) => openForm.setValue("staffId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("nav.staff")} />
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
              <Input
                id="openingCash"
                type="number"
                min={0}
                step={1000}
                {...openForm.register("openingCash", { valueAsNumber: true })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenOpen(false)}>
                {t("common.cancel")}
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
                <Input
                  id="closingCash"
                  type="number"
                  min={0}
                  step={1000}
                  {...closeForm.register("closingCash", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">{t("common.notes")}</Label>
                <Input id="notes" {...closeForm.register("notes")} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCloseTarget(null)}>
                  {t("common.cancel")}
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
