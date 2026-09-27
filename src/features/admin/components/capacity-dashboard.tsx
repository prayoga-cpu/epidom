"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Database,
  HardDrive,
  Image as ImageIcon,
  Store,
  Users,
  AlertCircle,
  Gauge,
  Triangle,
  Zap,
  Archive,
  CheckCircle2,
  XCircle,
  Loader2,
  DatabaseBackup,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ACTIVE_RUN_WINDOW_MINUTES,
  NIGHTLY_RUN_ID_PREFIX,
  activeRunWindowMs,
} from "@/lib/backup/constants";

interface TableRow {
  name: string;
  totalBytes: number;
  rowEstimate: number;
}
interface GrowthRow {
  table: string;
  last24h: number;
  last7d: number;
  last30d: number;
}
interface CapacityData {
  generatedAt: string;
  db: { totalBytes: number; tables: TableRow[] };
  growth: GrowthRow[];
  tenants: {
    storeCount: number;
    userCount: number;
    ordersByDay: { date: string; count: number }[];
  };
  blob: { count: number; totalBytes: number } | null;
}

interface VercelUsage {
  periodStart: string;
  periodEnd: string;
  totalCostUsd: number;
  byService: Array<{
    serviceName: string;
    consumedQuantity: number;
    consumedUnit: string;
    costUsd: number;
  }>;
}
interface NeonUsage {
  storageBytes: number;
  storageLimitBytes: number | null;
  computeTimeSeconds: number;
  computeLimitSeconds: number | null;
  activeTimeSeconds: number;
  activeLimitSeconds: number | null;
  dataTransferBytes: number;
  dataTransferLimitBytes: number | null;
}
interface PlatformUsageData {
  vercel: VercelUsage | null;
  vercelError?: string;
  neon: NeonUsage | null;
  neonError?: string;
}

interface BackupRunRow {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  tableCount: number;
  totalRows: number;
  totalBytes: string;
  errorMessage: string | null;
}
interface BackupsData {
  r2Configured: boolean;
  lastSuccess: {
    finishedAt: string | null;
    tableCount: number;
    totalRows: number;
    totalBytes: string;
  } | null;
  history: BackupRunRow[];
}

const STALE_AFTER_HOURS = 36;

const BACKUP_STATUS_STYLE: Record<BackupRunRow["status"], string> = {
  SUCCESS: "text-emerald-500",
  FAILED: "text-red-500",
  RUNNING: "text-blue-500",
};
const BACKUP_STATUS_ICON: Record<BackupRunRow["status"], typeof CheckCircle2> = {
  SUCCESS: CheckCircle2,
  FAILED: XCircle,
  RUNNING: Loader2,
};

/** A RUNNING row older than its window (constants.ts) was abandoned, not running. */
function isActiveRun(run: BackupRunRow): boolean {
  return (
    run.status === "RUNNING" &&
    Date.now() - new Date(run.startedAt).getTime() < activeRunWindowMs(run.id)
  );
}

/** Any run in flight, nightly included: the page keeps polling while one is. */
function activeBackupRun(data: BackupsData | undefined): BackupRunRow | undefined {
  return data?.history.find(isActiveRun);
}

/** Only a manual run blocks the button. A nightly writes its own folder, and the
 *  button has to keep working while a nightly is stuck. */
function activeManualRun(data: BackupsData | undefined): BackupRunRow | undefined {
  return data?.history.find((r) => isActiveRun(r) && !r.id.startsWith(NIGHTLY_RUN_ID_PREFIX));
}

/** Admin routes answer `{ error: "..." }`; errors thrown inside them `{ error: { message } }`. */
function apiErrorMessage(json: unknown, fallback: string): string {
  const error = (json as { error?: unknown } | null)?.error;
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : fallback;
}

function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

