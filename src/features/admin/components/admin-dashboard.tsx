"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, Store, Crown, Search, ChevronDown } from "lucide-react";
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
import { toast } from "sonner";
import { ADMIN_EMAILS } from "@/lib/admin";

type Plan = "FREE" | "POS" | "OPERATIONS" | "ENTERPRISE";
type SubStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  subscription: {
    plan: Plan;
    status: SubStatus;
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

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<Plan | "ALL">("ALL");

  const { data, isLoading } = useQuery<{ users: UserRow[] }>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; plan: Plan; status: SubStatus }) =>
      fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Subscription updated");
    },
    onError: () => toast.error("Failed to update"),
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
    noSub: users.filter((u) => !u.subscription).length,
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
            { label: "Enterprise", value: stats.enterprise, icon: Shield, color: "text-violet-400" },
            { label: "No Subscription", value: stats.noSub, icon: Store, color: "text-amber-400" },
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
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">User</TableHead>
                <TableHead className="text-muted-foreground">Business</TableHead>
                <TableHead className="text-muted-foreground">Plan</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Joined</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading users...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((user) => {
                const isAdmin = (ADMIN_EMAILS as readonly string[]).includes(user.email);
                const plan = user.subscription?.plan ?? "FREE";
                const status = user.subscription?.status ?? "INCOMPLETE";

                return (
                  <TableRow key={user.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground uppercase">
                          {(user.name?.[0] ?? user.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            {user.name ?? "—"}
                            {isAdmin && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400">
                                <Shield className="h-2.5 w-2.5" /> Admin
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.business ? (
                        <div>
                          <p className="text-sm text-foreground">{user.business.name}</p>
                          <p className="text-xs text-muted-foreground">{user.business._count.stores} store{user.business._count.stores !== 1 ? "s" : ""}</p>
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
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                            Edit <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Set Plan</DropdownMenuLabel>
                          {PLAN_ORDER.map((p) => (
                            <DropdownMenuItem
                              key={p}
                              disabled={plan === p || mutation.isPending}
                              onClick={() =>
                                mutation.mutate({ userId: user.id, plan: p, status: "ACTIVE" })
                              }
                            >
                              <span className={`mr-2 h-2 w-2 rounded-full inline-block ${plan === p ? "bg-emerald-400" : "bg-muted"}`} />
                              {p}
                              {plan === p && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Set Status</DropdownMenuLabel>
                          {(["ACTIVE", "CANCELED", "INCOMPLETE"] as SubStatus[]).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              disabled={status === s || mutation.isPending}
                              onClick={() =>
                                mutation.mutate({ userId: user.id, plan: plan as Plan, status: s })
                              }
                            >
                              <span className={`mr-2 h-2 w-2 rounded-full inline-block ${s === "ACTIVE" ? "bg-emerald-400" : s === "CANCELED" ? "bg-red-400" : "bg-zinc-400"}`} />
                              {s}
                              {status === s && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          {filtered.length} of {users.length} users — Master Admin Panel v1
        </p>
      </div>
    </div>
  );
}
