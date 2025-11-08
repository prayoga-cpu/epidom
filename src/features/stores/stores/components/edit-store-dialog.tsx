"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { StoreForm } from "./store-form";
import { Store, useUpdateStore } from "../hooks/use-stores";
import { CreateStoreInput } from "@/lib/validation/business.schemas";
import { useI18n } from "@/components/lang/i18n-provider";
import { toast } from "sonner";

interface EditStoreDialogProps {
  store: Store;
  /**
   * Custom trigger element (optional)
   * If not provided, uses default Edit button with icon
   */
  trigger?: React.ReactNode;
}

/**
 * Dialog for editing an existing store
 * Uses shared StoreForm component (DRY principle)
 */
export function EditStoreDialog({ store, trigger }: EditStoreDialogProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { mutate: updateStore, isPending } = useUpdateStore(store.id);

  const handleSubmit = (data: CreateStoreInput) => {
    updateStore(data, {
      onSuccess: () => {
        toast.success(t("stores.editSuccess") || "Store updated successfully");
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || t("stores.editError") || "Failed to update store");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            {t("actions.edit")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="mx-4 flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:mx-0 sm:max-w-[500px]">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-xl font-bold sm:text-2xl">
            {t("stores.editStore") || "Edit Store"}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {t("stores.editDescription") || "Update your store information. All fields except name are optional."}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <StoreForm
            defaultValues={store}
            onSubmit={handleSubmit}
            isLoading={isPending}
            submitText={t("stores.updateStore") || "Update Store"}
            onCancel={() => setOpen(false)}
            showActions={false}
          />
        </div>

        {/* Fixed Footer with Actions */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="edit-store-form"
              disabled={isPending}
            >
              {isPending ? t("actions.saving") || "Saving..." : t("stores.updateStore") || "Update Store"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
