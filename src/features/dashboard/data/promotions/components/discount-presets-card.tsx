"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import type { DiscountPresetDto } from "@/types/api/cashier";
import { useDeleteDiscountPreset, useUpdateDiscountPreset } from "../hooks/use-discount-presets";
import { usePromotionFormat } from "../hooks/use-promotion-format";
import { DiscountPresetDialog } from "./discount-preset-dialog";
import { PromotionBlock, PromotionBlockState } from "./promotion-block";

interface DiscountPresetsCardProps {
  storeId: string;
  query: UseQueryResult<DiscountPresetDto[], Error>;
}

export function DiscountPresetsCard({ storeId, query }: DiscountPresetsCardProps) {
  const { t } = useI18n();
  const { formatDiscount } = usePromotionFormat();
  const updatePreset = useUpdateDiscountPreset(storeId);
  const deletePreset = useDeleteDiscountPreset(storeId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountPresetDto | null>(null);
  // The row being deleted is kept after the dialog closes (only `deleteOpen` flips),
  // so the confirmation text doesn't go blank during its exit animation.
  const [deleting, setDeleting] = useState<DiscountPresetDto | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const presets = query.data ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (preset: DiscountPresetDto) => {
    setEditing(preset);
    setDialogOpen(true);
  };

  // The Switch applies immediately (PATCH isActive, optimistic), no dialog. On
  // failure the hook has already restored the list; we only need to say so.
  const toggleActive = (preset: DiscountPresetDto, isActive: boolean) => {
    updatePreset.mutate(
      { id: preset.id, body: { isActive } },
      {
        onError: (error) =>
          toast.error(t("common.error"), {
            description: error.message || t("promotions.toasts.updateFailed"),
          }),
      }
    );
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deletePreset.mutateAsync(deleting.id);
      toast.success(t("promotions.toasts.presetDeleted"));
    } catch (error) {
      toast.error(t("common.error"), {
        description: error instanceof Error ? error.message : t("promotions.toasts.deleteFailed"),
      });
    }
    setDeleteOpen(false);
  };

  return (
    <>
      <PromotionBlock
        title={t("promotions.presets.title")}
        description={t("promotions.presets.description")}
        action={
          <Button size="sm" className="h-10 w-full sm:w-auto" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("promotions.presets.add")}
          </Button>
        }
      >
        {query.isLoading ? (
          <PromotionBlockState>
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden />
          </PromotionBlockState>
        ) : query.isError ? (
          <PromotionBlockState>
            <p className="text-destructive text-sm">
              {query.error.message || t("promotions.presets.loadFailed")}
            </p>
            <Button variant="outline" size="sm" className="h-10" onClick={() => query.refetch()}>
              {t("common.actions.retry")}
            </Button>
          </PromotionBlockState>
        ) : presets.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-8 text-center">
            <Tag className="text-muted-foreground/50 mb-3 h-10 w-10" aria-hidden />
            <h4 className="mb-1 text-base font-semibold">{t("promotions.presets.empty.title")}</h4>
            <p className="text-muted-foreground mb-4 max-w-md text-sm">
              {t("promotions.presets.empty.description")}
            </p>
            <Button size="sm" className="h-10" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("promotions.presets.add")}
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {presets.map((preset) => {
              const togglePending =
                updatePreset.isPending && updatePreset.variables?.id === preset.id;
              return (
                <li
                  key={preset.id}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  {/* min-w-0 so a long preset name truncates instead of pushing the
                      controls off the row. */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={preset.name}>
                      {preset.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {preset.type === "PERCENT"
                          ? t("promotions.type.percent")
                          : t("promotions.type.fixed")}
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatDiscount(preset)}
                      </span>
                      {!preset.isActive && (
                        <Badge variant="outline">{t("promotions.status.inactive")}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    {/* The label makes the whole 40px cell tappable, not just the
                        32px switch track. */}
                    <label
                      htmlFor={`preset-toggle-${preset.id}`}
                      className="text-muted-foreground flex h-10 min-w-10 cursor-pointer items-center gap-2 text-sm"
                    >
                      <Switch
                        id={`preset-toggle-${preset.id}`}
                        checked={preset.isActive}
                        disabled={togglePending}
                        onCheckedChange={(checked) => toggleActive(preset, checked)}
                        aria-label={t("promotions.presets.toggle").replace("{name}", preset.name)}
                      />
                      <span>
                        {preset.isActive
                          ? t("promotions.status.active")
                          : t("promotions.status.inactive")}
                      </span>
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        onClick={() => openEdit(preset)}
                        aria-label={t("promotions.presets.edit").replace("{name}", preset.name)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleting(preset);
                          setDeleteOpen(true);
                        }}
                        aria-label={t("promotions.presets.delete").replace("{name}", preset.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PromotionBlock>

      <DiscountPresetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        storeId={storeId}
        preset={editing}
      />

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("promotions.presets.deleteTitle")}
        description={t("promotions.presets.deleteDescription").replace(
          "{name}",
          deleting?.name ?? ""
        )}
        confirmText={t("common.actions.delete")}
        cancelText={t("common.actions.cancel")}
        onConfirm={confirmDelete}
        variant="destructive"
        loading={deletePreset.isPending}
      />
    </>
  );
}
