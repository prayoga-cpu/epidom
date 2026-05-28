"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { CalendarClock, Phone, Mail, Users, StickyNote, ChevronDown, Filter, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ReservationStatus } from "@prisma/client";

interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  partySize: number;
  scheduledAt: string;
  notes: string | null;
  status: ReservationStatus;
  createdAt: string;
  table: { id: string; label: string; capacity: number } | null;
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-600 border-amber-400/40",
  CONFIRMED: "bg-emerald-500/15 text-emerald-600 border-emerald-400/40",
  CANCELLED: "bg-red-500/15 text-red-600 border-red-400/40",
  COMPLETED: "bg-slate-500/15 text-slate-600 border-slate-400/40",
};

const STATUS_OPTIONS: ReservationStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];

interface Props {
  storeId: string;
}

export function ReservationList({ storeId }: Props) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reservations-all", storeId, statusFilter],
    queryFn: () =>
      apiClient.get<{ reservations: Reservation[] }>(
        `/stores/${storeId}/reservations${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`
      ),
    refetchInterval: 30_000,
  });

  const reservations = (data?.reservations ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.guestName.toLowerCase().includes(q) ||
      r.guestPhone?.includes(q) ||
      r.guestEmail?.toLowerCase().includes(q) ||
      r.table?.label.toLowerCase().includes(q)
    );
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      apiClient.patch(`/stores/${storeId}/reservations/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      queryClient.invalidateQueries({ queryKey: ["notifications", storeId] });
      toast.success("Reservation updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/stores/${storeId}/reservations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      queryClient.invalidateQueries({ queryKey: ["notifications", storeId] });
      setDeleteId(null);
      toast.success("Reservation deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const counts = (data?.reservations ?? []).reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Partial<Record<ReservationStatus, number>>
  );

  return (
    <div className="mt-8 border-t border-border">
      {/* Section header */}
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Reservations</h2>
          {counts.PENDING ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
              {counts.PENDING} pending
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick status filter chips */}
          <div className="flex gap-1 flex-wrap">
            {(["ALL", ...STATUS_OPTIONS] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s as any)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_LABELS[s as ReservationStatus]}
                {s !== "ALL" && counts[s as ReservationStatus] ? ` (${counts[s as ReservationStatus]})` : ""}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 pb-3">
        <Input
          placeholder="Search by guest name, phone, email, or table…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm text-sm"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">Loading reservations…</div>
      ) : reservations.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No reservations found.</p>
          {statusFilter !== "ALL" && (
            <button onClick={() => setStatusFilter("ALL")} className="mt-1 text-xs text-muted-foreground hover:text-foreground underline">
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border px-6">
          {reservations.map((r) => {
            const date = new Date(r.scheduledAt);
            const isUpcoming = date > new Date();
            return (
              <div key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: guest info */}
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase border ${STATUS_COLORS[r.status]}`}>
                    {r.guestName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{r.guestName}</p>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.table && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {r.table.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        {" "}{date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {isUpcoming && r.status === "CONFIRMED" && (
                          <span className="ml-1 rounded-full bg-emerald-500/10 px-1.5 text-[9px] font-semibold text-emerald-600">upcoming</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {r.partySize} pax
                      </span>
                      {r.guestPhone && (
                        <a href={`tel:${r.guestPhone}`} className="flex items-center gap-1 hover:text-foreground">
                          <Phone className="h-3 w-3" />
                          {r.guestPhone}
                        </a>
                      )}
                      {r.guestEmail && (
                        <a href={`mailto:${r.guestEmail}`} className="flex items-center gap-1 hover:text-foreground">
                          <Mail className="h-3 w-3" />
                          {r.guestEmail}
                        </a>
                      )}
                    </div>
                    {r.notes && (
                      <p className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground italic">
                        <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                        {r.notes}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/50">
                      Submitted {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1">
                        Status <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {STATUS_OPTIONS.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          disabled={r.status === s || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ id: r.id, status: s })}
                        >
                          <span className={`mr-2 h-2 w-2 rounded-full inline-block ${
                            s === "CONFIRMED" ? "bg-emerald-500" :
                            s === "PENDING" ? "bg-amber-500" :
                            s === "CANCELLED" ? "bg-red-500" : "bg-slate-500"
                          }`} />
                          {STATUS_LABELS[s]}
                          {r.status === s && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                    onClick={() => setDeleteId(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reservation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the reservation. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
