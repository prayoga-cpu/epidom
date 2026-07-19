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
 * Alert dialog for confirming store deletion (soft delete/deactivation)
 * Uses AlertDialog for better UX on destructive actions (KISS principle)
 */
export function DeleteStoreDialog({ store, trigger }: DeleteStoreDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { mutate: deleteStore, isPending } = useDeleteStore();

  const handleDelete = () => {
    deleteStore(store.id, {
      onSuccess: () => {
        toast.success(t("stores.deleteSuccess") || "Store deleted successfully");
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || t("stores.deleteError") || "Failed to delete store");
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate <strong>{store.name}</strong>. This action can be reversed by
            contacting support. All data associated with this store will be preserved but the store
            will no longer be accessible.
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
