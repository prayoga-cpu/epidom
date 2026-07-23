"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { storefrontApi } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TableStatusBadge } from "./table-status-badge";
import { TableCreateDialog } from "./table-create-dialog";
import { QrCodeDialog } from "@/components/shared/qr-code-dialog";
import { downloadDataUrl } from "@/lib/utils/export";
import { useI18n } from "@/components/lang/i18n-provider";
import { QRCodeCanvas } from "qrcode.react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  CalendarClock,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  StickyNote,
  Loader2,
  QrCode,
  Download,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TableStatus, ReservationStatus } from "@prisma/client";

interface TableData {
  id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  reservationEnabled: boolean;
  orders?: Array<{ id: string; orderNumber: string; status: string; total: unknown }>;
  _count?: { reservations: number };
}

interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  partySize: number;
  scheduledAt: string;
  notes: string | null;
  status: ReservationStatus;
  table: { id: string; label: string; capacity: number } | null;
}

const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 border-amber-400/40",
  CONFIRMED: "bg-emerald-500/15 text-emerald-700 border-emerald-400/40",
  CANCELLED: "bg-red-500/15 text-red-700 border-red-400/40",
  COMPLETED: "bg-slate-500/15 text-slate-700 border-slate-400/40",
};

interface TablesManagerProps {
  storeId: string;
}

