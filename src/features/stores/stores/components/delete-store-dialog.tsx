"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Store, useDeleteStore } from "../hooks/use-stores";
import { useI18n } from "@/components/lang/i18n-provider";
import { toast } from "sonner";

interface DeleteStoreDialogProps {
  store: Store;
  /**
   * Custom trigger element (optional)
   * If not provided, uses default Delete button with icon
   */
  trigger?: React.ReactNode;
}

/**
 * Alert dialog for confirming store deletion (hard delete)
 * Uses AlertDialog for better UX on destructive actions (KISS principle)
 * WARNING: This will permanently delete the store and all related data
 */
export function DeleteStoreDialog({ store, trigger }: DeleteStoreDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { mutate: deleteStore, isPending } = useDeleteStore();

  const handleDelete = () => {
    deleteStore(store.id, {
      onSuccess: () => {
        toast.success(
          t("stores.deleteSuccess") || "Store deleted successfully"
        );
        setOpen(false);
      },
      onError: (error) => {
        toast.error(
          error.message || t("stores.deleteError") || "Failed to delete store"
        );
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{store.name}</strong> and all
            associated data (products, materials, recipes, orders, etc.). This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete Store"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
