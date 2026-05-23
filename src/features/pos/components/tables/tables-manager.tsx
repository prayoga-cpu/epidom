"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableStatusBadge } from "./table-status-badge";
import { TableCreateDialog } from "./table-create-dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TableStatus } from "@prisma/client";

interface TableData {
  id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  orders?: Array<{ id: string; orderNumber: string; status: string; total: unknown }>;
}

interface TablesManagerProps {
  storeId: string;
}

export function TablesManager({ storeId }: TablesManagerProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTable, setEditTable] = useState<TableData | null>(null);
  const [deleteTable, setDeleteTable] = useState<TableData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tables", storeId],
    queryFn: async () => apiClient.get<TableData[]>(`/stores/${storeId}/tables`),
  });

  const tables: TableData[] = data ?? [];

  const handleStatusChange = async (table: TableData, status: TableStatus) => {
    try {
      await apiClient.patch(`/stores/${storeId}/tables/${table.id}`, { status });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success(`${table.label} ${t("pos.tables.statusUpdated")}`);
    } catch {
      toast.error(t("pos.tables.updateFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTable) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/stores/${storeId}/tables/${deleteTable.id}`);
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success(`${t("common.actions.delete")} ${deleteTable.label}`);
      setDeleteTable(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? t("pos.tables.deleteFailed");
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const STATUS_CYCLE: TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];
  const nextStatus = (current: TableStatus): TableStatus =>
    STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];

  if (isLoading) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-6 pt-2 pb-4">
        <p className="text-sm text-muted-foreground">
          {tables.length} {t("pos.tables.countHint")}
        </p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("pos.tables.add")}
        </Button>
      </div>

      {tables.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="rounded-full bg-muted p-6">
            <Users className="h-10 w-10 opacity-40" />
          </div>
          <p className="text-lg font-medium text-foreground">{t("pos.tables.empty")}</p>
          <p className="text-sm">{t("pos.tables.emptyDesc")}</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("pos.tables.addFirst")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 px-6 pb-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map((table) => {
            const activeOrder = table.orders?.[0];
            return (
              <button
                key={table.id}
                onClick={() => handleStatusChange(table, nextStatus(table.status))}
                className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  ${table.status === "AVAILABLE" ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                  : table.status === "OCCUPIED" ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                  : table.status === "RESERVED" ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                  : "border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10"}`}
              >
                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); setEditTable(table); }} className="rounded p-1 hover:bg-background/60">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTable(table); }} className="rounded p-1 text-destructive hover:bg-background/60">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-2xl font-bold tracking-tight">{table.label}</span>
                <TableStatusBadge status={table.status} />
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {table.capacity}
                </span>
                {activeOrder && (
                  <span className="mt-1 truncate rounded bg-background/70 px-2 py-0.5 text-xs font-medium">
                    {activeOrder.orderNumber}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <TableCreateDialog
        storeId={storeId}
        open={createOpen || !!editTable}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditTable(null); }}
        editTable={editTable}
      />

      <AlertDialog open={!!deleteTable} onOpenChange={(o) => !o && setDeleteTable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pos.tables.confirmDelete")} {deleteTable?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.validation.unexpectedError")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? t("pos.tables.deleting") : t("common.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
