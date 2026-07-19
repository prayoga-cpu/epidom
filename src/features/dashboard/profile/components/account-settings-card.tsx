"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
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
  const { t } = useI18n();
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
      toast.success(t("profile.accountSettings.passwordChanged"));
      setPwDialog(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () =>
      postAccountAction({ action: "delete-account", confirmEmail: deleteConfirmEmail }),
    onSuccess: async () => {
      toast.success(t("profile.accountSettings.accountDeleted"));
      await signOut();
      window.location.href = "/";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleChangePw = () => {
    if (newPw !== confirmPw) {
      toast.error(t("profile.accountSettings.passwordsDoNotMatch"));
      return;
    }
    if (newPw.length < 8) {
      toast.error(t("profile.accountSettings.passwordMinLength"));
      return;
    }
    changePwMutation.mutate();
  };

  return (
    <>
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="text-muted-foreground h-5 w-5" />
            {t("profile.accountSettings.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* Account Created */}
              {data?.createdAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">
                    {t("profile.accountSettings.accountCreated")}
                  </span>
                  <span className="ml-auto font-medium">
                    {formatDate(new Date(data.createdAt))}
                  </span>
                </div>
              )}

              <Separator />

              {/* Data Usage */}
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  {t("profile.accountSettings.dataUsage")}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DataStat
                    icon={Store}
                    label={t("profile.accountSettings.stores")}
                    value={data?.dataUsage.totalStores ?? 0}
                  />
                  <DataStat
                    icon={Package}
                    label={t("profile.accountSettings.products")}
                    value={data?.dataUsage.totalProducts ?? 0}
                  />
                  <DataStat
                    icon={ShoppingCart}
                    label={t("profile.accountSettings.orders")}
                    value={data?.dataUsage.totalOrders ?? 0}
                  />
                  <DataStat
                    icon={Users}
                    label={t("profile.accountSettings.staff")}
                    value={data?.dataUsage.totalStaff ?? 0}
                  />
                </div>
              </div>

              <Separator />

              {/* Linked Accounts */}
              <div className="space-y-3">
                <p className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                  <Link2 className="h-4 w-4" />
                  {t("profile.accountSettings.linkedAccounts")}
                </p>
                {data?.linkedAccounts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("profile.accountSettings.noLinkedAccounts")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data?.linkedAccounts.map((acc) => (
                      <div
                        key={acc.provider}
                        className="bg-muted/30 flex items-center gap-3 rounded-lg border px-3 py-2.5"
                      >
                        <span className="bg-background flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                          {PROVIDER_ICONS[acc.provider] ?? acc.provider?.[0]?.toUpperCase() ?? "A"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {PROVIDER_LABELS[acc.provider] ?? acc.provider}
                          </p>
                          {acc.connectedAt && (
                            <p className="text-muted-foreground text-xs">
                              {t("profile.accountSettings.connected")}{" "}
                              {formatDate(new Date(acc.connectedAt))}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-emerald-400 text-xs text-emerald-600"
                        >
                          {t("common.status.Active")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  {t("profile.accountSettings.security")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {data?.hasPasswordAccount && (
                    <Button variant="outline" className="gap-2" onClick={() => setPwDialog(true)}>
                      <Key className="h-4 w-4" />
                      {t("profile.accountSettings.changePassword")}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive gap-2"
                    onClick={() => setDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("profile.accountSettings.deleteAccount")}
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
            <DialogTitle>{t("profile.accountSettings.changePassword")}</DialogTitle>
            <DialogDescription>
              {t("profile.accountSettings.changePasswordDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t("profile.accountSettings.currentPassword")}</Label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder={t("profile.accountSettings.currentPassword")}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("profile.accountSettings.newPassword")}</Label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={t("profile.accountSettings.placeholderMinLength")}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("profile.accountSettings.confirmNewPassword")}</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder={t("profile.accountSettings.placeholderRepeatPassword")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={handleChangePw} disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("profile.accountSettings.savePassword")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t("profile.accountSettings.deleteAccount")}
            </DialogTitle>
            <DialogDescription>{t("profile.accountSettings.deleteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>
              {t("profile.accountSettings.confirmEmailLabel").replace("{email}", userEmail)}
            </Label>
            <Input
              value={deleteConfirmEmail}
              onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              placeholder={userEmail}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteConfirmEmail !== userEmail || deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("profile.accountSettings.deleteConfirmButton")
              )}
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
    <div className="bg-muted/30 flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center">
      <Icon className="text-muted-foreground h-4 w-4" />
      <p className="text-xl font-bold">{value.toLocaleString()}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
