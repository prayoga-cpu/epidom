"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/** Mirrors ActorStoreRef / ActorSummary in audit-query.service.ts. */
interface ActorStoreRef {
  id: string;
  name: string;
  events: number;
}

interface ActorRow {
  actorRefId: string | null;
  actorKind: string;
  actorName: string | null;
  actorEmail: string | null;
  stores: ActorStoreRef[];
  staffRole: string | null;
  total: number;
  destructive: number;
  denied: number;
  lastSeen: string;
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [severity, setSeverity] = useState<string>("ALL");
  const [outcome, setOutcome] = useState<string>("ALL");
  const [targetType, setTargetType] = useState<string>("ALL");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLabel, setStoreLabel] = useState<string | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [actorRefId, setActorRefId] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The search box is part of the query key, so an undebounced keystroke is a
  // round trip to the admin API and a full skeleton flash. Typing "order" used
  // to cost five of each.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("view", view);
    p.set("limit", "50");
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (severity !== "ALL") p.set("severity", severity);
    if (outcome !== "ALL") p.set("outcome", outcome);
    if (targetType !== "ALL") p.set("targetType", targetType);
    if (storeId) p.set("storeId", storeId);
    if (flaggedOnly) p.set("flaggedOnly", "true");
    if (actorRefId) p.set("actorRefId", actorRefId);
    const cursor = cursorStack[cursorStack.length - 1];
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, [
    view,
    debouncedSearch,
    severity,
    outcome,
    targetType,
    storeId,
    flaggedOnly,
    actorRefId,
    cursorStack,
  ]);

  const { data, isLoading, isError, error } = useQuery<{
    rows?: ActivityRow[];
    nextCursor?: string | null;
    actors?: ActorRow[];
    entities?: any[];
    coverage?: any;
    stats?: Stats;
  }>({
    queryKey: ["admin-activity", params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity?${params}`);
      const json = await res.json();
      // Without this a 403 or a 400 resolves happily to `{ error: … }` and the
      // table renders "No activity matches these filters" — an audit log
      // claiming nothing happened is the one lie it must never tell.
      if (!res.ok) throw new Error(json.error ?? "Could not load the activity log");
      return json;
    },
    // The trail is append-only and grows continuously; a stale page here reads
    // as "nothing is happening", which is the one impression it must not give.
    refetchInterval: 30_000,
    // Keeps the previous page on screen while the next one loads, instead of
    // blanking every row and flashing 0 across all five stat cards.
    placeholderData: (prev) => prev,
  });

  const stats = data?.stats;
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);

  // The drawer follows the row by id rather than holding a copy of it, so a
  // flag or a legal hold applied from inside the drawer is reflected as soon as
  // the list refetches. A detached snapshot could never update.
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

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
    // A failed flag or legal hold used to fail silently, leaving the icon
    // showing the state the click did not achieve.
    onError: (e) => toast.error(e instanceof Error ? e.message : "Request failed"),
  });

  const resetPaging = useCallback(() => setCursorStack([]), []);

  /**
   * `filterable` cards toggle a filter; the rest are read-outs and must not be
   * rendered as buttons that do nothing when clicked.
   *
   * `allTime` marks the two counts that come from ActionLog, which the
   * ActivityEvent filters cannot address — saying so is better than quietly
   * showing a number drawn from a different population than its neighbours.
   */
  const statItems = [
    {
      key: "total",
      label: "Events",
      value: stats?.total ?? 0,
      icon: Activity,
      color: "text-blue-400",
      filterable: false,
      allTime: false,
    },
    {
      key: "critical",
      label: "Critical",
      value: stats?.critical ?? 0,
      icon: ShieldAlert,
      color: "text-red-400",
      filterable: true,
      allTime: false,
    },
    {
      key: "denied",
      label: "Denied",
      value: stats?.denied ?? 0,
      icon: AlertTriangle,
      color: "text-amber-400",
      filterable: true,
      allTime: false,
    },
    {
      key: "flagged",
      label: "Flagged",
      value: stats?.flagged ?? 0,
      icon: Flag,
      color: "text-orange-400",
      filterable: true,
      allTime: true,
    },
    {
      key: "revertable",
      label: "Revertible",
      value: stats?.revertable ?? 0,
      icon: Undo2,
      color: "text-emerald-400",
      filterable: false,
      allTime: true,
    },
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

        {/* Stats. Hidden on Coverage, whose route returns no stats at all — the
            cards would otherwise read a confident 0/0/0/0/0. */}
        {view !== "coverage" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {statItems.map(({ key, label, value, icon: Icon, color, filterable, allTime }) => {
              const active =
                (key === "critical" && severity === "CRITICAL") ||
                (key === "denied" && outcome === "DENIED") ||
                (key === "flagged" && flaggedOnly);

              const body = (
                <>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-muted-foreground truncate text-xs">{label}</p>
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                  </div>
                  <p className="text-foreground text-2xl font-bold">{value}</p>
                  {allTime && <p className="text-muted-foreground mt-0.5 text-[10px]">all time</p>}
                </>
              );

              const shell = `border-border bg-card rounded-xl border p-4 text-left ${
                active ? "ring-offset-background ring-2 ring-violet-500 ring-offset-2" : ""
              }`;

              if (!filterable) {
                return (
                  <div key={key} className={shell}>
                    {body}
                  </div>
                );
              }

              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    resetPaging();
                    if (key === "critical")
                      setSeverity(severity === "CRITICAL" ? "ALL" : "CRITICAL");
                    if (key === "denied") setOutcome(outcome === "DENIED" ? "ALL" : "DENIED");
                    if (key === "flagged") setFlaggedOnly((v) => !v);
                  }}
                  className={`${shell} hover:border-foreground/20 transition-all`}
                >
                  {body}
                </button>
              );
            })}
          </div>
        )}

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
              <div className="relative max-w-xs min-w-[160px] flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label="Search the activity trail"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetPaging();
                  }}
                  placeholder="Search person, email, restaurant, action…"
                  className="border-border bg-card focus:ring-ring h-9 w-full rounded-md border pr-2 pl-8 text-sm focus:ring-2 focus:outline-none"
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

              {/* Both of these filters could previously be applied by drilling
                  down but never seen or cleared — a dead end you could only
                  escape by reloading the page. */}
              {storeId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="max-w-[240px]"
                  onClick={() => {
                    setStoreId(null);
                    setStoreLabel(null);
                    resetPaging();
                  }}
                >
                  <span className="truncate">Restaurant: {storeLabel ?? storeId.slice(0, 8)}</span>{" "}
                  ✕
                </Button>
              )}

              {targetType !== "ALL" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTargetType("ALL");
                    resetPaging();
                  }}
                >
                  Table: {targetType} ✕
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
          <p className="text-destructive text-sm">
            {error instanceof Error ? error.message : "Could not load the activity log."}
          </p>
        )}

        {!isLoading && view === "timeline" && (
          <TimelineView
            rows={rows}
            onSelect={(r) => setSelectedId(r.id)}
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
            onFilterStore={(store) => {
              setStoreId(store.id);
              setStoreLabel(store.name);
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

        {/* This pages rather than appends — the cursor REPLACES the visible
            rows — so the controls say "page", and the stack the component
            already kept is finally wired to a way back. */}
        {view === "timeline" && (cursorStack.length > 0 || data?.nextCursor) && (
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              disabled={cursorStack.length === 0}
              onClick={() => setCursorStack((s) => s.slice(0, -1))}
            >
              Previous page
            </Button>
            <Button
              variant="outline"
              disabled={!data?.nextCursor}
              onClick={() => setCursorStack((s) => [...s, data!.nextCursor!])}
            >
              Next page
            </Button>
            {cursorStack.length > 0 && (
              <Button variant="ghost" onClick={resetPaging}>
                Back to newest
              </Button>
            )}
          </div>
        )}
      </div>

      <DetailSheet row={selected} onClose={() => setSelectedId(null)} act={act} />
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

      {/* Desktop table. No -mx-4 here: the negative margin exists to cancel the
          page's mobile padding, and this element is display:none below lg. */}
      <div className="hidden overflow-x-auto lg:block">
        <div className="min-w-[980px]">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  When
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Actor
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Action
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Table
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Severity
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  <span className="sr-only">Details</span>
                </th>
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
                    <span className="text-foreground">{r.detail?.targetLabel ?? r.actionCode}</span>
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

function actorLabel(a: ActorRow): string {
  return a.actorName ?? a.actorEmail ?? a.actorRefId?.slice(0, 12) ?? a.actorKind;
}

/**
 * The restaurants an actor worked in.
 *
 * This is the column that makes the view usable: a name on its own identifies
 * nobody. Half the staff in the system are a first name, several of those first
 * names repeat across restaurants, and an owner account is named after the
 * business rather than the person. "Shinta" is a question; "Shinta, cashier at
 * TAHOMA Coffee & Eatery" is an answer.
 */
function StoreCell({
  stores,
  onFilterStore,
}: {
  stores: ActorStoreRef[];
  onFilterStore: (store: ActorStoreRef) => void;
}) {
  if (!stores || stores.length === 0) {
    return (
      <span className="text-muted-foreground text-xs" title="Acted outside any single restaurant">
        Platform-wide
      </span>
    );
  }

  // Two names, then a count. An account that touched nine restaurants must not
  // push the numeric columns off the table to say so.
  const shown = stores.slice(0, 2);
  const rest = stores.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onFilterStore(s)}
          title={`${s.name} — show only this restaurant`}
          className="border-border bg-muted/50 hover:border-foreground/30 max-w-[180px] truncate rounded border px-1.5 py-0.5 text-xs"
        >
          {s.name}
        </button>
      ))}
      {rest > 0 && (
        <span
          className="text-muted-foreground text-xs"
          title={stores.map((s) => s.name).join(", ")}
        >
          +{rest} more
        </span>
      )}
    </div>
  );
}

function ActorsView({
  actors,
  onDrillDown,
  onFilterStore,
}: {
  actors: ActorRow[];
  onDrillDown: (id: string) => void;
  onFilterStore: (store: ActorStoreRef) => void;
}) {
  if (actors.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">No actors recorded yet.</p>
    );
  }

  return (
    <>
      {/* Mobile cards, matching the timeline view. A six-column table dragged
          sideways on a phone is not a view of anything. */}
      <div className="space-y-3 lg:hidden">
        {actors.map((a) => (
          <div
            key={`${a.actorKind}-${a.actorRefId ?? "anon"}`}
            className="border-border bg-card rounded-lg border p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {a.actorRefId ? (
                  <button
                    type="button"
                    onClick={() => onDrillDown(a.actorRefId!)}
                    className="text-foreground block max-w-full truncate text-left text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {actorLabel(a)}
                  </button>
                ) : (
                  <span className="text-muted-foreground text-sm">{a.actorKind}</span>
                )}
                <p className="text-muted-foreground truncate text-xs" title={a.actorEmail ?? ""}>
                  {a.actorEmail ?? "No email on record"}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {a.staffRole ?? a.actorKind}
              </Badge>
            </div>

            <div className="mt-2">
              <StoreCell stores={a.stores} onFilterStore={onFilterStore} />
            </div>

            <p className="text-muted-foreground mt-2 text-xs">
              {a.total} actions
              {a.destructive > 0 && (
                <span className="font-semibold text-red-400"> · {a.destructive} destructive</span>
              )}
              {a.denied > 0 && (
                <span className="font-semibold text-amber-400"> · {a.denied} denied</span>
              )}
              {a.lastSeen ? ` · ${fmtTime(a.lastSeen)}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <div className="min-w-[900px]">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  User
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Restaurant
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Role
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Actions
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Destructive
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Denied
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Last seen
                </th>
              </tr>
            </thead>
            <tbody>
              {actors.map((a) => (
                <tr
                  key={`${a.actorKind}-${a.actorRefId ?? "anon"}`}
                  className="border-border hover:bg-muted/40 border-b"
                >
                  <td className="px-3 py-2 align-top">
                    {a.actorRefId ? (
                      <button
                        type="button"
                        onClick={() => onDrillDown(a.actorRefId!)}
                        title={actorLabel(a)}
                        className="block max-w-[260px] truncate text-left underline-offset-2 hover:underline"
                      >
                        {actorLabel(a)}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">{a.actorKind}</span>
                    )}
                    {/* The email is the only field that separates two people
                        who share a display name. */}
                    <p
                      className="text-muted-foreground max-w-[260px] truncate text-xs"
                      title={a.actorEmail ?? ""}
                    >
                      {a.actorEmail ?? "No email on record"}
                    </p>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StoreCell stores={a.stores} onFilterStore={onFilterStore} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant="outline" className="text-[10px]">
                      {a.staffRole ?? a.actorKind}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right align-top">{a.total}</td>
                  <td
                    className={`px-3 py-2 text-right align-top ${a.destructive > 0 ? "font-semibold text-red-400" : "text-muted-foreground"}`}
                  >
                    {a.destructive}
                  </td>
                  <td
                    className={`px-3 py-2 text-right align-top ${a.denied > 0 ? "font-semibold text-amber-400" : "text-muted-foreground"}`}
                  >
                    {a.denied}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 align-top whitespace-nowrap">
                    {a.lastSeen ? fmtTime(a.lastSeen) : "—"}
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

function EntitiesView({
  entities,
  onDrillDown,
}: {
  entities: any[];
  onDrillDown: (t: string) => void;
}) {
  if (entities.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">No table activity yet.</p>
    );
  }
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <div className="min-w-[520px]">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-border border-b text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Table
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Writes
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Destructive
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Last write
              </th>
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
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Action
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Severity
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Reversibility
                  </th>
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

  const close = () => {
    // Everything in here is scoped to ONE row. Left standing, a revert plan
    // computed for row A stayed on screen when row B was opened and armed
    // "Apply revert" against the wrong action.
    setPlan(null);
    setReason("");
    setNote("");
    onClose();
  };

  const runPlan = async () => {
    if (!actionLogId) return;
    try {
      const res = await act.mutateAsync({ op: "plan", actionLogId });
      setPlan(res.plan);
    } catch (e) {
      // Without this the preview of a DESTRUCTIVE operation could fail with no
      // message at all, leaving the admin staring at an unchanged panel.
      toast.error(e instanceof Error ? e.message : "Could not preview the revert");
    }
  };

  const runRevert = async () => {
    if (!actionLogId) return;
    try {
      await act.mutateAsync({ op: "revert", actionLogId, reason, confirmed: true });
      toast.success("Reverted — the action was undone and recorded.");
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revert");
    }
  };

  return (
    <Sheet open={Boolean(row)} onOpenChange={(o) => !o && close()}>
      {/* dvh, not vh: iOS Safari sizes vh as if the toolbar were hidden, which
          pushes the footer actions of a fixed sheet off-screen. Divided by
          --app-zoom because CSS zoom on <html> does not scale viewport units —
          at 0.7 the panel stopped a third of the way up the screen, at 1.25 the
          revert buttons fell off the bottom. Height, not max-height: the
          primitive already pins the panel with inset-y-0, and a max-height
          fighting that left a strip of bare overlay under the drawer. */}
      <SheetContent className="flex h-[calc(100dvh/var(--app-zoom,1))] w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0">
          {/* pr-10 clears the absolutely-positioned close button. */}
          <SheetTitle className="pr-10 text-base">
            {row?.detail?.targetLabel ?? row?.actionCode}
          </SheetTitle>
        </SheetHeader>

        {/* min-h-0 so this pane actually scrolls instead of being clipped by
            the flex parent's overflow-hidden. px-4 because SheetContent ships
            no padding of its own — without it every field, and the focus ring
            of both textareas, sat flush against the panel edges. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
            <div className="space-y-2.5">
              <label htmlFor="revert-reason" className="text-foreground block text-xs font-medium">
                Why are you reverting this? (required, min 10 characters)
              </label>
              <Textarea
                id="revert-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="This becomes part of the permanent record."
              />
            </div>
          )}

          <div className="space-y-2.5">
            <label htmlFor="activity-note" className="text-foreground block text-xs font-medium">
              Add a note
            </label>
            <Textarea
              id="activity-note"
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
                try {
                  await act.mutateAsync({ op: "annotate", actionLogId, body: note });
                  setNote("");
                  toast.success("Note added");
                } catch {
                  // The shared onError already toasts; this only stops the
                  // rejection from escaping as an unhandled promise, and keeps
                  // the note in the box so it isn't lost.
                }
              }}
            >
              Save note
            </Button>
          </div>
        </div>

        {row?.detail && (
          <div className="border-border flex shrink-0 flex-wrap gap-2 border-t px-4 pt-3 pb-4">
            {/* flex-1 rather than w-full: w-full would claim the whole row on
                top of its siblings and overflow by exactly their width. */}
            {/* Shown whenever there is no *approved* plan. Keying this on `!plan`
                meant a single refusal hid the button for the rest of the
                session, with nothing left to click. */}
            {!plan?.ok && (
              <Button
                className="flex-1"
                disabled={!row.detail.revertable || act.isPending}
                onClick={runPlan}
              >
                {act.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : plan ? (
                  "Preview again"
                ) : (
                  "Preview revert"
                )}
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
