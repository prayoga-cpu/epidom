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
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Store</DialogTitle>
          <DialogDescription>
            Update your store information. All fields except name are optional.
          </DialogDescription>
        </DialogHeader>
        <StoreForm
          defaultValues={store}
          onSubmit={handleSubmit}
          isLoading={isPending}
          submitText="Update Store"
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
