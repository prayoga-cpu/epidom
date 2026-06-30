"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { useConfirm } from "@/components/ui/use-confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole;
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

export function StaffClient({ storeId, currentUserId, currentUserName, currentUserEmail }: StaffClientProps) {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<StaffRole>("CASHIER");
  const [editPin, setEditPin] = useState("");
  const [editSendPin, setEditSendPin] = useState(false);
  const [editRemovePin, setEditRemovePin] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffMember[] }>(`/stores/${storeId}/staff`),
  });

  const staff = data?.staff ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffInput & { email?: string; sendInvite?: boolean }>({
    resolver: zodResolver(createStaffSchema) as never,
    defaultValues: { role: "CASHIER", sendInvite: false },
  });

  const watchEmail = watch("email" as never);
  const watchSendInvite = watch("sendInvite" as never);

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
    mutationFn: (staffId: string) =>
      apiClient.delete(`/stores/${storeId}/staff/${staffId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", storeId] });
      toast.success("Staff member deactivated");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to deactivate"),
  });

  const openEdit = (member: StaffMember) => {
    setEditTarget(member);
    setEditName(member.name);
    setEditEmail(member.email ?? "");
    setEditRole(member.role);
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
        email: editEmail,
        role: editRole,
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
        <Button size="sm" onClick={() => setAddOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          {t("pages.addStaff")}
        </Button>
      </div>

      {/* Owner account row */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
        <Crown className="h-4 w-4 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{currentUserName}</p>
          {currentUserEmail && <p className="text-xs text-muted-foreground">{currentUserEmail}</p>}
        </div>
        <Badge variant="outline" className="text-amber-600 border-amber-400">Owner</Badge>
      </div>

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <div className="min-w-[560px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>Email</TableHead>
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
                      <p className="text-muted-foreground text-sm">No staff yet. Add your first staff member.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </span>
                      ) : (
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
                          <Badge variant="outline" className="text-amber-600 border-amber-400">Invite Pending</Badge>
                        )}
                        {member.inviteStatus === "accepted" && (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-400">Invited</Badge>
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
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.addStaff")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) => addMutation.mutate(data as never))}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-email">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="add-email" type="email" {...register("email" as never)} placeholder="staff@example.com" />
            </div>
            <div className="space-y-1">
              <Label>{t("pages.staffRole")}</Label>
              <Select
                defaultValue="CASHIER"
                onValueChange={(v) => setValue("role", v as StaffRole)}
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
              <Label htmlFor="pin">{t("pages.staffPin")} <span className="text-muted-foreground text-xs">(optional)</span></Label>
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
            {watchEmail && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded"
                  {...register("sendInvite" as never)}
                />
                Send PIN to staff email
              </label>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); reset(); }}>
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting || addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff — {editTarget.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="staff@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as StaffRole)}>
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
                <Label>New PIN <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
                <Input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="4-digit PIN"
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={editRemovePin}
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
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
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={handleEditSave} disabled={editLoading || !editName.trim()}>
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.actions.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {confirmDialog}
    </div>
  );
}
