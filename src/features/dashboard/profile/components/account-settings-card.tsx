"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import {
  Calendar,
  Store,
  Package,
  ShoppingCart,
  Users,
  Key,
  KeyRound,
  Trash2,
  Link2,
  Loader2,
  ShieldCheck,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  LogOut,
  X,
  RotateCcw,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";
import { useOwnerPinStatus } from "@/features/dashboard/shared/hooks/use-owner-pin";
import { SetOwnerPinDialog } from "@/features/dashboard/shared/set-owner-pin-dialog";
import { useConfirm } from "@/components/ui/use-confirm";

interface AccountData {
  createdAt: string;
  deactivatedAt: string | null;
  reactivationDeadline: string | null;
  retentionDeadline: string | null;
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
  sessions: Array<{
    id: string;
    isCurrent: boolean;
    device: "Mobile" | "Tablet" | "Desktop";
    os: string;
    browser: string;
    ipAddress: string | null;
    location: string | null;
    lastActive: string;
    createdAt: string;
  }>;
}

const DEVICE_ICONS: Record<string, React.ElementType> = {
  Mobile: Smartphone,
  Tablet: Tablet,
  Desktop: Monitor,
};

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
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["account-settings"],
    queryFn: fetchAccountSettings,
  });
  const { data: pinStatus } = useOwnerPinStatus();
  const { confirm, confirmDialog } = useConfirm();

  const reactivationDeadlineMs = data?.reactivationDeadline
    ? new Date(data.reactivationDeadline).getTime()
    : null;
  const withinGracePeriod = reactivationDeadlineMs !== null && Date.now() <= reactivationDeadlineMs;
  const daysRemaining =
    reactivationDeadlineMs !== null
      ? Math.max(0, Math.ceil((reactivationDeadlineMs - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

  // Change password dialog
  const [pwDialog, setPwDialog] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Owner PIN dialog
  const [pinDialog, setPinDialog] = useState(false);

  // Deactivate account dialog
  const [deactivateDialog, setDeactivateDialog] = useState(false);
  const [deactivateConfirmEmail, setDeactivateConfirmEmail] = useState("");

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
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateAccountMutation = useMutation({
    mutationFn: () =>
      postAccountAction({ action: "deactivate-account", confirmEmail: deactivateConfirmEmail }),
    onSuccess: async () => {
      toast.success(t("profile.accountSettings.accountDeactivated"));
      await signOut();
      window.location.href = "/";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reactivateAccountMutation = useMutation({
    mutationFn: () => postAccountAction({ action: "reactivate-account" }),
    onSuccess: () => {
      toast.success(t("profile.accountSettings.reactivateSuccess"));
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => postAccountAction({ action: "revoke-session", sessionId }),
    onSuccess: () => {
      toast.success(t("profile.accountSettings.deviceSignedOut"));
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeOtherSessionsMutation = useMutation({
    mutationFn: () => postAccountAction({ action: "revoke-other-sessions" }),
    onSuccess: (result: { revokedCount: number }) => {
      toast.success(
        result.revokedCount > 0
          ? t(
              result.revokedCount === 1
                ? "profile.accountSettings.signedOutOtherDevicesSingular"
                : "profile.accountSettings.signedOutOtherDevicesPlural"
            ).replace("{count}", String(result.revokedCount))
          : t("profile.accountSettings.noOtherDevicesToSignOut")
      );
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleRevokeSession = async (sessionId: string, label: string) => {
    if (
      !(await confirm({
        title: t("profile.accountSettings.signOutDeviceTitle"),
        description: t("profile.accountSettings.signOutDeviceDesc").replace("{name}", label),
        confirmText: t("profile.accountSettings.signOutDeviceConfirm"),
        variant: "destructive",
      }))
    ) {
      return;
    }
    revokeSessionMutation.mutate(sessionId);
  };

  const handleRevokeOtherSessions = async () => {
    if (
      !(await confirm({
        title: t("profile.accountSettings.logOutOtherDevicesTitle"),
        description: t("profile.accountSettings.logOutOtherDevicesDesc"),
        confirmText: t("profile.accountSettings.logOutOtherDevicesConfirm"),
        variant: "destructive",
      }))
    ) {
      return;
    }
    revokeOtherSessionsMutation.mutate();
  };

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
          ) : data?.deactivatedAt ? (
            <div className="space-y-4 py-2">
              <div className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start">
                <AlertTriangle className="text-destructive h-5 w-5 shrink-0" />
                <div className="space-y-2">
                  {withinGracePeriod ? (
                    <>
                      <p className="text-sm font-semibold">
                        {t("profile.accountSettings.daysRemainingToReactivate").replace(
                          "{days}",
                          String(daysRemaining)
                        )}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {t("profile.accountSettings.deactivateDescription")}
                      </p>
                      <Button
                        className="gap-2"
                        onClick={() => reactivateAccountMutation.mutate()}
                        disabled={reactivateAccountMutation.isPending}
                      >
                        {reactivateAccountMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        {t("profile.accountSettings.reactivateAccount")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">
                        {t("profile.accountSettings.pastGracePeriodTitle")}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {t("profile.accountSettings.pastGracePeriodDescription")}
                      </p>
                      <Button variant="outline" className="gap-2" asChild>
                        <a href="mailto:cro@prionation.io,ceo@prionation.io,consult@prionation.io">
                          <Mail className="h-4 w-4" />
                          {t("profile.accountSettings.contactSupportToRecover")}
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
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
                {!data?.hasPasswordAccount && (
                  <p className="text-muted-foreground bg-muted/30 rounded-lg border px-3 py-2 text-xs">
                    The password hasn&apos;t been set up for this account — you can only sign in
                    via the linked account(s) below until you set one.
                  </p>
                )}
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

              {/* Connected Devices */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                    <Monitor className="h-4 w-4" />
                    {t("profile.accountSettings.connectedDevices")}
                  </p>
                  {(data?.sessions.length ?? 0) > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-auto gap-1.5 px-2 py-1 text-xs"
                      onClick={handleRevokeOtherSessions}
                      disabled={revokeOtherSessionsMutation.isPending}
                    >
                      {revokeOtherSessionsMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" />
                      )}
                      {t("profile.accountSettings.logOutAllOtherDevicesButton")}
                    </Button>
                  )}
                </div>
                {!data?.sessions.length ? (
                  <p className="text-muted-foreground text-sm">
                    {t("profile.accountSettings.noActiveSessions")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.sessions.map((s) => {
                      const DeviceIcon = DEVICE_ICONS[s.device] ?? Monitor;
                      const label = `${s.browser} on ${s.os}`;
                      const isRevoking =
                        revokeSessionMutation.isPending &&
                        revokeSessionMutation.variables === s.id;
                      return (
                        <div
                          key={s.id}
                          className="bg-muted/30 flex items-center gap-3 rounded-lg border px-3 py-2.5"
                        >
                          <span className="bg-background flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
                            <DeviceIcon className="text-muted-foreground h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {label}
                              <span className="text-muted-foreground font-normal"> · {s.device}</span>
                            </p>
                            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                              <span>
                                {t("profile.accountSettings.lastActive")}{" "}
                                {formatDate(new Date(s.lastActive))}
                              </span>
                              {s.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {s.location}
                                </span>
                              )}
                            </p>
                          </div>
                          {s.isCurrent ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-emerald-400 text-xs text-emerald-600"
                            >
                              This device
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                              aria-label="Sign out this device"
                              onClick={() => handleRevokeSession(s.id, label)}
                              disabled={isRevoking}
                            >
                              {isRevoking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
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
                  <Button variant="outline" className="gap-2" onClick={() => setPwDialog(true)}>
                    <Key className="h-4 w-4" />
                    {data?.hasPasswordAccount
                      ? t("profile.accountSettings.changePassword")
                      : "Set Password"}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setPinDialog(true)}>
                    <KeyRound className="h-4 w-4" />
                    {pinStatus?.hasPin ? "Change Owner PIN" : "Set Owner PIN"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive gap-2"
                    onClick={() => setDeactivateDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("profile.accountSettings.deactivateAccount")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Change/Set Password Dialog */}
      <Dialog open={pwDialog} onOpenChange={setPwDialog}>
        <FormDialogLayout
          title={
            data?.hasPasswordAccount ? t("profile.accountSettings.changePassword") : "Set Password"
          }
          description={
            data?.hasPasswordAccount
              ? t("profile.accountSettings.changePasswordDescription")
              : "Add a password so you can also sign in with email + password, not just your linked account."
          }
          footer={
            <>
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
            </>
          }
        >
          <div className="space-y-4">
            {data?.hasPasswordAccount && (
              <div className="space-y-1">
                <Label>{t("profile.accountSettings.currentPassword")}</Label>
                <Input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder={t("profile.accountSettings.currentPassword")}
                />
              </div>
            )}
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
        </FormDialogLayout>
      </Dialog>

      {/* Deactivate Account Dialog */}
      <Dialog open={deactivateDialog} onOpenChange={setDeactivateDialog}>
        <FormDialogLayout
          title={t("profile.accountSettings.deactivateAccount")}
          description={t("profile.accountSettings.deactivateDescription")}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeactivateDialog(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deactivateAccountMutation.mutate()}
                disabled={deactivateConfirmEmail !== userEmail || deactivateAccountMutation.isPending}
              >
                {deactivateAccountMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("profile.accountSettings.deactivateConfirmButton")
                )}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Label>
              {t("profile.accountSettings.confirmEmailLabel").replace("{email}", userEmail)}
            </Label>
            <Input
              value={deactivateConfirmEmail}
              onChange={(e) => setDeactivateConfirmEmail(e.target.value)}
              placeholder={userEmail}
            />
          </div>
        </FormDialogLayout>
      </Dialog>

      <SetOwnerPinDialog open={pinDialog} onOpenChange={setPinDialog} />
      {confirmDialog}
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
