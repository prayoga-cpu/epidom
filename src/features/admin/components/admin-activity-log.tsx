"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ShieldAlert,
  Flag,
  Undo2,
  Search,
  ChevronRight,
  Info,
  Lock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type ViewMode = "timeline" | "actors" | "entities" | "coverage";

interface ActivityRow {
  id: string;
  occurredAt: string;
  actorKind: string;
  actorRefId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorGrant: string | null;
  actionCode: string;
  method: string;
  route: string;
  outcome: string;
  severity: string;
  statusCode: number | null;
  storeId: string | null;
  targetType: string | null;
  targetId: string | null;
  durationMs: number | null;
  detail: {
    actionLogId: string;
    actionType: string;
    category: string;
    state: string;
    reversibility: string;
    targetLabel: string | null;
    reason: string | null;
    flaggedAt: string | null;
    lockedAt: string | null;
    revertable: boolean;
  } | null;
}

interface Stats {
  total: number;
  critical: number;
  denied: number;
  flagged: number;
  revertable: number;
  earliest: string | null;
}

const severityStyles: Record<string, string> = {
  CRITICAL: "border-red-500/30 bg-red-500/10 text-red-400",
  NOTICE: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  INFO: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

const reversibilityCopy: Record<string, string> = {
  REVERSIBLE: "Revertible",
  REVERSIBLE_WITH_CAVEAT: "Revertible with caveats",
  SNAPSHOT_RESTORE: "Restorable from snapshot",
  COMPENSATE_ONLY: "Needs a compensating entry",
  IRREVERSIBLE: "Cannot be undone",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminActivityLog() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>("timeline");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("ALL");
  const [outcome, setOutcome] = useState<string>("ALL");
  const [targetType, setTargetType] = useState<string>("ALL");
  const [actorRefId, setActorRefId] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("view", view);
    p.set("limit", "50");
    if (search.trim()) p.set("search", search.trim());
    if (severity !== "ALL") p.set("severity", severity);
    if (outcome !== "ALL") p.set("outcome", outcome);
    if (targetType !== "ALL") p.set("targetType", targetType);
    if (actorRefId) p.set("actorRefId", actorRefId);
    const cursor = cursorStack[cursorStack.length - 1];
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, [view, search, severity, outcome, targetType, actorRefId, cursorStack]);

  const { data, isLoading, isError } = useQuery<{
    rows?: ActivityRow[];
    nextCursor?: string | null;
    actors?: any[];
    entities?: any[];
    coverage?: any;
    stats?: Stats;
  }>({
    queryKey: ["admin-activity", params],
    queryFn: () => fetch(`/api/admin/activity?${params}`).then((r) => r.json()),
    // The trail is append-only and grows continuously; a stale page here reads
    // as "nothing is happening", which is the one impression it must not give.
    refetchInterval: 30_000,
  });

  const stats = data?.stats;

  const act = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/admin/activity/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-activity"] }),
  });

  const resetPaging = useCallback(() => setCursorStack([]), []);

  const statItems = [
    { key: "total", label: "Events", value: stats?.total ?? 0, icon: Activity, color: "text-blue-400" },
    { key: "critical", label: "Critical", value: stats?.critical ?? 0, icon: ShieldAlert, color: "text-red-400" },
    { key: "denied", label: "Denied", value: stats?.denied ?? 0, icon: AlertTriangle, color: "text-amber-400" },
    { key: "flagged", label: "Flagged", value: stats?.flagged ?? 0, icon: Flag, color: "text-orange-400" },
    { key: "revertable", label: "Revertible", value: stats?.revertable ?? 0, icon: Undo2, color: "text-emerald-400" },
  ];

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      {/* Header */}
      <div className="border-border bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
              <Activity className="h-5 w-5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-foreground text-lg font-bold">Activity</h1>
              <p className="text-muted-foreground truncate text-xs">
                Who did what, and what can be undone
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
        {/* Day-zero notice. An empty page must never be read as "nothing
            happened" when the real answer is "recording started recently". */}
        {stats?.earliest && (
          <div className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Recording began {fmtTime(stats.earliest)}. Actions before that date were never
              captured — this log cannot show them.
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {statItems.map(({ key, label, value, icon: Icon, color }) => {
            const active =
              (key === "critical" && severity === "CRITICAL") ||
              (key === "denied" && outcome === "DENIED");
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  resetPaging();
                  if (key === "critical") setSeverity(severity === "CRITICAL" ? "ALL" : "CRITICAL");
                  if (key === "denied") setOutcome(outcome === "DENIED" ? "ALL" : "DENIED");
                }}
                className={`border-border bg-card hover:border-foreground/20 rounded-xl border p-4 text-left transition-all ${
                  active ? "ring-offset-background ring-2 ring-violet-500 ring-offset-2" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-foreground text-2xl font-bold">{value}</p>
              </button>
            );
          })}
        </div>

        {/* View switcher + filters */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["timeline", "Timeline"],
                ["actors", "By user"],
                ["entities", "By table"],
                ["coverage", "Coverage"],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                size="sm"
                variant={view === mode ? "default" : "outline"}
                className="shrink-0"
                onClick={() => {
                  setView(mode);
                  resetPaging();
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {view !== "coverage" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] max-w-xs flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetPaging();
                  }}
                  placeholder="Search actor, action, route…"
                  className="border-border bg-card focus:ring-ring h-9 w-full rounded-md border pl-8 pr-2 text-sm focus:ring-2 focus:outline-none"
                />
              </div>

              <Select
                value={severity}
                onValueChange={(v) => {
                  setSeverity(v);
                  resetPaging();
                }}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="NOTICE">Notice</SelectItem>
                  <SelectItem value="INFO">Info</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={outcome}
                onValueChange={(v) => {
                  setOutcome(v);
                  resetPaging();
                }}
              >
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All outcomes</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="DENIED">Denied</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>

              {actorRefId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setActorRefId(null);
                    resetPaging();
                  }}
                >
                  Clear user filter ✕
                </Button>
              )}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive text-sm">Could not load the activity log.</p>
        )}

        {!isLoading && view === "timeline" && (
          <TimelineView
            rows={data?.rows ?? []}
            onSelect={setSelected}
            onFilterActor={(id) => {
              setActorRefId(id);
              resetPaging();
            }}
          />
        )}

        {!isLoading && view === "actors" && (
          <ActorsView
            actors={data?.actors ?? []}
            onDrillDown={(id) => {
              setActorRefId(id);
              setView("timeline");
              resetPaging();
            }}
          />
        )}

        {!isLoading && view === "entities" && (
          <EntitiesView
            entities={data?.entities ?? []}
            onDrillDown={(t) => {
              setTargetType(t);
              setView("timeline");
              resetPaging();
            }}
          />
        )}

        {!isLoading && view === "coverage" && <CoverageView coverage={data?.coverage} />}

        {view === "timeline" && data?.nextCursor && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setCursorStack((s) => [...s, data.nextCursor!])}
            >
              Load more
            </Button>
          </div>
        )}
        {cursorStack.length > 0 && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={resetPaging}>
              Back to newest
            </Button>
          </div>
        )}
      </div>

      <DetailSheet row={selected} onClose={() => setSelected(null)} act={act} />
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "SUCCESS") return null;
  return (
    <Badge
      variant="outline"
      className={
        outcome === "DENIED"
          ? "border-dashed border-amber-500/50 text-amber-400"
          : "border-dashed border-red-500/50 text-red-400"
      }
    >
      {outcome}
    </Badge>
  );
}

function TimelineView({
  rows,
  onSelect,
  onFilterActor,
}: {
  rows: ActivityRow[];
  onSelect: (r: ActivityRow) => void;
  onFilterActor: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No activity matches these filters.
      </p>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className={`border-border bg-card w-full rounded-lg border p-3 text-left ${
              r.outcome !== "SUCCESS" ? "border-dashed" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-foreground text-sm font-medium">
                {r.detail?.targetLabel ?? r.actionCode}
              </span>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${severityStyles[r.severity]}`}
              >
                {r.severity}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {r.actorName ?? r.actorKind} · {fmtTime(r.occurredAt)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <OutcomeBadge outcome={r.outcome} />
              {r.detail?.revertable && (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                  Revertible
                </Badge>
              )}
              {r.detail?.flaggedAt && (
                <Badge variant="outline" className="border-orange-500/40 text-orange-400">
                  Flagged
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
        <div className="min-w-[980px]">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">Actor</th>
                <th className="px-3 py-2 text-left font-medium">Action</th>
                <th className="px-3 py-2 text-left font-medium">Table</th>
                <th className="px-3 py-2 text-left font-medium">Severity</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-border hover:bg-muted/40 border-b ${
                    r.outcome !== "SUCCESS" ? "border-dashed" : ""
                  }`}
                >
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {fmtTime(r.occurredAt)}
                  </td>
                  <td className="px-3 py-2">
                    {r.actorRefId ? (
                      <button
                        type="button"
                        onClick={() => onFilterActor(r.actorRefId!)}
                        className="hover:text-foreground text-left underline-offset-2 hover:underline"
                      >
                        {r.actorName ?? r.actorRefId.slice(0, 8)}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">{r.actorKind}</span>
                    )}
                    {r.actorGrant === "HARDCODED_EMAIL" && (
                      <Badge
                        variant="outline"
                        className="ml-1.5 border-violet-500/40 text-[10px] text-violet-400"
                        title="Admin via the hardcoded email list — no DB flag"
                      >
                        hardcoded
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">
                      {r.detail?.targetLabel ?? r.actionCode}
                    </span>
                    {r.detail && (
                      <Badge variant="outline" className="ml-1.5 text-[10px]">
                        detailed
                      </Badge>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{r.targetType ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${severityStyles[r.severity]}`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <OutcomeBadge outcome={r.outcome} />
                    {r.outcome === "SUCCESS" && (
                      <span className="text-muted-foreground text-xs">{r.statusCode}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={() => onSelect(r)}
                      aria-label="Open details"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ActorsView({
  actors,
  onDrillDown,
}: {
  actors: any[];
  onDrillDown: (id: string) => void;
}) {
  if (actors.length === 0) {
    return <p className="text-muted-foreground py-12 text-center text-sm">No actors recorded yet.</p>;
  }
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div className="min-w-[640px]">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-border border-b text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">User</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
              <th className="px-3 py-2 text-right font-medium">Destructive</th>
              <th className="px-3 py-2 text-right font-medium">Denied</th>
              <th className="px-3 py-2 text-left font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {actors.map((a) => (
              <tr
                key={`${a.actorKind}-${a.actorRefId ?? "anon"}`}
                className="border-border hover:bg-muted/40 border-b"
              >
                <td className="px-3 py-2">
                  {a.actorRefId ? (
                    <button
                      type="button"
                      onClick={() => onDrillDown(a.actorRefId)}
                      className="text-left underline-offset-2 hover:underline"
                    >
                      {a.actorName ?? a.actorEmail ?? a.actorRefId.slice(0, 12)}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">{a.actorKind}</span>
                  )}
                  <Badge variant="outline" className="ml-1.5 text-[10px]">
                    {a.actorKind}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">{a.total}</td>
                <td
                  className={`px-3 py-2 text-right ${a.destructive > 0 ? "font-semibold text-red-400" : "text-muted-foreground"}`}
                >
                  {a.destructive}
                </td>
                <td
                  className={`px-3 py-2 text-right ${a.denied > 0 ? "font-semibold text-amber-400" : "text-muted-foreground"}`}
                >
                  {a.denied}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {a.lastSeen ? fmtTime(a.lastSeen) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntitiesView({
  entities,
  onDrillDown,
}: {
  entities: any[];
  onDrillDown: (t: string) => void;
}) {
  if (entities.length === 0) {
    return <p className="text-muted-foreground py-12 text-center text-sm">No table activity yet.</p>;
  }
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div className="min-w-[520px]">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-border border-b text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-right font-medium">Writes</th>
              <th className="px-3 py-2 text-right font-medium">Destructive</th>
              <th className="px-3 py-2 text-left font-medium">Last write</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => (
              <tr key={e.targetType} className="border-border hover:bg-muted/40 border-b">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onDrillDown(e.targetType)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    {e.targetType}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">{e.total}</td>
                <td
                  className={`px-3 py-2 text-right ${e.destructive > 0 ? "font-semibold text-red-400" : "text-muted-foreground"}`}
                >
                  {e.destructive}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {e.lastSeen ? fmtTime(e.lastSeen) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Coverage manifest. Publishing what is NOT recorded is what makes an empty
 * timeline unambiguous.
 */
function CoverageView({ coverage }: { coverage: any }) {
  if (!coverage) return null;
  return (
    <div className="space-y-6">
      <div className="border-border bg-muted/40 text-muted-foreground rounded-lg border p-3 text-xs">
        {coverage.note}
      </div>

      <div>
        <h2 className="text-foreground mb-2 text-sm font-semibold">
          Curated actions ({coverage.curatedCount})
        </h2>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <div className="min-w-[620px]">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-border border-b text-xs">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">Severity</th>
                  <th className="px-3 py-2 text-left font-medium">Reversibility</th>
                </tr>
              </thead>
              <tbody>
                {coverage.curated.map((c: any) => (
                  <tr key={c.actionType} className="border-border border-b">
                    <td className="px-3 py-2 font-mono text-xs">{c.actionType}</td>
                    <td className="text-muted-foreground px-3 py-2">{c.category}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${severityStyles[c.severity]}`}
                      >
                        {c.severity}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">
                      {reversibilityCopy[c.reversibility] ?? c.reversibility}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-foreground mb-2 text-sm font-semibold">Deliberately not recorded</h2>
        <ul className="space-y-1.5">
          {coverage.waivers.map((w: any) => (
            <li key={w.route} className="text-muted-foreground text-xs">
              <code className="text-foreground">{w.route}</code> — {w.reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DetailSheet({
  row,
  onClose,
  act,
}: {
  row: ActivityRow | null;
  onClose: () => void;
  act: ReturnType<typeof useMutation<any, Error, Record<string, unknown>>>;
}) {
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [note, setNote] = useState("");

  const actionLogId = row?.detail?.actionLogId;

  const runPlan = async () => {
    if (!actionLogId) return;
    const res = await act.mutateAsync({ op: "plan", actionLogId });
    setPlan(res.plan);
  };

  const runRevert = async () => {
    if (!actionLogId) return;
    try {
      await act.mutateAsync({ op: "revert", actionLogId, reason, confirmed: true });
      toast.success("Reverted — the action was undone and recorded.");
      setPlan(null);
      setReason("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revert");
    }
  };

  return (
    <Sheet open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      {/* dvh, not vh: iOS Safari sizes vh as if the toolbar were hidden, which
          pushes the footer actions of a fixed sheet off-screen. */}
      <SheetContent className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-base">
            {row?.detail?.targetLabel ?? row?.actionCode}
          </SheetTitle>
        </SheetHeader>

        {/* min-h-0 so this pane actually scrolls instead of being clipped by
            the flex parent's overflow-hidden. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          <dl className="space-y-2 text-sm">
            <Field label="When" value={row ? fmtTime(row.occurredAt) : ""} />
            <Field label="Actor" value={`${row?.actorName ?? "—"} (${row?.actorKind})`} />
            {row?.actorGrant && <Field label="Admin via" value={row.actorGrant} />}
            <Field label="Route" value={`${row?.method} ${row?.route}`} />
            <Field label="Outcome" value={`${row?.outcome} ${row?.statusCode ?? ""}`} />
            {row?.targetType && (
              <Field label="Target" value={`${row.targetType} ${row.targetId ?? ""}`} />
            )}
            {row?.detail && (
              <Field
                label="Reversibility"
                value={reversibilityCopy[row.detail.reversibility] ?? row.detail.reversibility}
              />
            )}
          </dl>

          {!row?.detail && (
            <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-xs">
              This request was recorded in the activity trail but has no curated entry, so its
              before/after values were not captured and it cannot be reverted.
            </p>
          )}

          {plan && (
            <div
              className={`rounded-lg border p-3 text-xs ${
                plan.ok
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-amber-500/40 bg-amber-500/10"
              }`}
            >
              <p className="font-medium">{plan.ok ? "Safe to revert" : "Refused"}</p>
              <p className="text-muted-foreground mt-1">
                {plan.ok ? plan.effect : plan.refusal?.message}
              </p>
              {plan.caveat && (
                <p className="mt-2 text-amber-400">
                  <strong>Caveat:</strong> {plan.caveat}
                </p>
              )}
            </div>
          )}

          {plan?.ok && (
            <div className="space-y-2">
              <label className="text-foreground text-xs font-medium">
                Why are you reverting this? (required, min 10 characters)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="This becomes part of the permanent record."
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-foreground text-xs font-medium">Add a note</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Visible to other admins on this action."
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!actionLogId || !note.trim() || act.isPending}
              onClick={async () => {
                await act.mutateAsync({ op: "annotate", actionLogId, body: note });
                setNote("");
                toast.success("Note added");
              }}
            >
              Save note
            </Button>
          </div>
        </div>

        {row?.detail && (
          <div className="border-border flex flex-wrap gap-2 border-t pt-3">
            {/* flex-1 rather than w-full: w-full would claim the whole row on
                top of its siblings and overflow by exactly their width. */}
            {!plan && (
              <Button
                className="flex-1"
                disabled={!row.detail.revertable || act.isPending}
                onClick={runPlan}
              >
                {act.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview revert"}
              </Button>
            )}
            {plan?.ok && (
              <Button
                className="flex-1"
                variant="destructive"
                disabled={reason.trim().length < 10 || act.isPending}
                onClick={runRevert}
              >
                Apply revert
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              aria-label={row.detail.flaggedAt ? "Unflag" : "Flag"}
              onClick={() =>
                act.mutate({ op: "flag", actionLogId, flagged: !row.detail!.flaggedAt })
              }
            >
              <Flag
                className={`h-4 w-4 ${row.detail.flaggedAt ? "fill-orange-400 text-orange-400" : ""}`}
              />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              aria-label={row.detail.lockedAt ? "Release legal hold" : "Place legal hold"}
              onClick={() => act.mutate({ op: "lock", actionLogId, locked: !row.detail!.lockedAt })}
            >
              <Lock
                className={`h-4 w-4 ${row.detail.lockedAt ? "fill-blue-400 text-blue-400" : ""}`}
              />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="text-muted-foreground w-28 shrink-0 text-xs">{label}</dt>
      <dd className="text-foreground min-w-0 flex-1 text-xs break-words">{value}</dd>
    </div>
  );
}
