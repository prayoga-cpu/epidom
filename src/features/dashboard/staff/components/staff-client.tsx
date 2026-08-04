"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { useConfirm } from "@/components/ui/use-confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStaffSchema, type CreateStaffInput } from "@/lib/validation/operations.schemas";
import { apiClient } from "@/lib/api/client";
import { UserRound, Plus, Pencil, UserX, Crown, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StaffRole } from "@prisma/client";
import { useOwnerPinStatus } from "@/features/dashboard/shared/hooks/use-owner-pin";
import { SetOwnerPinDialog } from "@/features/dashboard/shared/set-owner-pin-dialog";
import { PageAccessChecklist } from "./page-access-checklist";
import { ROLE_DEFAULT_PAGES } from "@/config/staff-permissions.config";

interface StaffMember {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  whatsapp: string | null;
  role: StaffRole;
  customRoleLabel: string | null;
  allowedPages: string[];
  isActive: boolean;
  inviteStatus: string | null;
  createdAt: string;
}

interface StaffClientProps {
  storeId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  KITCHEN: "Kitchen",
};

const ROLES_FOR_SELECT: StaffRole[] = ["MANAGER", "CASHIER", "KITCHEN"];

export function StaffClient({
  storeId,
  currentUserId,
  currentUserName,
  currentUserEmail,
}: StaffClientProps) {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [setPinOpen, setSetPinOpen] = useState(false);
  const { data: pinStatus } = useOwnerPinStatus();

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editRole, setEditRole] = useState<StaffRole>("CASHIER");
  const [editCustomRoleLabel, setEditCustomRoleLabel] = useState("");
  const [editAllowedPages, setEditAllowedPages] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPin, setEditPin] = useState("");
  const [editSendPin, setEditSendPin] = useState(false);
  const [editRemovePin, setEditRemovePin] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffMember[] }>(`/stores/${storeId}/staff`),
  });

  const staff = data?.staff ?? [];
  const activeCount = staff.filter((s) => s.isActive).length;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffInput & { email?: string; sendInvite?: boolean }>({
    resolver: zodResolver(createStaffSchema) as never,
    defaultValues: {
      role: "CASHIER",
      sendInvite: false,
      allowedPages: ROLE_DEFAULT_PAGES.CASHIER,
    },
  });

  const watchEmail = watch("email" as never);
  const watchSendInvite = watch("sendInvite" as never);
  const watchRole = watch("role");
  const watchAllowedPages = watch("allowedPages" as never) as string[] | undefined;

  const addMutation = useMutation({
    mutationFn: (body: CreateStaffInput & { email?: string; sendInvite?: boolean }) =>
      apiClient.post(`/stores/${storeId}/staff`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", storeId] });
      setAddOpen(false);
      reset();
      toast.success("Staff member added");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add staff"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (staffId: string) => apiClient.delete(`/stores/${storeId}/staff/${staffId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", storeId] });
      toast.success("Staff member deactivated");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to deactivate"),
  });

  const openEdit = (member: StaffMember) => {
    setEditTarget(member);
    setEditName(member.name);
    setEditUsername(member.username ?? "");
    setEditEmail(member.email ?? "");
    setEditWhatsapp(member.whatsapp ?? "");
    setEditRole(member.role);
    setEditCustomRoleLabel(member.customRoleLabel ?? "");
    setEditAllowedPages(
      member.allowedPages.length > 0 ? member.allowedPages : ROLE_DEFAULT_PAGES[member.role]
    );
    setEditIsActive(member.isActive);
    setEditPin("");
    setEditSendPin(false);
    setEditRemovePin(false);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: editName,
        username: editUsername,
        email: editEmail,
        whatsapp: editWhatsapp,
        role: editRole,
        customRoleLabel: editCustomRoleLabel,
        allowedPages: editAllowedPages,
        isActive: editIsActive,
      };
      if (editRemovePin) {
        body.pin = "";
      } else if (editPin.length === 4) {
        body.pin = editPin;
        body.sendPinEmail = editSendPin;
      }
      await apiClient.patch(`/stores/${storeId}/staff/${editTarget.id}`, body);
      queryClient.invalidateQueries({ queryKey: ["staff", storeId] });
      setEditTarget(null);
      toast.success("Staff member updated");
      if (editPin.length === 4 && editSendPin && editEmail) {
        toast.success("PIN sent to email");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update staff");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("pages.staffTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("pages.staffDesc")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            // Require an Owner PIN before the first staff account exists —
            // it's what lets a shared device gate "switch back to Owner".
            if (!pinStatus?.hasPin) setSetPinOpen(true);
            else setAddOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("pages.addStaff")}
        </Button>
      </div>

      <div className="bg-muted/20 text-muted-foreground rounded-lg border p-3 text-xs leading-normal">
        For security, every PIN session on a device (staff or Owner) automatically logs out at
        midnight — whoever picks up the device the next day must choose an account and enter its
        PIN again. If the Owner forgets their PIN, a one-time code is sent only to the account&apos;s
        registered email — never to a staff member.
      </div>

      {/* Owner account row */}
      <div className="bg-muted/30 flex items-center gap-3 rounded-lg border px-4 py-3">
        <Crown className="h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{currentUserName}</p>
          {currentUserEmail && <p className="text-muted-foreground text-xs">{currentUserEmail}</p>}
        </div>
        <Badge variant="outline" className="border-amber-400 text-amber-600">
          Owner
        </Badge>
      </div>

      {/* Mobile/Tablet: Card Layout */}
      <div className="space-y-3 lg:hidden">
        {isLoading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading...</p>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <UserRound className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              No staff yet. Add your first staff member.
            </p>
          </div>
        ) : (
          staff.map((member) => (
            <div
              key={member.id}
              className="sm:bg-muted/50 space-y-2 border-b p-2 sm:space-y-3 sm:rounded-lg sm:border sm:p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  {member.username ? (
                    <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[8px] sm:text-xs">
                      @{member.username}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-[8px] sm:text-xs">—</span>
                  )}
                </div>
                <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={member.isActive ? "default" : "outline"}>
                  {member.isActive ? t("pages.staffActive") : t("pages.staffInactive")}
                </Badge>
                {member.inviteStatus === "pending" && (
                  <Badge variant="outline" className="border-amber-400 text-amber-600">
                    Invite Pending
                  </Badge>
                )}
                {member.inviteStatus === "accepted" && (
                  <Badge variant="outline" className="border-emerald-400 text-emerald-600">
                    Invited
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(member)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                {member.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={activeCount <= 1 || member.role === "OWNER"}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Deactivate staff member?",
                        description: `${member.name} will lose access until reactivated.`,
                        variant: "destructive",
                        confirmText: "Deactivate",
                        cancelText: t("actions.cancel"),
                      });
                      if (ok) deactivateMutation.mutate(member.id);
                    }}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table Layout */}
      <div className="-mx-4 hidden overflow-x-auto sm:mx-0 lg:block">
        <div className="min-w-[560px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>{t("pages.staffRole")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserRound className="text-muted-foreground h-8 w-8" />
                      <p className="text-muted-foreground text-sm">
                        No staff yet. Add your first staff member.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {member.username ? `@${member.username}` : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={member.isActive ? "default" : "outline"}>
                          {member.isActive ? t("pages.staffActive") : t("pages.staffInactive")}
                        </Badge>
                        {member.inviteStatus === "pending" && (
                          <Badge variant="outline" className="border-amber-400 text-amber-600">
                            Invite Pending
                          </Badge>
                        )}
                        {member.inviteStatus === "accepted" && (
                          <Badge variant="outline" className="border-emerald-400 text-emerald-600">
                            Invited
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(member)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {member.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={activeCount <= 1 || member.role === "OWNER"}
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Deactivate staff member?",
                                description: `${member.name} will lose access until reactivated.`,
                                variant: "destructive",
                                confirmText: "Deactivate",
                                cancelText: t("actions.cancel"),
                              });
                              if (ok) deactivateMutation.mutate(member.id);
                            }}
                            aria-label="Deactivate"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Staff Dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) reset();
        }}
      >
        <FormDialogLayout
          title={t("pages.addStaff")}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddOpen(false);
                  reset();
                }}
              >
                {t("common.actions.cancel")}
              </Button>
              {/* form="add-staff-form" (not a wrapping <form>): DialogContent
                  renders through a Portal, so a <form> wrapping
                  FormDialogLayout never actually contains this button in the
                  real DOM. */}
              <Button
                type="submit"
                form="add-staff-form"
                disabled={isSubmitting || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("common.actions.save")
                )}
              </Button>
            </>
          }
        >
          <form
            id="add-staff-form"
            onSubmit={handleSubmit((data) => addMutation.mutate(data as never))}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-username">Username</Label>
              <Input
                id="add-username"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="e.g. jdoe"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-destructive text-xs">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>{t("pages.staffRole")}</Label>
              <Select
                defaultValue="CASHIER"
                onValueChange={(v) => {
                  setValue("role", v as StaffRole);
                  setValue("allowedPages" as never, ROLE_DEFAULT_PAGES[v as StaffRole] as never);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_FOR_SELECT.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-custom-role">
                Custom role label <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="add-custom-role"
                placeholder="e.g. Assistant Manager"
                {...register("customRoleLabel" as never)}
              />
            </div>
            <PageAccessChecklist
              role={watchRole}
              value={watchAllowedPages ?? []}
              onChange={(pages) => setValue("allowedPages" as never, pages as never)}
            />
            <div className="space-y-1">
              <Label htmlFor="pin">
                {t("pages.staffPin")}{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="pin"
                type="password"
                maxLength={4}
                inputMode="numeric"
                placeholder="4-digit PIN"
                {...register("pin")}
              />
              {errors.pin && <p className="text-destructive text-xs">{errors.pin.message}</p>}
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-semibold">
                Contact Details <span className="font-normal">(optional)</span>
              </p>
              <div className="space-y-1">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  {...register("email" as never)}
                  placeholder="staff@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-whatsapp">WhatsApp Number</Label>
                <Input
                  id="add-whatsapp"
                  type="tel"
                  {...register("whatsapp" as never)}
                  placeholder="+62 812 3456 7890"
                />
              </div>
            </div>

            {watchEmail && (
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                <input type="checkbox" className="rounded" {...register("sendInvite" as never)} />
                Send PIN to staff email
              </label>
            )}
          </form>
        </FormDialogLayout>
      </Dialog>

      {/* Edit Staff Dialog */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <FormDialogLayout
            title={`Edit Staff — ${editTarget.name}`}
            footer={
              <>
                <Button variant="outline" onClick={() => setEditTarget(null)}>
                  {t("common.actions.cancel")}
                </Button>
                <Button
                  onClick={handleEditSave}
                  disabled={editLoading || !editName.trim() || (editPin.length > 0 && editPin.length < 4)}
                >
                  {editLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("common.actions.save")
                  )}
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Username</Label>
                <Input
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="e.g. jdoe"
                />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select
                  value={editRole}
                  onValueChange={(v) => {
                    setEditRole(v as StaffRole);
                    setEditAllowedPages(ROLE_DEFAULT_PAGES[v as StaffRole]);
                  }}
                  disabled={editTarget.role === "OWNER"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(editTarget.role === "OWNER"
                      ? (["OWNER", ...ROLES_FOR_SELECT] as StaffRole[])
                      : ROLES_FOR_SELECT
                    ).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editTarget.role === "OWNER" && (
                  <p className="text-muted-foreground text-[10px] mt-1">
                    The owner role cannot be changed.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>
                  Custom role label{" "}
                  <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  value={editCustomRoleLabel}
                  onChange={(e) => setEditCustomRoleLabel(e.target.value)}
                  placeholder="e.g. Assistant Manager"
                />
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs font-semibold">
                  Contact Details <span className="font-normal">(optional)</span>
                </p>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="staff@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>WhatsApp Number</Label>
                  <Input
                    type="tel"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    placeholder="+62 812 3456 7890"
                  />
                </div>
              </div>

              <PageAccessChecklist
                role={editRole}
                value={editAllowedPages}
                onChange={setEditAllowedPages}
              />

              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={editIsActive ? "ACTIVE" : "INACTIVE"}
                  onValueChange={(v) => setEditIsActive(v === "ACTIVE")}
                  disabled={editTarget.isActive && (activeCount <= 1 || editTarget.role === "OWNER")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {editTarget.isActive && (activeCount <= 1 || editTarget.role === "OWNER") && (
                  <p className="text-amber-500/80 text-[10px] mt-1">
                    {editTarget.role === "OWNER"
                      ? "The owner account access must remain active."
                      : "At least one staff member must remain active to prevent locking yourself out."}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>
                  New PIN{" "}
                  <span className="text-muted-foreground text-xs">
                    (leave blank to keep current)
                  </span>
                </Label>
                <Input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="4-digit PIN"
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={editRemovePin}
                />
                {editPin.length > 0 && editPin.length < 4 && (
                  <p className="text-destructive text-xs mt-1">
                    PIN must be exactly 4 digits.
                  </p>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={editRemovePin}
                  onChange={(e) => {
                    setEditRemovePin(e.target.checked);
                    if (e.target.checked) setEditPin("");
                  }}
                />
                Remove PIN (allow login without PIN)
              </label>
              {editPin.length === 4 && editEmail && (
                <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={editSendPin}
                    onChange={(e) => setEditSendPin(e.target.checked)}
                  />
                  Send new PIN to {editEmail}
                </label>
              )}
            </div>
          </FormDialogLayout>
        </Dialog>
      )}
      <SetOwnerPinDialog
        open={setPinOpen}
        onOpenChange={setSetPinOpen}
        title="Set your Owner PIN first"
        description="Adding staff means someone else may use this device. Set a PIN so you can securely switch back to your Owner account."
        onSuccess={() => setAddOpen(true)}
      />
      {confirmDialog}
    </div>
  );
}
