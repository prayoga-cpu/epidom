"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, Inbox, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Status = "NEW" | "IN_REVIEW" | "QUOTED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED";

interface RequestRow {
  id: string;
  userName: string;
  userEmail: string;
  storeId: string | null;
  company: string | null;
  phone: string | null;
  budget: string | null;
  timeline: string | null;
  description: string;
  status: Status;
  devNote: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

const STATUS_OPTIONS: Status[] = [
  "NEW",
  "IN_REVIEW",
  "QUOTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
];

const statusLabels: Record<Status, string> = {
  NEW: "New",
  IN_REVIEW: "In Review",
  QUOTED: "Quoted",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DECLINED: "Declined",
};

const STATUS_ORDER: Record<Status, number> = {
  NEW: 0,
  IN_REVIEW: 1,
  QUOTED: 2,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  DECLINED: 5,
};

const statusColors: Record<Status, { row: string; badge: string }> = {
  NEW: { row: "border-l-2 border-l-blue-500 bg-blue-500/[0.03]", badge: "border-blue-500/40 text-blue-400" },
  IN_REVIEW: {
    row: "border-l-2 border-l-violet-500 bg-violet-500/[0.03]",
    badge: "border-violet-500/40 text-violet-400",
  },
  QUOTED: {
    row: "border-l-2 border-l-amber-500 bg-amber-500/[0.03]",
    badge: "border-amber-500/40 text-amber-400",
  },
  IN_PROGRESS: {
    row: "border-l-2 border-l-amber-500 bg-amber-500/[0.03]",
    badge: "border-amber-500/40 text-amber-400",
  },
  COMPLETED: {
    row: "border-l-2 border-l-emerald-500 bg-emerald-500/[0.03]",
    badge: "border-emerald-500/40 text-emerald-400",
  },
  DECLINED: {
    row: "border-l-2 border-l-slate-500 bg-slate-500/[0.03]",
    badge: "border-slate-500/40 text-slate-400",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AdminCustomDevelopmentTable() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [devNoteDraft, setDevNoteDraft] = useState("");

  const { data, isLoading, isError } = useQuery<{ requests: RequestRow[] }>({
    queryKey: ["admin-custom-development"],
    queryFn: async () => {
      const res = await fetch("/api/admin/custom-development");
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: (body: { id: string; status?: Status; devNote?: string }) =>
      fetch("/api/admin/custom-development", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? "Request failed");
        }
        return r.json();
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-custom-development"] });
      toast.success(variables.devNote !== undefined ? "Dev note saved" : "Status updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const updateStatus = (id: string, status: Status) => mutation.mutate({ id, status });
  const saveDevNote = (id: string) => {
    mutation.mutate({ id, devNote: devNoteDraft });
    setDetailId(null);
  };

  const rawRows = data?.requests ?? [];

  const rows = useMemo(
    () => [...rawRows].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [rawRows]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const haystack =
            `${r.user?.name ?? r.userName} ${r.user?.email ?? r.userEmail} ${r.company ?? ""} ${r.description}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      }),
    [rows, statusFilter, search]
  );

  const detailRow = rows.find((r) => r.id === detailId) ?? null;

  const openDetail = (row: RequestRow) => {
    setDetailId(row.id);
    setDevNoteDraft(row.devNote ?? "");
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5" />
        <h1 className="text-xl font-bold tracking-tight">Custom Development Requests</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
          <Input
            placeholder="Search requester, company, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "ALL")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Requester</TableHead>
                <TableHead className="text-muted-foreground">Company</TableHead>
                <TableHead className="text-muted-foreground">Description</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                    Loading requests...
                  </TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell colSpan={5} className="text-destructive py-12 text-center">
                    Failed to load requests. Refresh the page or sign in again.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                    <Inbox className="mx-auto mb-2 h-6 w-6" />
                    No custom development requests yet.
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`border-border cursor-pointer ${statusColors[row.status].row}`}
                  onClick={() => openDetail(row)}
                >
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{row.user?.name ?? row.userName}</p>
                    <p className="text-muted-foreground text-xs">{row.user?.email ?? row.userEmail}</p>
                  </TableCell>
                  <TableCell className="text-sm">{row.company ?? "—"}</TableCell>
                  <TableCell className="max-w-md truncate text-sm">{row.description}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={row.status}
                      onValueChange={(v) => updateStatus(row.id, v as Status)}
                    >
                      <SelectTrigger className={`h-8 w-36 text-xs ${statusColors[row.status].badge}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabels[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[calc(80dvh/var(--app-zoom,1))] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Request details</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Requester</p>
                  <p>{detailRow.user?.name ?? detailRow.userName}</p>
                  <p className="text-muted-foreground text-xs">
                    {detailRow.user?.email ?? detailRow.userEmail}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant="outline" className={statusColors[detailRow.status].badge}>
                    {statusLabels[detailRow.status]}
                  </Badge>
                </div>
                {detailRow.company && (
                  <div>
                    <p className="text-muted-foreground text-xs">Company</p>
                    <p>{detailRow.company}</p>
                  </div>
                )}
                {detailRow.phone && (
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p>{detailRow.phone}</p>
                  </div>
                )}
                {detailRow.budget && (
                  <div>
                    <p className="text-muted-foreground text-xs">Budget</p>
                    <p>{detailRow.budget}</p>
                  </div>
                )}
                {detailRow.timeline && (
                  <div>
                    <p className="text-muted-foreground text-xs">Timeline</p>
                    <p>{detailRow.timeline}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Description</p>
                <p className="text-sm whitespace-pre-wrap">{detailRow.description}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Dev note (private)</p>
                <Textarea
                  value={devNoteDraft}
                  onChange={(e) => setDevNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Add a private dev note..."
                />
                <button
                  type="button"
                  onClick={() => saveDevNote(detailRow.id)}
                  disabled={mutation.isPending}
                  className="mt-2 rounded-md bg-violet-500/20 px-2.5 py-1 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
                >
                  Save note
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
