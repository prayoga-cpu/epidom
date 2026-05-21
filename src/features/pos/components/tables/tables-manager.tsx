"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TableStatusBadge } from "./table-status-badge";
import { TableCreateDialog } from "./table-create-dialog";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTable, setEditTable] = useState<TableData | null>(null);
  const [deleteTable, setDeleteTable] = useState<TableData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tables", storeId],
    queryFn: async () => {
      return apiClient.get<TableData[]>(`/stores/${storeId}/tables`);
    },
  });

  const tables: TableData[] = data ?? [];

  const handleStatusChange = async (table: TableData, status: TableStatus) => {
    try {
      await apiClient.patch(`/stores/${storeId}/tables/${table.id}`, { status });
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success(`Status meja ${table.label} diperbarui`);
    } catch {
      toast.error("Gagal memperbarui status meja");
    }
  };

  const handleDelete = async () => {
    if (!deleteTable) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/stores/${storeId}/tables/${deleteTable.id}`);
      queryClient.invalidateQueries({ queryKey: ["tables", storeId] });
      toast.success(`Meja ${deleteTable.label} dihapus`);
      setDeleteTable(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Gagal menghapus meja";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const STATUS_CYCLE: TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

  const nextStatus = (current: TableStatus): TableStatus => {
    const idx = STATUS_CYCLE.indexOf(current);
    return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  };

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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-6 pt-2 pb-4">
        <p className="text-sm text-muted-foreground">
          {tables.length} meja terdaftar · Tap meja untuk ganti status
        </p>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Tambah Meja
        </Button>
      </div>

      {/* Grid */}
      {tables.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="rounded-full bg-muted p-6">
            <Users className="h-10 w-10 opacity-40" />
          </div>
          <p className="text-lg font-medium text-foreground">Belum ada meja</p>
          <p className="text-sm">Tambahkan meja untuk manajemen dine-in</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Meja Pertama
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
                  ${
                    table.status === "AVAILABLE"
                      ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                      : table.status === "OCCUPIED"
                      ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                      : table.status === "RESERVED"
                      ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                      : "border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10"
                  }`}
              >
                {/* Action buttons */}
                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTable(table);
                    }}
                    className="rounded p-1 hover:bg-background/60"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTable(table);
                    }}
                    className="rounded p-1 text-destructive hover:bg-background/60"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* Label */}
                <span className="text-2xl font-bold tracking-tight">{table.label}</span>

                {/* Status */}
                <TableStatusBadge status={table.status} />

                {/* Capacity */}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {table.capacity} org
                </span>

                {/* Active order */}
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

      {/* Dialogs */}
      <TableCreateDialog
        storeId={storeId}
        open={createOpen || !!editTable}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setEditTable(null);
        }}
        editTable={editTable}
      />

      <AlertDialog open={!!deleteTable} onOpenChange={(o) => !o && setDeleteTable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus meja {deleteTable?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Meja tidak dapat dihapus jika masih ada pesanan aktif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
