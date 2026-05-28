"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, Store, Crown, Search, ChevronDown, Trash2, Calendar, ShieldCheck, ShieldOff, Infinity, KeyRound, Eye, EyeOff, LogIn, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { HARDCODED_ADMIN_EMAILS } from "@/lib/admin";
import { useUser } from "@/lib/auth-client";

type Plan = "FREE" | "POS" | "OPERATIONS" | "ENTERPRISE";
type SubStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  providers: string[];
  hasPassword: boolean;
  subscription: {
    plan: Plan;
    status: SubStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string;
  } | null;
  business: {
    id: string;
    name: string;
    _count: { stores: number };
  } | null;
}

const PLAN_ORDER: Plan[] = ["FREE", "POS", "OPERATIONS", "ENTERPRISE"];

const planColors: Record<Plan, string> = {
  FREE: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  POS: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  OPERATIONS: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ENTERPRISE: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

const statusColors: Record<SubStatus, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CANCELED: "bg-red-500/15 text-red-400 border-red-500/30",
  PAST_DUE: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  INCOMPLETE: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const PERIOD_OPTIONS = [
  { label: "1 month", months: 1 },
  { label: "2 months", months: 2 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "2 years", months: 24 },
  { label: "Lifetime ∞", months: null },
];

function formatPeriodEnd(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const lifetime = new Date();
  lifetime.setFullYear(lifetime.getFullYear() + 50);
  if (d > lifetime) return "Lifetime ∞";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const { user: me } = useUser();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<Plan | "ALL">("ALL");

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Password reset dialog state
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Temp password dialog state
  const [tempPwUser, setTempPwUser] = useState<UserRow | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tempLoading, setTempLoading] = useState(false);

  const { data, isLoading } = useQuery<{ users: UserRow[] }>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/admin/users", {
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
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if ((vars as any).action === "delete-user") {
        setDeleteTarget(null);
        setDeleteConfirm("");
        toast.success("Account deleted");
      } else if ((vars as any).action === "reset-password") {
        setPwTarget(null);
        setNewPw("");
        toast.success("Password updated");
      } else if ((vars as any).action === "set-admin") {
        toast.success((vars as any).isAdmin ? "Admin access granted" : "Admin access revoked");
      } else if ((vars as any).action === "set-period") {
        toast.success("Subscription period updated");
      } else {
        toast.success("Subscription updated");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const users = data?.users ?? [];

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchPlan =
      planFilter === "ALL" || (u.subscription?.plan ?? "FREE") === planFilter;
    return matchSearch && matchPlan;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.subscription?.status === "ACTIVE").length,
    enterprise: users.filter((u) => u.subscription?.plan === "ENTERPRISE").length,
    admins: users.filter((u) => u.isAdmin || (HARDCODED_ADMIN_EMAILS as readonly string[]).includes(u.email)).length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 border border-red-500/30">
              <Shield className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Master Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Epidom internal — restricted access</p>
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Users", value: stats.total, icon: Users, color: "text-blue-400" },
            { label: "Active Subs", value: stats.active, icon: Crown, color: "text-emerald-400" },
            { label: "Enterprise", value: stats.enterprise, icon: Store, color: "text-violet-400" },
            { label: "Admins", value: stats.admins, icon: Shield, color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as Plan | "ALL")}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Plans</SelectItem>
              {PLAN_ORDER.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Login</TableHead>
                  <TableHead className="text-muted-foreground">Business</TableHead>
                  <TableHead className="text-muted-foreground">Plan</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Period End</TableHead>
                  <TableHead className="text-muted-foreground">Joined</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Loading users...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((user) => {
                  const isHardcodedAdmin = (HARDCODED_ADMIN_EMAILS as readonly string[]).includes(user.email);
                  const isAdminUser = user.isAdmin || isHardcodedAdmin;
                  const plan = user.subscription?.plan ?? "FREE";
                  const status = user.subscription?.status ?? "INCOMPLETE";
                  const isSelf = me?.id === user.id;

                  return (
                    <TableRow key={user.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase ${isAdminUser ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-muted text-foreground"}`}>
                            {(user.name?.[0] ?? user.email[0]).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                              {user.name ?? "—"}
                              {isAdminUser && (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400">
                                  <Shield className="h-2.5 w-2.5" />
                                  {isHardcodedAdmin ? "Master" : "Admin"}
                                </span>
                              )}
                              {isSelf && (
                                <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-400">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(user.providers ?? []).map((p) => (
                            <span key={p} className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              p === "credential"
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                : p === "google"
                                ? "bg-red-500/15 text-red-400 border-red-500/30"
                                : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                            }`}>
                              {p === "credential" ? "🔑 Password" : p === "google" ? "G Google" : p}
                            </span>
                          ))}
                          {(user.providers ?? []).length === 0 && (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.business ? (
                          <div>
                            <p className="text-sm text-foreground">{user.business.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.business._count.stores} store{user.business._count.stores !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No business</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${planColors[plan as Plan]}`}>
                          {plan}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColors[status as SubStatus]}`}>
                          {status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatPeriodEnd(user.subscription?.currentPeriodEnd)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                              Manage <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">

                            {/* Plan */}
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Set Plan</DropdownMenuLabel>
                            {PLAN_ORDER.map((p) => (
                              <DropdownMenuItem
                                key={p}
                                disabled={plan === p || mutation.isPending}
                                onClick={() =>
                                  mutation.mutate({ action: "set-plan", userId: user.id, plan: p, status: "ACTIVE" })
                                }
                              >
                                <span className={`mr-2 h-2 w-2 rounded-full inline-block ${plan === p ? "bg-emerald-400" : "bg-muted"}`} />
                                {p}
                                {plan === p && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                              </DropdownMenuItem>
                            ))}

                            <DropdownMenuSeparator />

                            {/* Period */}
                            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" /> Set Duration
                            </DropdownMenuLabel>
                            {PERIOD_OPTIONS.map(({ label, months }) => (
                              <DropdownMenuItem
                                key={label}
                                disabled={mutation.isPending}
                                onClick={() =>
                                  mutation.mutate({
                                    action: "set-period",
                                    userId: user.id,
                                    ...(months === null ? { lifetime: true } : { months }),
                                  })
                                }
                              >
                                {months === null
                                  ? <Infinity className="mr-2 h-3.5 w-3.5 text-violet-400" />
                                  : <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                }
                                {label}
                              </DropdownMenuItem>
                            ))}

                            <DropdownMenuSeparator />

                            {/* Status */}
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Set Status</DropdownMenuLabel>
                            {(["ACTIVE", "CANCELED", "INCOMPLETE"] as SubStatus[]).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={status === s || mutation.isPending}
                                onClick={() =>
                                  mutation.mutate({ action: "set-plan", userId: user.id, plan: plan as Plan, status: s })
                                }
                              >
                                <span className={`mr-2 h-2 w-2 rounded-full inline-block ${s === "ACTIVE" ? "bg-emerald-400" : s === "CANCELED" ? "bg-red-400" : "bg-zinc-400"}`} />
                                {s}
                                {status === s && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                              </DropdownMenuItem>
                            ))}

                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator />

                                {/* Password reset */}
                                <DropdownMenuItem
                                  className="text-blue-400 focus:text-blue-400 focus:bg-blue-500/10"
                                  onClick={() => { setPwTarget(user); setNewPw(""); setShowPw(false); }}
                                >
                                  <KeyRound className="mr-2 h-3.5 w-3.5" />
                                  {user.hasPassword ? "Reset Password" : "Set Password"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-emerald-400 focus:text-emerald-400 focus:bg-emerald-500/10"
                                  disabled={tempLoading}
                                  onClick={async () => {
                                    setTempPwUser(user);
                                    setTempPw(null);
                                    setCopied(false);
                                    setTempLoading(true);
                                    try {
                                      const res = await fetch("/api/admin/users", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "temp-password", userId: user.id }),
                                      });
                                      const json = await res.json();
                                      if (!res.ok) throw new Error(json.error ?? "Failed");
                                      setTempPw(json.tempPassword);
                                    } catch (e: any) {
                                      toast.error(e.message || "Failed to generate temp password");
                                      setTempPwUser(null);
                                    } finally {
                                      setTempLoading(false);
                                    }
                                  }}
                                >
                                  <LogIn className="mr-2 h-3.5 w-3.5" />
                                  Get Temp Access
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {/* Admin access */}
                                <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Shield className="h-3 w-3" /> Admin Access
                                </DropdownMenuLabel>
                                {!isHardcodedAdmin && (
                                  user.isAdmin ? (
                                    <DropdownMenuItem
                                      className="text-orange-400 focus:text-orange-400"
                                      disabled={mutation.isPending}
                                      onClick={() =>
                                        mutation.mutate({ action: "set-admin", userId: user.id, isAdmin: false })
                                      }
                                    >
                                      <ShieldOff className="mr-2 h-3.5 w-3.5" />
                                      Revoke Admin
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      className="text-red-400 focus:text-red-400"
                                      disabled={mutation.isPending}
                                      onClick={() =>
                                        mutation.mutate({ action: "set-admin", userId: user.id, isAdmin: true })
                                      }
                                    >
                                      <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                      Grant Admin
                                    </DropdownMenuItem>
                                  )
                                )}
                                {isHardcodedAdmin && (
                                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                    <Shield className="mr-2 h-3.5 w-3.5" /> Hardcoded master
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                {/* Delete */}
                                <DropdownMenuItem
                                  className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                  onClick={() => { setDeleteTarget(user); setDeleteConfirm(""); }}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Delete Account
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          {filtered.length} of {users.length} users — Master Admin Panel v2
        </p>
      </div>

      {/* Temp access dialog */}
      <Dialog open={!!tempPwUser} onOpenChange={(open) => { if (!open) { setTempPwUser(null); setTempPw(null); setCopied(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-emerald-400" />
              Temporary Access
            </DialogTitle>
            <DialogDescription>
              A one-time temp password has been set for{" "}
              <strong>{tempPwUser?.email}</strong>. Use it to log in as this user.
              It replaces their existing password — remember to reset it after.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!tempPw ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-emerald-400" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Login credentials:</p>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</p>
                      <p className="text-sm font-mono text-foreground">{tempPwUser?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Temp Password</p>
                      <p className="text-base font-mono font-bold tracking-widest text-emerald-500">{tempPw}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-8 gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(tempPw);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-amber-500/80">
                  ⚠ This password is shown only once and will not be displayed again.
                  After logging in, reset the account password or the user can change it themselves.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTempPwUser(null); setTempPw(null); setCopied(false); }}>
              Close
            </Button>
            {tempPw && (
              <Button
                onClick={() => window.open("/login", "_blank")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Open Login Page
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset dialog */}
      <Dialog open={!!pwTarget} onOpenChange={(open) => { if (!open) setPwTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-400" />
              {pwTarget?.hasPassword ? "Reset Password" : "Set Password"}
            </DialogTitle>
            <DialogDescription>
              {pwTarget?.hasPassword
                ? `Replace the existing password for ${pwTarget?.email}.`
                : `Create a password login for ${pwTarget?.email}. They currently sign in via OAuth only.`}
              <br />
              <span className="text-xs text-muted-foreground mt-1 inline-block">
                Passwords are hashed with bcrypt before saving — not stored in plaintext.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">New password (min 8 characters)</p>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Enter new password"
                className="pr-10 font-mono text-sm"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwTarget(null)}>Cancel</Button>
            <Button
              disabled={newPw.length < 8 || mutation.isPending}
              onClick={() => {
                if (pwTarget) {
                  mutation.mutate({ action: "reset-password", userId: pwTarget.id, newPassword: newPw });
                }
              }}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {pwTarget?.hasPassword ? "Update Password" : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Delete Account</DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{deleteTarget?.email}</strong> and all their data
              (stores, products, orders, subscriptions). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">
              Type the email address to confirm:
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget?.email}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== deleteTarget?.email || mutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  mutation.mutate({ action: "delete-user", userId: deleteTarget.id });
                }
              }}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