function pct(used: number, limit: number | null): number | null {
  if (!limit || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function OrdersTrendChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <defs>
          <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-line)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--chart-grid)"
          strokeWidth={1}
          strokeDasharray="5"
          horizontal={true}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          stroke="var(--chart-axis)"
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          stroke="var(--chart-axis)"
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--chart-line)"
          strokeWidth={3}
          fill="url(#colorOrders)"
          dot={false}
          activeDot={{ r: 5, fill: "var(--chart-line)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CapacityDashboard() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery<{ data: CapacityData }>({
    queryKey: ["admin-capacity"],
    queryFn: async () => {
      const res = await fetch("/api/admin/capacity");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.detail || json?.error || "Failed to fetch capacity");
      return json;
    },
  });

  const capacity = data?.data;

  const { data: platformData, isLoading: platformLoading } = useQuery<{ data: PlatformUsageData }>({
    queryKey: ["admin-platform-usage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/platform-usage");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to fetch platform usage");
      return json;
    },
  });
  const platform = platformData?.data;

  const {
    data: backupsData,
    isLoading: backupsLoading,
    // Read so every poll re-renders even when the rows come back identical:
    // that is how a run that ages out of the active window stops showing as
    // in flight once polling ends.
    dataUpdatedAt: backupsUpdatedAt,
  } = useQuery<{ data: BackupsData }>({
    queryKey: ["admin-backups"],
    queryFn: async () => {
      const res = await fetch("/api/admin/backups");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, "Failed to fetch backups"));
      return json;
    },
    // Poll while a run is in flight so its row settles without a reload.
    refetchInterval: (query) => (activeBackupRun(query.state.data?.data) ? 3000 : false),
  });
  const backups = backupsData?.data;
  const activeRun = activeManualRun(backups);

  const queryClient = useQueryClient();
  // The run this admin started, so its outcome can be announced when it lands.
  const startedRunId = useRef<string | null>(null);
  const runBackup = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, "Failed to start the backup"));
      return json.data as { runId: string; folder: string };
    },
    // Starting a backup isn't idempotent: never resend on failure.
    retry: false,
    onSuccess: ({ runId }) => {
      startedRunId.current = runId;
      toast.success("Backup started");
    },
    onError: (e: Error) => toast.error(e.message),
    // Returned so the button stays pending until the RUNNING row (ours, or the
    // one a 409 refers to) is on screen and polling has started.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-backups"] }),
  });

  useEffect(() => {
    const run = backups?.history.find((r) => r.id === startedRunId.current);
    if (!run || isActiveRun(run)) return;
    startedRunId.current = null;
    if (run.status === "SUCCESS") {
      toast.success(
        `Backup finished: ${run.tableCount} tables, ${formatBytes(Number(run.totalBytes))}`
      );
    } else if (run.status === "FAILED") {
      toast.error(`Backup failed: ${run.errorMessage ?? "unknown error"}`);
    } else {
      toast.error(
        `The backup never finished (still running after ${ACTIVE_RUN_WINDOW_MINUTES} minutes).`
      );
    }
  }, [backups, backupsUpdatedAt]);
  const lastSuccessHoursAgo = backups?.lastSuccess?.finishedAt
    ? (Date.now() - new Date(backups.lastSuccess.finishedAt).getTime()) / (60 * 60 * 1000)
    : null;
  const backupsStale = lastSuccessHoursAgo === null || lastSuccessHoursAgo > STALE_AFTER_HOURS;

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Failed to load capacity data."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-[calc(100vh/var(--app-zoom,1))]">
      {/* Header */}
      <div className="border-border bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
              <Gauge className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-foreground text-lg font-bold">Capacity & Usage</h1>
              <p className="text-muted-foreground text-xs">
                Database, storage, and tenant scale — early warning before a plan limit hits.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* Top cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Database className="h-4 w-4 text-blue-500" /> Database Size
              </CardDescription>
              <CardTitle className="text-2xl">
                {isLoading ? <Skeleton className="h-8 w-24" /> : formatBytes(capacity?.db.totalBytes ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">Total Postgres storage (all tables).</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <ImageIcon className="h-4 w-4 text-violet-500" /> Blob Storage
              </CardDescription>
              <CardTitle className="text-2xl">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : capacity?.blob ? (
                  formatBytes(capacity.blob.totalBytes)
                ) : (
                  <span className="text-muted-foreground text-base font-normal">Not configured</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">
                {capacity?.blob
                  ? `${capacity.blob.count.toLocaleString()} objects (menu photos, receipts, logos).`
                  : "Set BLOB_READ_WRITE_TOKEN to enable."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Store className="h-4 w-4 text-emerald-500" /> Stores
              </CardDescription>
              <CardTitle className="text-2xl">
                {isLoading ? <Skeleton className="h-8 w-16" /> : capacity?.tenants.storeCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">Total stores across all businesses.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-medium">
                <Users className="h-4 w-4 text-amber-500" /> Users
              </CardDescription>
              <CardTitle className="text-2xl">
                {isLoading ? <Skeleton className="h-8 w-16" /> : capacity?.tenants.userCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">Total registered accounts.</p>
            </CardContent>
          </Card>
        </div>

        {/* Platform usage */}
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Platform Usage</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Triangle className="h-4 w-4" /> Vercel — This Billing Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                {platformLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : platform?.vercel ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      ${platform.vercel.totalCostUsd.toFixed(2)}
                      <span className="text-muted-foreground ml-1 text-xs font-normal">
                        so far this period
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {platform.vercel.byService.length === 0 ? (
                        <p className="text-muted-foreground text-xs">
                          No billable usage this period.
                        </p>
                      ) : (
                        platform.vercel.byService.slice(0, 6).map((s) => (
                          <div
                            key={`${s.serviceName}-${s.consumedUnit}`}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-muted-foreground">{s.serviceName}</span>
                            <span className="text-foreground tabular-nums">
                              {s.consumedQuantity.toLocaleString()} {s.consumedUnit}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-muted-foreground pt-1 text-[11px]">
                      Vercel doesn&apos;t expose per-account plan limits via API — compare against{" "}
                      vercel.com/docs/limits.
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {platform?.vercelError
                      ? `Error: ${platform.vercelError}`
                      : "Not configured — add VERCEL_API_TOKEN and VERCEL_TEAM_ID to enable."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" /> Neon — Storage & Compute
                </CardTitle>
              </CardHeader>
              <CardContent>
                {platformLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : platform?.neon ? (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Storage</span>
                        <span className="text-foreground tabular-nums">
                          {formatBytes(platform.neon.storageBytes)}
                          {platform.neon.storageLimitBytes
                            ? ` / ${formatBytes(platform.neon.storageLimitBytes)}`
                            : ""}
                        </span>
                      </div>
                      {pct(platform.neon.storageBytes, platform.neon.storageLimitBytes) !== null && (
                        <Progress
                          value={pct(platform.neon.storageBytes, platform.neon.storageLimitBytes)!}
                        />
                      )}
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Compute time</span>
                        <span className="text-foreground tabular-nums">
                          {formatHours(platform.neon.computeTimeSeconds)}
                          {platform.neon.computeLimitSeconds
                            ? ` / ${formatHours(platform.neon.computeLimitSeconds)}`
                            : ""}
                        </span>
                      </div>
                      {pct(platform.neon.computeTimeSeconds, platform.neon.computeLimitSeconds) !==
                        null && (
                        <Progress
                          value={
                            pct(platform.neon.computeTimeSeconds, platform.neon.computeLimitSeconds)!
                          }
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {platform?.neonError
                      ? `Error: ${platform.neonError}`
                      : "Not configured — add NEON_API_KEY and NEON_PROJECT_ID to enable."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Backups */}
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Archive className="text-muted-foreground h-5 w-5" />
                Database Backups
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Nightly at 02:00 UTC by the Inngest cron, kept 90 days in Cloudflare R2.
              </p>
            </div>
            <Button
              size="lg"
              variant="outline"
              onClick={() => runBackup.mutate()}
              disabled={!backups?.r2Configured || !!activeRun || runBackup.isPending}
            >
              {activeRun || runBackup.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <DatabaseBackup />
              )}
              {activeRun ? "Backing up…" : "Run backup now"}
            </Button>
          </div>
          <Card>
            <CardContent className="space-y-4 pt-4">
              {backupsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : backups?.lastSuccess ? (
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs">Last Successful Backup</p>
                    <p
                      className={`text-lg font-bold ${backupsStale ? "text-amber-500" : "text-emerald-500"}`}
                    >
                      {new Date(backups.lastSuccess.finishedAt!).toLocaleString()}
                      {backupsStale && " ⚠ stale"}
                    </p>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {backups.lastSuccess.tableCount} tables ·{" "}
                    {backups.lastSuccess.totalRows.toLocaleString()} rows ·{" "}
                    {formatBytes(Number(backups.lastSuccess.totalBytes))} compressed
                  </div>
                </div>
              ) : backups?.r2Configured ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>R2 is configured — no backup has run yet</AlertTitle>
                  <AlertDescription>
                    The nightly job runs at 02:00 UTC. Use Run backup now to take one immediately
                    instead of waiting.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No successful backup recorded yet</AlertTitle>
                  <AlertDescription>
                    Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to
                    enable the nightly backup job.
                  </AlertDescription>
                </Alert>
              )}

              {(backups?.history.length ?? 0) > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs tracking-wide uppercase">
                        <th className="px-2 py-2 text-left font-medium">Status</th>
                        <th className="px-2 py-2 text-left font-medium">Started</th>
                        <th className="px-2 py-2 text-right font-medium">Tables</th>
                        <th className="px-2 py-2 text-right font-medium">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups!.history.map((run) => {
                        // Still RUNNING past the window: the process died before it
                        // could record an outcome. The next claim marks it FAILED.
                        const abandoned = run.status === "RUNNING" && !isActiveRun(run);
                        const status = abandoned ? "FAILED" : run.status;
                        const Icon = BACKUP_STATUS_ICON[status];
                        return (
                          <tr key={run.id} className="border-border/60 border-b last:border-0">
                            <td className="px-2 py-2">
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-medium ${BACKUP_STATUS_STYLE[status]}`}
                                title={run.errorMessage ?? undefined}
                              >
                                <Icon
                                  className={`h-3.5 w-3.5 ${status === "RUNNING" ? "animate-spin" : ""}`}
                                />
                                {abandoned ? "ABANDONED" : run.status}
                              </span>
                            </td>
                            <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                              {new Date(run.startedAt).toLocaleString()}
                            </td>
                            <td className="text-muted-foreground px-2 py-2 text-right tabular-nums">
                              {run.tableCount || "—"}
                            </td>
                            <td className="text-muted-foreground px-2 py-2 text-right tabular-nums">
                              {Number(run.totalBytes) > 0 ? formatBytes(Number(run.totalBytes)) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders trend */}
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Orders / Day (last 30 days)</h2>
          <Card>
            <CardContent className="h-64 pt-4">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (capacity?.tenants.ordersByDay.length ?? 0) > 0 ? (
                <OrdersTrendChart data={capacity!.tenants.ordersByDay} />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  No orders in the last 30 days.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Table growth */}
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Fastest-Growing Tables{" "}
            <span className="text-muted-foreground text-sm font-normal">(new rows written)</span>
          </h2>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs tracking-wide uppercase">
                        <th className="px-4 py-3 text-left font-medium">Table</th>
                        <th className="px-4 py-3 text-right font-medium">Last 24h</th>
                        <th className="px-4 py-3 text-right font-medium">Last 7d</th>
                        <th className="px-4 py-3 text-right font-medium">Last 30d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(capacity?.growth ?? [])
                        .slice()
                        .sort((a, b) => b.last30d - a.last30d)
                        .map((g) => (
                          <tr key={g.table} className="border-border/60 border-b last:border-0">
                            <td className="text-foreground px-4 py-3 font-medium">{g.table}</td>
                            <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                              {g.last24h.toLocaleString()}
                            </td>
                            <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                              {g.last7d.toLocaleString()}
                            </td>
                            <td className="text-foreground px-4 py-3 text-right font-semibold tabular-nums">
                              {g.last30d.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Largest tables by size */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <HardDrive className="text-muted-foreground h-5 w-5" />
            Largest Tables by Disk Size
          </h2>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-xs tracking-wide uppercase">
                        <th className="px-4 py-3 text-left font-medium">Table</th>
                        <th className="px-4 py-3 text-right font-medium">Rows (est.)</th>
                        <th className="px-4 py-3 text-right font-medium">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(capacity?.db.tables ?? []).map((t) => (
                        <tr key={t.name} className="border-border/60 border-b last:border-0">
                          <td className="text-foreground px-4 py-3 font-medium">{t.name}</td>
                          <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                            {t.rowEstimate.toLocaleString()}
                          </td>
                          <td className="text-foreground px-4 py-3 text-right font-semibold tabular-nums">
                            {formatBytes(t.totalBytes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
