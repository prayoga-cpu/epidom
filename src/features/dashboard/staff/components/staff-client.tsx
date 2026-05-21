"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
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
import { UserRound, Plus, Pencil, UserX } from "lucide-react";
import type { StaffRole } from "@prisma/client";

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

interface StaffClientProps {
  storeId: string;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: "Pemilik",
  MANAGER: "Manajer",
  CASHIER: "Kasir",
  KITCHEN: "Dapur",
};

export function StaffClient({ storeId }: StaffClientProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffMember[] }>(`/api/stores/${storeId}/staff`),
  });

  const staff = data?.staff ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffInput>({
    resolver: zodResolver(createStaffSchema) as never,
    defaultValues: { role: "CASHIER" },
  });

  const addMutation = useMutation({
    mutationFn: (body: CreateStaffInput) =>
      apiClient.post(`/api/stores/${storeId}/staff`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", storeId] });
      setAddOpen(false);
      reset();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (staffId: string) =>
      apiClient.delete(`/api/stores/${storeId}/staff/${staffId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff", storeId] }),
  });

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

      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <div className="min-w-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("pages.staffRole")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserRound className="text-muted-foreground h-8 w-8" />
                      <p className="text-muted-foreground text-sm">{t("pages.addStaff")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "outline"}>
                        {member.isActive ? t("pages.staffActive") : t("pages.staffInactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditTarget(member)}
                          aria-label={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {member.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deactivateMutation.mutate(member.id)}
                            aria-label={t("pages.staffInactive")}
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
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.addStaff")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) => addMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
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
                  {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pin">{t("pages.staffPin")}</Label>
              <Input
                id="pin"
                type="password"
                maxLength={4}
                inputMode="numeric"
                {...register("pin")}
              />
              {errors.pin && <p className="text-destructive text-xs">{errors.pin.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); reset(); }}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting || addMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit stub — re-uses same pattern, condensed for now */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editTarget.name}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              {t("pages.staffRole")}: {ROLE_LABELS[editTarget.role]}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
