"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar,
  Store,
  Package,
  ShoppingCart,
  Users,
  Key,
  Trash2,
  Link2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { formatDate } from "@/lib/utils/format-date";

interface AccountData {
  createdAt: string;
  dataUsage: {
    totalStores: number;
    totalProducts: number;
    totalOrders: number;
    totalStaff: number;
  };
  linkedAccounts: Array<{
    provider: string;
    accountId: string;
    connectedAt: string;
  }>;
  hasPasswordAccount: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  credential: "Email & Password",
};

const PROVIDER_ICONS: Record<string, string> = {
  google: "G",
  github: "GH",
  credential: "🔑",
};

async function fetchAccountSettings(): Promise<AccountData> {
  const res = await fetch("/api/user/account-settings");
  if (!res.ok) throw new Error("Failed to load account settings");
  const json = await res.json();
  return json.data;
}

async function postAccountAction(body: Record<string, unknown>) {
  const res = await fetch("/api/user/account-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || json.error || "Request failed");
  return json.data;
}

export function AccountSettingsCard({ userEmail }: { userEmail: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["account-settings"],
    queryFn: fetchAccountSettings,
  });

  // Change password dialog
  const [pwDialog, setPwDialog] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Delete account dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

  const changePwMutation = useMutation({
    mutationFn: () =>
      postAccountAction({
        action: "change-password",
        currentPassword: currentPw,
        newPassword: newPw,
      }),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setPwDialog(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () =>
      postAccountAction({ action: "delete-account", confirmEmail: deleteConfirmEmail }),
    onSuccess: async () => {
      toast.success("Account deleted. Signing out...");
      await signOut();
      window.location.href = "/";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleChangePw = () => {
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    changePwMutation.mutate();
  };

  return (
    <>
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Account Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Account Created */}
              {data?.createdAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Account created</span>
                  <span className="font-medium ml-auto">{formatDate(new Date(data.createdAt))}</span>
                </div>
              )}

              <Separator />

              {/* Data Usage */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Data Usage</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DataStat icon={Store} label="Stores" value={data?.dataUsage.totalStores ?? 0} />
                  <DataStat icon={Package} label="Products" value={data?.dataUsage.totalProducts ?? 0} />
                  <DataStat icon={ShoppingCart} label="Orders" value={data?.dataUsage.totalOrders ?? 0} />
                  <DataStat icon={Users} label="Staff" value={data?.dataUsage.totalStaff ?? 0} />
                </div>
              </div>

              <Separator />

              {/* Linked Accounts */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Linked Accounts
                </p>
                {data?.linkedAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No linked accounts</p>
                ) : (
                  <div className="space-y-2">
                    {data?.linkedAccounts.map((acc) => (
                      <div
                        key={acc.provider}
                        className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background border text-xs font-bold shrink-0">
                          {PROVIDER_ICONS[acc.provider] ?? acc.provider[0].toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{PROVIDER_LABELS[acc.provider] ?? acc.provider}</p>
                          {acc.connectedAt && (
                            <p className="text-xs text-muted-foreground">
                              Connected {formatDate(new Date(acc.connectedAt))}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-emerald-600 border-emerald-400 text-xs shrink-0">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Security</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {data?.hasPasswordAccount && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setPwDialog(true)}
                    >
                      <Key className="h-4 w-4" />
                      Change Password
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={pwDialog} onOpenChange={setPwDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
              />
            </div>
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
              />
            </div>
            <div className="space-y-1">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(false)}>Cancel</Button>
            <Button onClick={handleChangePw} disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This is permanent. All your stores, products, orders, and data will be deleted and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>
              Type your email <span className="font-semibold">{userEmail}</span> to confirm
            </Label>
            <Input
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder={userEmail}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteConfirmEmail !== userEmail || deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete My Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DataStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/30 p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
