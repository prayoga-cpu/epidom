"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Inbox, Clock, CheckCircle2, Archive } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type FeedbackType = "BUG" | "FEATURE_SUGGESTION" | "GENERAL_FEEDBACK";
type FeedbackStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";

interface FeedbackRow {
  id: string;
  userName: string;
  userEmail: string;
  storeId: string | null;
  type: FeedbackType;
  page: string;
  description: string;
  screenshotUrl: string | null;
  status: FeedbackStatus;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

const typeBadges: Record<
  FeedbackType,
  { label: string; variant: "destructive" | "default" | "secondary" }
> = {
  BUG: { label: "Bug", variant: "destructive" },
  FEATURE_SUGGESTION: { label: "Feature", variant: "default" },
  GENERAL_FEEDBACK: { label: "General", variant: "secondary" },
};

const STATUS_OPTIONS: FeedbackStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "ARCHIVED"];

const statusLabels: Record<FeedbackStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  ARCHIVED: "Archived",
};

// Grouping priority: active items surface first, archived sink to the bottom.
const STATUS_ORDER: Record<FeedbackStatus, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  RESOLVED: 2,
  ARCHIVED: 3,
};

const statusColors: Record<FeedbackStatus, { row: string; select: string }> = {
  OPEN: {
    row: "border-l-2 border-l-blue-500 bg-blue-500/[0.03]",
    select: "border-blue-500/40 text-blue-400",
  },
  IN_PROGRESS: {
    row: "border-l-2 border-l-amber-500 bg-amber-500/[0.03]",
    select: "border-amber-500/40 text-amber-400",
  },
  RESOLVED: {
    row: "border-l-2 border-l-emerald-500 bg-emerald-500/[0.03]",
    select: "border-emerald-500/40 text-emerald-400",
  },
  ARCHIVED: {
    row: "border-l-2 border-l-slate-500 bg-slate-500/[0.03]",
    select: "border-slate-500/40 text-slate-400",
  },
};

const DESCRIPTION_PREVIEW_LENGTH = 80;