export function TablesManager({ storeId }: TablesManagerProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTable, setEditTable] = useState<TableData | null>(null);
  const [deleteTable, setDeleteTable] = useState<TableData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reservationsTable, setReservationsTable] = useState<TableData | null>(null);
  const [qrTable, setQrTable] = useState<TableData | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const bulkCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const { data, isLoading } = useQuery({
    queryKey: ["tables", storeId],
    queryFn: async () => apiClient.get<TableData[]>(`/stores/${storeId}/tables`),
  });

  const tables: TableData[] = data ?? [];

  const { data: storefront } = useQuery({
    queryKey: ["storefront", storeId],
    queryFn: () => storefrontApi.getStorefront(storeId),
  });

  const tableOrderUrl = (label: string) => {
    const domain = typeof window !== "undefined" ? window.location.origin : "";
    return `${domain}/@${storefront?.slug ?? ""}/menu?table=${encodeURIComponent(label)}`;
  };

  const handleBulkDownload = () => {
    if (tables.length === 0) return;
    setIsBulkGenerating(true);
    try {
      const qrSize = 200;
      const padding = 24;
      const labelHeight = 32;
      const cellW = qrSize + padding * 2;
      const cellH = qrSize + padding * 2 + labelHeight;
      const cols = Math.min(4, tables.length);
      const rows = Math.ceil(tables.length / cols);

      const sheet = document.createElement("canvas");
      sheet.width = cols * cellW;
      sheet.height = rows * cellH;
      const ctx = sheet.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.font = "600 18px sans-serif";

      tables.forEach((table, i) => {
        const canvas = bulkCanvasRefs.current.get(table.id);
        if (!canvas) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellW + padding;
        const y = row * cellH + padding;
        ctx.drawImage(canvas, x, y, qrSize, qrSize);
        ctx.fillText(table.label, x + qrSize / 2, y + qrSize + labelHeight / 2 + 6);
      });

      downloadDataUrl(sheet.toDataURL("image/png"), "table-qr-codes.png");
    } finally {
      setIsBulkGenerating(false);
    }
  };

  // Reservations for the selected table
  const { data: resData, isLoading: resLoading } = useQuery({
    queryKey: ["reservations", storeId, reservationsTable?.id],
    queryFn: () =>
      apiClient.get<{ reservations: Reservation[] }>(
        `/stores/${storeId}/reservations${reservationsTable ? `?tableId=${reservationsTable.id}` : ""}`
      ),
    enabled: !!reservationsTable,
  });

  const reservations = resData?.reservations ?? [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      apiClient.patch(`/stores/${storeId}/reservations/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", storeId] });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
    },
    onError: () => toast.error("Failed to update reservation"),
  });

  const deleteReservationMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/stores/${storeId}/reservations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", storeId] });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success("Reservation removed");
    },
    onError: () => toast.error("Failed to remove reservation"),
  });

  const handleStatusChange = async (table: TableData, status: TableStatus) => {
    try {
      await apiClient.patch(`/stores/${storeId}/tables/${table.id}`, { status });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success(`${table.label} ${t("pos.tables.statusUpdated")}`);
    } catch {
      toast.error(t("pos.tables.updateFailed"));
    }
  };

  const handleReservationToggle = async (table: TableData, enabled: boolean) => {
    try {
      await apiClient.patch(`/stores/${storeId}/tables/${table.id}`, {
        reservationEnabled: enabled,
      });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success(
        enabled ? `${table.label} accepts reservations` : `${table.label} reservations disabled`
      );
    } catch {
      toast.error("Failed to update reservation setting");
    }
  };

  const handleDelete = async () => {
    if (!deleteTable) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/stores/${storeId}/tables/${deleteTable.id}`);
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success(`${t("common.actions.delete")} ${deleteTable.label}`);
      setDeleteTable(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? t("pos.tables.deleteFailed");
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const STATUS_CYCLE: TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];
  const nextStatus = (current: TableStatus): TableStatus =>
    STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];

  if (isLoading) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-40 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-3 pt-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:pb-4">
        <p className="text-muted-foreground text-sm">
          {tables.length} {t("pos.tables.countHint")}
        </p>
        <div className="flex items-center gap-2">
          {tables.length > 0 && (
            <Button
              onClick={handleBulkDownload}
              size="sm"
              variant="outline"
              disabled={isBulkGenerating}
              className="flex-1 sm:flex-none"
            >
              <Download className="mr-2 h-4 w-4" />
              {t("pos.tables.downloadAllQr")}
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)} size="sm" className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            {t("pos.tables.add")}
          </Button>
        </div>
      </div>

      {/* Off-screen QR canvases used to composite the bulk download sheet */}
      <div aria-hidden className="pointer-events-none absolute -top-[9999px] -left-[9999px]">
        {tables.map((table) => (
          <QRCodeCanvas
            key={table.id}
            ref={(el) => {
              if (el) bulkCanvasRefs.current.set(table.id, el);
              else bulkCanvasRefs.current.delete(table.id);
            }}
            value={tableOrderUrl(table.label)}
            size={200}
            level="M"
          />
        ))}
      </div>

      {tables.length === 0 ? (
        <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-4">
          <div className="bg-muted rounded-full p-6">
            <Users className="h-10 w-10 opacity-40" />
          </div>
          <p className="text-foreground text-lg font-medium">{t("pos.tables.empty")}</p>
          <p className="text-sm">{t("pos.tables.emptyDesc")}</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("pos.tables.addFirst")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:pb-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map((table) => {
            const activeOrder = table.orders?.[0];
            const pendingReservations = table._count?.reservations ?? 0;
            return (
              <div
                key={table.id}
                // border (not border-2) on mobile: the color itself is the
                // status signal (available/occupied/reserved/other), not
                // decoration, so it stays — just thinner until sm:, where
                // the full border-2 + shadow look returns.
                className={`group relative flex flex-col rounded-xl border transition-all sm:border-2 sm:shadow-sm sm:hover:shadow-md ${
                  table.status === "AVAILABLE"
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : table.status === "OCCUPIED"
                      ? "border-red-500/40 bg-red-500/5"
                      : table.status === "RESERVED"
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-blue-500/40 bg-blue-500/5"
                }`}
              >
                {/* Action icons — a normal-flow row above the status button
                    (not absolutely positioned over it): an absolute overlay
                    here didn't reserve any clearance in the button below it,
                    so the table label and these icons collided/overlapped on
                    narrower cards. A real row can't collide with its own
                    sibling. Visible by default (not hover-only): a
                    hover-gated opacity-0 leaves these permanently
                    unreachable on touch devices, which have no persistent
                    hover state. */}
                <div className="flex items-center justify-end gap-0.5 px-1 pt-1 opacity-70 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setQrTable(table)}
                    className="hover:bg-background/60 flex h-9 w-9 touch-manipulation items-center justify-center rounded"
                    title={t("pos.tables.showQr")}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditTable(table)}
                    className="hover:bg-background/60 flex h-9 w-9 touch-manipulation items-center justify-center rounded"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTable(table)}
                    className="text-destructive hover:bg-background/60 flex h-9 w-9 touch-manipulation items-center justify-center rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Clickable status area */}
                <button
                  onClick={() => handleStatusChange(table, nextStatus(table.status))}
                  className="flex flex-col items-center justify-center gap-2 px-3 pt-0 pb-3 text-center focus:outline-none sm:px-4 sm:pb-4"
                >
                  <span className="text-2xl font-bold tracking-tight">{table.label}</span>
                  <TableStatusBadge status={table.status} />
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    {table.capacity}
                  </span>
                  {activeOrder && (
                    <span className="bg-background/70 mt-1 truncate rounded px-2 py-0.5 text-xs font-medium">
                      {activeOrder.orderNumber}
                    </span>
                  )}
                </button>

                {/* Reservation section */}
                <div className="border-border/60 bg-background/30 flex items-center justify-between gap-2 rounded-b-xl border-t px-3 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Switch
                      checked={table.reservationEnabled}
                      onCheckedChange={(v) => handleReservationToggle(table, v)}
                      className="scale-75"
                      aria-label="Enable reservations"
                    />
                    <span className="text-muted-foreground truncate text-[10px]">
                      {table.reservationEnabled ? "Reservable" : "No reserv."}
                    </span>
                  </div>
                  {table.reservationEnabled && (
                    <button
                      onClick={() => setReservationsTable(table)}
                      className="text-primary hover:bg-primary/10 flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition"
                    >
                      <CalendarClock className="h-3 w-3" />
                      {pendingReservations > 0 && (
                        <span className="bg-primary text-primary-foreground ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
                          {pendingReservations}
                        </span>
                      )}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <TableCreateDialog
        storeId={storeId}
        open={createOpen || !!editTable}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setEditTable(null);
        }}
        editTable={editTable}
      />

      {/* Per-table order QR */}
      <QrCodeDialog
        open={!!qrTable}
        onOpenChange={(o) => !o && setQrTable(null)}
        value={qrTable ? tableOrderUrl(qrTable.label) : ""}
        title={`${t("pos.tables.qrDialogTitle")} — ${qrTable?.label ?? ""}`}
        description={t("pos.tables.qrDialogDesc")}
        filename={`table-${qrTable?.label ?? "qr"}.png`}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTable} onOpenChange={(o) => !o && setDeleteTable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pos.tables.confirmDelete")} {deleteTable?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the table. Active orders or reservations will be
              unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("common.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("pos.tables.deleting") : t("common.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reservations panel */}
      <Sheet open={!!reservationsTable} onOpenChange={(o) => !o && setReservationsTable(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Reservations — {reservationsTable?.label}
            </SheetTitle>
            <SheetDescription>
              Manage bookings for this table. Toggle status or remove entries.
            </SheetDescription>
          </SheetHeader>

          {resLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
              <CalendarClock className="h-10 w-10 opacity-30" />
              <p className="text-sm">No reservations for this table yet.</p>
              <p className="text-xs">
                Guests can book via the storefront when reservations are enabled.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((res) => (
                <ReservationCard
                  key={res.id}
                  reservation={res}
                  onStatusChange={(status) => updateStatusMutation.mutate({ id: res.id, status })}
                  onDelete={() => deleteReservationMutation.mutate(res.id)}
                  isPending={updateStatusMutation.isPending || deleteReservationMutation.isPending}
                />
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ReservationCard({
  reservation,
  onStatusChange,
  onDelete,
  isPending,
}: {
  reservation: Reservation;
  onStatusChange: (s: ReservationStatus) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const dt = new Date(reservation.scheduledAt);
  const dateStr = dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-card space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{reservation.guestName}</p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 shrink-0" />
            {dateStr} · {timeStr}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-[10px] ${RESERVATION_STATUS_COLORS[reservation.status]}`}
        >
          {RESERVATION_STATUS_LABELS[reservation.status]}
        </Badge>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" /> {reservation.partySize} pax
        </span>
        {reservation.guestPhone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" /> {reservation.guestPhone}
          </span>
        )}
        {reservation.guestEmail && (
          <span className="flex max-w-[180px] items-center gap-1 truncate">
            <Mail className="h-3 w-3 shrink-0" /> {reservation.guestEmail}
          </span>
        )}
        {reservation.notes && (
          <span className="text-muted-foreground/70 flex w-full items-center gap-1 italic">
            <StickyNote className="h-3 w-3 shrink-0" /> {reservation.notes}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Select
          value={reservation.status}
          onValueChange={(v) => onStatusChange(v as ReservationStatus)}
          disabled={isPending}
        >
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={onDelete}
          disabled={isPending}
          className="text-destructive hover:bg-destructive/10 rounded p-1.5 transition"
          aria-label="Remove reservation"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
