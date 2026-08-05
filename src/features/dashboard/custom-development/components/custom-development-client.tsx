"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils/formatting";
import { Wrench, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CustomDevelopmentRequestRow {
  id: string;
  company: string | null;
  phone: string | null;
  budget: string | null;
  timeline: string | null;
  description: string;
  status: "NEW" | "IN_REVIEW" | "QUOTED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED";
  createdAt: string;
}

const statusVariant: Record<
  CustomDevelopmentRequestRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  NEW: "secondary",
  IN_REVIEW: "default",
  QUOTED: "default",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  DECLINED: "destructive",
};

interface CustomDevelopmentClientProps {
  storeId: string;
}

export function CustomDevelopmentClient({ storeId }: CustomDevelopmentClientProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [description, setDescription] = useState("");

  const [editTarget, setEditTarget] = useState<CustomDevelopmentRequestRow | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editTimeline, setEditTimeline] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CustomDevelopmentRequestRow | null>(null);

  const requests = useQuery({
    queryKey: ["custom-development-requests"],
    queryFn: () => apiClient.get<CustomDevelopmentRequestRow[]>("/custom-development"),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiClient.post<CustomDevelopmentRequestRow>("/custom-development", {
        company: company || undefined,
        phone: phone || undefined,
        budget: budget || undefined,
        timeline: timeline || undefined,
        description,
        storeId,
      }),
    onSuccess: () => {
      toast.success(t("customDevelopment.form.submitSuccess"));
      setCompany("");
      setPhone("");
      setBudget("");
      setTimeline("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["custom-development-requests"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("customDevelopment.form.submitError"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 20) {
      toast.error(t("customDevelopment.form.descriptionTooShort"));
      return;
    }
    submit.mutate();
  };

  const updateRequest = useMutation({
    mutationFn: () =>
      apiClient.patch<CustomDevelopmentRequestRow>(`/custom-development/${editTarget!.id}`, {
        company: editCompany || undefined,
        phone: editPhone || undefined,
        budget: editBudget || undefined,
        timeline: editTimeline || undefined,
        description: editDescription,
      }),
    onSuccess: () => {
      toast.success(t("customDevelopment.history.updateSuccess"));
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["custom-development-requests"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("customDevelopment.form.submitError"));
    },
  });

  const deleteRequest = useMutation({
    mutationFn: () => apiClient.delete(`/custom-development/${deleteTarget!.id}`),
    onSuccess: () => {
      toast.success(t("customDevelopment.history.deleteSuccess"));
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["custom-development-requests"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("customDevelopment.form.submitError"));
    },
  });

  const openEdit = (r: CustomDevelopmentRequestRow) => {
    setEditTarget(r);
    setEditCompany(r.company ?? "");
    setEditPhone(r.phone ?? "");
    setEditBudget(r.budget ?? "");
    setEditTimeline(r.timeline ?? "");
    setEditDescription(r.description);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editDescription.trim().length < 20) {
      toast.error(t("customDevelopment.form.descriptionTooShort"));
      return;
    }
    updateRequest.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-150px)] space-y-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("pages.customDevelopmentTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("pages.customDevelopmentDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" />
            {t("customDevelopment.form.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="company">{t("customDevelopment.form.company")}</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">{t("customDevelopment.form.phone")}</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget">{t("customDevelopment.form.budget")}</Label>
                <Input id="budget" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="timeline">{t("customDevelopment.form.timeline")}</Label>
                <Input id="timeline" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">{t("customDevelopment.form.description")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={t("customDevelopment.form.descriptionPlaceholder")}
                required
              />
            </div>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("customDevelopment.form.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("customDevelopment.history.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? (
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          ) : !requests.data || requests.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("customDevelopment.history.empty")}</p>
          ) : (
            <div className="space-y-3">
              {requests.data.map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge variant={statusVariant[r.status]}>
                      {t(`customDevelopment.status.${r.status}`)}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(r.createdAt)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(r)}
                        aria-label={t("customDevelopment.history.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={() => setDeleteTarget(r)}
                        aria-label={t("customDevelopment.history.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t("customDevelopment.history.editTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-company">{t("customDevelopment.form.company")}</Label>
                <Input
                  id="edit-company"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-phone">{t("customDevelopment.form.phone")}</Label>
                <Input
                  id="edit-phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-budget">{t("customDevelopment.form.budget")}</Label>
                <Input
                  id="edit-budget"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-timeline">{t("customDevelopment.form.timeline")}</Label>
                <Input
                  id="edit-timeline"
                  value={editTimeline}
                  onChange={(e) => setEditTimeline(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description">{t("customDevelopment.form.description")}</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={6}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" disabled={updateRequest.isPending}>
                {updateRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("customDevelopment.history.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("customDevelopment.history.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("customDevelopment.history.deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteRequest.isPending}
              onClick={() => deleteRequest.mutate()}
            >
              {deleteRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("customDevelopment.history.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