export function AdminFeedbackTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ feedback: FeedbackRow[] }>({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const res = await fetch("/api/admin/feedback");
      if (!res.ok) {
        throw new Error("Failed to load feedback");
      }
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: (body: { id: string; status: FeedbackStatus }) =>
      fetch("/api/admin/feedback", {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const rawRows = data?.feedback ?? [];

  // Group by status (Open → In Progress → Resolved → Archived); the API
  // already returns createdAt desc, and Array#sort is stable, so newest-first
  // ordering is preserved within each status group.
  const rows = useMemo(
    () => [...rawRows].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [rawRows]
  );

  const copyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    toast.success("ID copied");
  };

  const stats = {
    open: rows.filter((f) => f.status === "OPEN").length,
    inProgress: rows.filter((f) => f.status === "IN_PROGRESS").length,
    resolved: rows.filter((f) => f.status === "RESOLVED").length,
    archived: rows.filter((f) => f.status === "ARCHIVED").length,
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-border bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
              <MessageSquare className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-foreground text-lg font-bold">Feedback</h1>
              <p className="text-muted-foreground text-xs">
                Bug reports and suggestions from users
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Open", value: stats.open, icon: Inbox, color: "text-blue-400" },
            { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-amber-400" },
            {
              label: "Resolved",
              value: stats.resolved,
              icon: CheckCircle2,
              color: "text-emerald-400",
            },
            { label: "Archived", value: stats.archived, icon: Archive, color: "text-slate-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="border-border bg-card rounded-xl border p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-foreground text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Mobile/Tablet: card list */}
        <div className="space-y-3 lg:hidden">
          {isLoading && (
            <p className="text-muted-foreground py-12 text-center text-sm">Loading feedback...</p>
          )}
          {isError && (
            <p className="text-destructive py-12 text-center text-sm">
              Failed to load feedback. Refresh the page or sign in again.
            </p>
          )}
          {!isLoading && !isError && rows.length === 0 && (
            <p className="text-muted-foreground py-12 text-center text-sm">No feedback yet</p>
          )}
          {rows.map((row) => {
            const isExpanded = expanded.has(row.id);
            const isLong = row.description.length > DESCRIPTION_PREVIEW_LENGTH;

            return (
              <div
                key={row.id}
                className={`border-border bg-card space-y-3 rounded-xl border p-4 ${statusColors[row.status].row}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium">
                      {row.user?.name ?? row.userName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.user?.email ?? row.userEmail}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={typeBadges[row.type].variant}>{typeBadges[row.type].label}</Badge>
                  <span className="text-muted-foreground text-xs break-all">{row.page}</span>
                  <button
                    type="button"
                    onClick={() => copyId(row.id)}
                    className="text-muted-foreground font-mono text-[11px] hover:underline"
                    title={row.id}
                  >
                    #{row.id.slice(0, 8)}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => isLong && toggleExpanded(row.id)}
                  className={`text-foreground w-full text-left text-sm break-words whitespace-pre-wrap ${isLong ? "cursor-pointer" : "cursor-default"}`}
                >
                  {isLong && !isExpanded
                    ? `${row.description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}…`
                    : row.description}
                </button>

                <div className="flex items-center justify-between gap-2">
                  {row.screenshotUrl ? (
                    <button
                      type="button"
                      onClick={() => setSelectedScreenshot(row.screenshotUrl)}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                  <Select
                    value={row.status}
                    onValueChange={(v) =>
                      mutation.mutate({ id: row.id, status: v as FeedbackStatus })
                    }
                    disabled={mutation.isPending}
                  >
                    <SelectTrigger
                      size="sm"
                      className={`w-[140px] font-medium ${statusColors[row.status].select}`}
                    >
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
                </div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="border-border bg-card hidden overflow-hidden rounded-xl border lg:block">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">ID</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">User</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Page</TableHead>
                    <TableHead className="text-muted-foreground">Description</TableHead>
                    <TableHead className="text-muted-foreground">Screenshot</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground py-12 text-center">
                        Loading feedback...
                      </TableCell>
                    </TableRow>
                  )}
                  {isError && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-destructive py-12 text-center">
                        Failed to load feedback. Refresh the page or sign in again.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && !isError && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground py-12 text-center">
                        No feedback yet
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => {
                    const isExpanded = expanded.has(row.id);
                    const isLong = row.description.length > DESCRIPTION_PREVIEW_LENGTH;

                    return (
                      <TableRow
                        key={row.id}
                        className={`border-border ${statusColors[row.status].row}`}
                      >
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => copyId(row.id)}
                            className="text-muted-foreground font-mono text-xs hover:underline"
                            title={row.id}
                          >
                            #{row.id.slice(0, 8)}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-foreground text-sm font-medium">
                              {row.user?.name ?? row.userName}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {row.user?.email ?? row.userEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={typeBadges[row.type].variant}>
                            {typeBadges[row.type].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[160px] truncate text-xs">
                          {row.page}
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <button
                            type="button"
                            onClick={() => isLong && toggleExpanded(row.id)}
                            className={`text-foreground text-left text-sm break-words whitespace-pre-wrap ${isLong ? "cursor-pointer" : "cursor-default"}`}
                          >
                            {isLong && !isExpanded
                              ? `${row.description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}…`
                              : row.description}
                          </button>
                        </TableCell>
                        <TableCell>
                          {row.screenshotUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedScreenshot(row.screenshotUrl)}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              View
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.status}
                            onValueChange={(v) =>
                              mutation.mutate({ id: row.id, status: v as FeedbackStatus })
                            }
                            disabled={mutation.isPending}
                          >
                            <SelectTrigger
                              size="sm"
                              className={`w-[140px] font-medium ${statusColors[row.status].select}`}
                            >
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground pb-4 text-center text-xs">
          {rows.length} feedback {rows.length === 1 ? "entry" : "entries"}
        </p>
      </div>

      {/* Screenshot preview dialog */}
      <Dialog
        open={!!selectedScreenshot}
        onOpenChange={(open) => {
          if (!open) setSelectedScreenshot(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {selectedScreenshot && (
            <>
              <img
                src={selectedScreenshot}
                alt="Feedback screenshot"
                className="max-h-[80vh] w-full rounded-md object-contain"
              />
              <a
                href={selectedScreenshot}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-400 hover:underline"
              >
                Open in new tab
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
